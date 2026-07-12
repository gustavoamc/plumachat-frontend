import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Link } from "react-router-dom";
import api from "../../utils/api";

import styles from "./Dashboard.module.css";
import { IoMdAdd } from "react-icons/io";
import { FaCog, FaDoorOpen } from "react-icons/fa";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { ErrorBoundary } from "../../components/routes/ErrorBoundary";
import { Modal, modalStyles } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";

type RoomType = "default" | "draw_guess";

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  default: "Chat com canvas",
  draw_guess: "Desenhe e adivinhe",
};

interface Room {
  _id: string;
  name: string;
  isPrivate: boolean;
  roomType: RoomType;
  owner: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [showFindRoomModal, setShowFindRoomModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [room, setRoom] = useState<{ name: string; isPrivate: boolean; roomType: RoomType }>({ name: '', isPrivate: true, roomType: 'default' });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/room/`)
      .then(res => {
        setUserRooms(res.data);
      })
      .catch(error => {
        console.error("Erro:", error);
      });
  }, [user]);

  const handleCreateRoom = (e: any) => {
    e.preventDefault();

    if(!room.name) {
      alert("O nome da sala é obrigatório.");
      return;
    }

    api.post('/room/', room)
      .then(res => {
        setShowCreateRoomModal(false);
        setUserRooms([...userRooms, res.data.room]);
      })
      .catch(error => {
        console.error("Erro ao criar sala:", error);
      });
  }

  const handleRoomChange = (e: any) => {
    const { name, value } = e.target;
    setRoom(prevState => ({ ...prevState, [name]: value }));
  }

  const handleCopyCode = async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      // Fallback for non-secure contexts where the Clipboard API is unavailable
      const textarea = document.createElement('textarea');
      textarea.value = roomId;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 1200);
  }

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRoomCode(text.trim());
    } catch {
      alert('Não foi possível ler a área de transferência. Cole manualmente.');
    }
  }

  const handleRoomCodeChange = (e: any) => {
    if(e.target.name != 'roomCode') {
      return;
    }

    setRoomCode(e.target.value);
    return;
  }

  const handleFindRoom = (e: any) => {
    e.preventDefault();

    api.post(`/room/join/${roomCode}`)
      .then(res => {
        setShowFindRoomModal(false);
        setUserRooms([...userRooms, res.data.room]);
      })
      .catch(error => {
        console.error("Erro ao procurar sala:", error);
        alert("Erro ao procurar sala. " + error.response.data.message);
      });
  }

  return (
    <div>
      <h1>Bem vindo a Dashboard!</h1>
      <br />
      <ErrorBoundary>
        <div className={styles.header}>
          <h2>Salas que você participa:</h2>
          <div className={styles.headerButtons}>
            <button onClick={() => setShowFindRoomModal(true)}>
              Procurar Sala <FaMagnifyingGlass />
            </button>
            <button onClick={() => setShowCreateRoomModal(true)}>
              Criar Sala <IoMdAdd />
            </button>
          </div>
        </div>
        <div className={styles.roomList}>
          {userRooms.length == 0
            ? <p className={styles.noChats}>Você não participa de nenhuma sala. Crie ou entre em uma sala para começar!</p>
            : <ul>
                {userRooms.map(room => (
                  <li key={room._id} className={styles.roomRow}>
                    <p>
                      <span>{room.name}</span> {room.isPrivate ? "(Privada)" : "(Pública)"}
                      {room.roomType === "draw_guess" && ` · ${ROOM_TYPE_LABELS.draw_guess}`}
                    </p>
                    <div className={styles.roomRowButtons}>
                      <Link to={`/room/${room._id}`} className={styles.joinButton}>Entrar <FaDoorOpen/></Link>
                      <div className={styles.dropdown}>
                        <button className={styles.dropbtn} onClick={() => {}}>Opções<FaCog/></button>
                        <div className={styles.dropdownContent}>
                          { room.owner === user!._id && 
                            <div>
                              <button
                                onClick={() => handleCopyCode(room._id)}
                                className={`${styles.dropdownItem} ${copiedId === room._id ? styles.copied : ''}`}
                              >
                                {copiedId === room._id ? 'Código copiado!' : 'Copiar código da sala'}
                              </button>
                              <hr/>
                            </div>
                          }
                          <Link to={`/room/${room._id}/info`} className={styles.dropdownItem}>
                            Detalhes sala
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
          }
        </div>
      </ErrorBoundary>
      {/* Find Room Modal */}
      {showFindRoomModal && (
        <Modal onClose={() => setShowFindRoomModal(false)}>
          <h2>Procurar sala</h2>
          <form onSubmit={handleFindRoom}>
            <label>Digite o código da sala:</label>
            <div className={styles.codeInputRow}>
              <input type="text" required name='roomCode' value={roomCode} onChange={handleRoomCodeChange}/>
              <Button variant="secondary" type="button" onClick={handlePasteCode}>Colar código</Button>
            </div>
            <div className={modalStyles.actions}>
              <Button variant="danger" type="button" onClick={() => setShowFindRoomModal(false)}>Cancelar</Button>
              <Button variant="success" type="submit">Buscar</Button>
            </div>
          </form>
        </Modal>
      )}
      {/* Create Room Modal */}
      {showCreateRoomModal && (
        <Modal onClose={() => setShowCreateRoomModal(false)}>
          <h2>Criar sala</h2>
          <form onSubmit={handleCreateRoom}>
            <label>Nome da sala:</label>
            <input type="text" required name='name' onChange={handleRoomChange}/>
            <label>Tipo de sala:</label>
            <select name='roomType' value={room.roomType} onChange={handleRoomChange}>
              <option value="default">{ROOM_TYPE_LABELS.default}</option>
              <option value="draw_guess">{ROOM_TYPE_LABELS.draw_guess}</option>
            </select>
            <div className={modalStyles.actions}>
              <Button variant="danger" type="button" onClick={() => setShowCreateRoomModal(false)}>Cancelar</Button>
              <Button variant="success" type="submit">Criar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
