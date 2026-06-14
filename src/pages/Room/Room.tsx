import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import { getSocket, disconnectSocket } from '../../utils/socket';
import styles from './Room.module.css'
import { ErrorBoundary } from '../../components/routes/ErrorBoundary';
import { Button } from '../../components/ui/Button';
import { FaArrowLeft } from "react-icons/fa";

interface RoomMeta {
  _id: string;
  name: string;
  isPrivate: boolean;
}

interface ChatMessage {
  _id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
}

function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
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
        setMessages(res.data.map((m: any) => ({
          _id: m._id,
          userId: m.userId?._id ?? m.userId,
          username: m.userId?.username ?? '???',
          content: m.content,
          timestamp: m.timestamp,
        })));
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

    socket.on('error', (err: { message: string }) => {
      console.error('Socket error:', err.message);
    });

    return () => {
      socket.emit('leave_room', id);
      socket.off('receive_message');
      socket.off('error');
      disconnectSocket();
    };
  }, [id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !id) return;

    getSocket().emit('send_message', { roomId: id, content: input.trim() });
    setInput('');
  };

  return (
    <ErrorBoundary>
      <div className={styles.mainDiv}>
        <div className={styles.header}>
          <Button variant="neutral" onClick={() => navigate('/dashboard')}>
            <FaArrowLeft /> Desconectar
          </Button>
          <h1>{room?.name ?? 'Carregando...'}</h1>
          <Link to={`/room/${id}/info`}>
            <Button variant="secondary">Informações da sala</Button>
          </Link>
        </div>

        <div className={styles.messagesContainer}>
          {messages.map(msg => (
            <div
              key={msg._id}
              className={`${styles.messageRow} ${msg.userId === user!._id ? styles.ownMessage : ''}`}
            >
              <span className={styles.messageAuthor}>{msg.username}</span>
              <p className={styles.messageContent}>{msg.content}</p>
              <span className={styles.messageTimestamp}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className={styles.inputForm} onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
          />
          <Button variant="primary" type="submit">Enviar</Button>
        </form>
      </div>
    </ErrorBoundary>
  )
}

export default Room
