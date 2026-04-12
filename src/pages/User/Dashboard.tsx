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

interface Room {
  _id: string;
  name: string;
  isPrivate: boolean;
  owner: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [roomCode, setRoomCode] = useState<Room[]>([]);
  const [showFindRoomModal, setShowFindRoomModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [room, setRoom] = useState({name: '', isPrivate: true});

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
        setUserRooms([...userRooms, res.data]);
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
                    <p><span>{room.name}</span> {room.isPrivate ? "(Privada)" : "(Pública)"}</p>
                    <div className={styles.roomRowButtons}>
                      <Link to={`/room/${room._id}`} className={styles.joinButton}>Entrar <FaDoorOpen/></Link>
                      <div className={styles.dropdown}>
                        <button className={styles.dropbtn} onClick={() => {}}>Opções<FaCog/></button>
                        <div className={styles.dropdownContent}>
                          { room.owner === user!._id && 
                            <div>
                              <button onClick={() => navigator.clipboard.writeText(room._id)} className={styles.dropdownItem}>
                                Copiar código da sala
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
            <input type="text" required name='roomCode' onChange={handleRoomCodeChange}/>
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
