import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import { getSocket, disconnectSocket } from '../../utils/socket';
import styles from './Room.module.css'
import { ErrorBoundary } from '../../components/routes/ErrorBoundary';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { RoomInfoPanel } from './RoomInfoPanel';
import { FaArrowLeft } from "react-icons/fa";

interface RoomMeta {
  _id: string;
  name: string;
  isPrivate: boolean;
  participants: { _id: string; username: string }[];
}

interface ChatMessage {
  _id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
  system?: boolean;
}

function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [removed, setRemoved] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [showSystemMessages, setShowSystemMessages] = useState(
    () => localStorage.getItem('showSystemMessages') !== 'false'
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load room metadata + message history
  useEffect(() => {
    if (!id) return;

    api.get(`/room/${id}`)
      .then(res => setRoom(res.data))
      .catch(error => {
        alert('Erro ao buscar sala: ' + error.response?.data?.message);
        navigate(-1);
      });

    api.get(`/room/${id}/messages`)
      .then(res => {
        setMessages(res.data.map((m: any) => (
          m.system
            ? {
                _id: m._id,
                system: true,
                content: m.content,
                timestamp: m.timestamp,
                userId: '',
                username: '',
              }
            : {
                _id: m._id,
                userId: m.userId?._id ?? m.userId,
                username: m.userId?.username ?? '???',
                content: m.content,
                timestamp: m.timestamp,
              }
        )));
      })
      .catch(error => {
        alert('Erro ao buscar mensagens: ' + error.response?.data?.message);
      });
  }, [id]);

  // Socket connection lifecycle
  useEffect(() => {
    if (!id) return;

    const socket = getSocket();
    socket.connect();
    socket.emit('join_room', id);

    socket.on('receive_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('system_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('presence', ({ onlineUserIds }: { onlineUserIds: string[] }) => {
      setOnlineUserIds(onlineUserIds);
    });

    socket.on('participant_removed', ({ userId }: { userId: string }) => {
      if (userId === user?._id) {
        setRemoved(true);
        return;
      }
      // Drop the removed user from the local list so their messages are flagged
      setRoom(prev =>
        prev ? { ...prev, participants: prev.participants.filter(p => p._id !== userId) } : prev
      );
    });

    socket.on('error', (err: { message: string }) => {
      console.error('Socket error:', err.message);
    });

    return () => {
      socket.emit('leave_room', id);
      socket.off('receive_message');
      socket.off('system_message');
      socket.off('presence');
      socket.off('participant_removed');
      socket.off('error');
      disconnectSocket();
    };
  }, [id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Formats a timestamp as "DD/MM/YY HH:MM:SS"
  const formatSystemTime = (ts: string) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return `${date} ${time}`;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !id) return;

    getSocket().emit('send_message', { roomId: id, content: input.trim() });
    setInput('');
  };

  const toggleSystemMessages = () => {
    setShowSystemMessages(prev => {
      const next = !prev;
      localStorage.setItem('showSystemMessages', String(next));
      return next;
    });
  };

  const visibleMessages = showSystemMessages
    ? messages
    : messages.filter(m => !m.system);

  if (removed) {
    return (
      <ErrorBoundary>
        <div className={styles.removedDiv}>
          <h1>Você foi removido desta sala.</h1>
          <p>O dono da sala removeu seu acesso.</p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            <FaArrowLeft /> Voltar para a Dashboard
          </Button>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className={styles.mainDiv}>
        <div className={styles.header}>
          <Button variant="neutral" onClick={() => navigate('/dashboard')}>
            <FaArrowLeft /> Desconectar
          </Button>
          <h1>{room?.name ?? 'Carregando...'}</h1>
          <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
            Informações da sala
          </Button>
        </div>

        <div className={styles.messagesContainer}>
          {visibleMessages.map(msg => {
            if (msg.system) {
              return (
                <div key={msg._id} className={styles.systemMessage}>
                  {formatSystemTime(msg.timestamp)} - {msg.content}
                </div>
              );
            }
            const isMember = !room || room.participants.some(p => p._id === msg.userId);
            return (
            <div
              key={msg._id}
              className={`${styles.messageRow} ${msg.userId === user!._id ? styles.ownMessage : ''}`}
            >
              <span className={styles.messageAuthor}>
                {msg.username}{!isMember && ' - (saiu/removido)'}
              </span>
              <p className={styles.messageContent}>{msg.content}</p>
              <span className={styles.messageTimestamp}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form className={styles.inputForm} onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua mensagem ou comando (/comando)..."
          />
          <Button variant="primary" type="submit">Enviar</Button>
        </form>
      </div>

      {showInfoModal && id && (
        <Modal onClose={() => setShowInfoModal(false)}>
          <RoomInfoPanel
            id={id}
            onClose={() => setShowInfoModal(false)}
            onlineUserIds={onlineUserIds}
            showSystemMessages={showSystemMessages}
            onToggleSystemMessages={toggleSystemMessages}
          />
        </Modal>
      )}
    </ErrorBoundary>
  )
}

export default Room
