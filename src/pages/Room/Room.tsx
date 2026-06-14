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
import { RoomCanvas } from './RoomCanvas';
import { FaArrowLeft, FaPaintBrush, FaComments } from "react-icons/fa";

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

// Available chat commands, shown as hints when the input starts with "/"
const COMMANDS = [
  { name: '/r', usage: '/r 2d6', description: 'Rola dados — ex: /r 3d10+2, /r 2d8+6 ataque' },
  { name: '/sussurro', usage: '/sussurro <usuário> <msg>', description: 'Envia uma mensagem privada a um usuário' },
];

function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [removed, setRemoved] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
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
      // Show server feedback (e.g. invalid command) only to this client
      setMessages(prev => [...prev, {
        _id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        system: true,
        content: err.message,
        timestamp: new Date().toISOString(),
        userId: '',
        username: '',
      }]);
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
    const text = input.trim();
    if (!text || !id) return;

    // Slash commands (e.g. "/r 2d6") are parsed and rolled server-side
    getSocket().emit('send_message', { roomId: id, content: text });
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

  const commandQuery = input.startsWith('/')
    ? input.slice(1).split(/\s+/)[0].toLowerCase()
    : null;
  const commandSuggestions = commandQuery !== null
    ? COMMANDS.filter(c => c.name.slice(1).startsWith(commandQuery))
    : [];

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab completes to the top matching command while still typing its name
    if (e.key === 'Tab' && commandSuggestions.length > 0 && !input.includes(' ')) {
      e.preventDefault();
      setInput(commandSuggestions[0].name + ' ');
    }
  };

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
          <div className={styles.headerActions}>
            <Button variant="info" onClick={() => setShowCanvas(prev => !prev)}>
              {showCanvas ? <><FaComments /> Voltar ao chat</> : <><FaPaintBrush /> Quadro</>}
            </Button>
            <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
              Informações da sala
            </Button>
          </div>
        </div>

        {showCanvas && id && (
          <div className={styles.canvasContainer}>
            <RoomCanvas roomId={id} />
          </div>
        )}

        <div
          className={styles.messagesContainer}
          style={showCanvas ? { display: 'none' } : undefined}
        >
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

        <div
          className={styles.inputArea}
          style={showCanvas ? { display: 'none' } : undefined}
        >
          {commandSuggestions.length > 0 && (
            <div className={styles.commandList}>
              {commandSuggestions.map(c => (
                <button
                  type="button"
                  key={c.name}
                  className={styles.commandItem}
                  onClick={() => setInput(c.name + ' ')}
                >
                  <span className={styles.commandName}>{c.usage}</span>
                  <span className={styles.commandDesc}>{c.description}</span>
                </button>
              ))}
            </div>
          )}
          <form className={styles.inputForm} onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Digite sua mensagem ou comando (/comando)..."
            />
            <Button variant="primary" type="submit">Enviar</Button>
          </form>
        </div>
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
