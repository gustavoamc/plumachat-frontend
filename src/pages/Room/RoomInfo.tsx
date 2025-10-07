import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import styles from './RoomInfo.module.css'
import { ErrorBoundary } from '../../components/routes/ErrorBoundary';
import { FaEdit, FaTrashAlt } from "react-icons/fa";
import { IoIosRemoveCircle, IoMdExit } from "react-icons/io";

interface Room {
  _id: string;
  name: string;
  participants: {_id: string, username: string}[];
  isPrivate: boolean;
  owner: {_id: string, username: string};
  createdAt: string;
}

function RoomInfo() {
  const { id } = useParams();
  const { user } = useAuth();
  const [showEditRoomModal, setShowEditRoomModal] = useState(false);
  const [isOnwer, setIsOwner] = useState(false);
  const [room, setRoom] = useState<Room>({
    _id: id ?? '', 
    name: '', 
    isPrivate: true,
    participants: [{_id: '', username: ''}],
    owner: {
      _id: '', 
      username: ''
    },
    createdAt: ''
  });

  useEffect(() => {
    api.get(`/room/${id}`)
      .then(res => {
        setRoom(res.data);
        setIsOwner(user!._id === res.data.owner._id);
      })
      .catch(error => {
        alert('Erro ao buscar sala: ' + error.response.data.message);
      });
  },[user])

  const removeParticipant = (userId: string) => {
    api.post(`/room/${id}/remove`, { userId: userId })
    .then(() => {
      setRoom(prevState => ({
        ...prevState, 
        participants: prevState.participants.filter(p => p._id !== userId) 
      }));
    })
    .catch(error => {
      console.error("Erro ao remover participante:", error);
    })
  }

  const handleRoomChange = (e: any) => {
    const { name, value } = e.target;
    setRoom(prevState => ({ ...prevState, [name]: value }));
    console.log('name:', name);
    console.log('value:', value);
  }

  const handleEditRoom = (e: any) => {
    e.preventDefault();
    
    api.patch(`/room/${id}`, { name: room.name })
      .then(res => {
        setRoom(res.data.room);
        setShowEditRoomModal(false);
      })
      .catch(error => {
        alert('Erro ao editar sala: ' + error.response.data.message);
      })
  }
  
  return (
    <ErrorBoundary>
      <div className={styles.mainDiv}>
          <div className={styles.leftColumn}>
            <h1>Informações da sala</h1>
            <div className={styles.roomInfoDiv}>
              <p><strong>Nome:</strong> {room.name}</p>
              <p><strong>Dono:</strong> {room.owner.username}</p>
              <p><strong>Privacidade:</strong> {room.isPrivate ? 'Privada' : 'Pública'}</p>
              <p><strong>Criada em:</strong> {new Date(room.createdAt).toLocaleDateString()}</p>
            </div>

            <div>
              <h1>Participantes da sala</h1>
              <p>total: {room.participants.length}</p>
            </div>
            <div className={styles.participantsList}>
              {room.participants.map(participant => (
                <div key={participant._id} className={styles.participantDiv}>
                  <p>{participant.username} {user!._id == participant._id ? <strong>(Você)</strong>: ''}</p>
                  {isOnwer && (
                    <button onClick={() => removeParticipant(participant._id)}><IoIosRemoveCircle /> Remover da sala</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.rightColumn}>
            <h1>Opções da sala:</h1>
            <div className={styles.roomOptionsDiv}>
              <button className={styles.redButton}><IoMdExit /> Sair da sala</button>
              {isOnwer && (
                <>
                  <button className={styles.orangeButton}
                    onClick={() => setShowEditRoomModal(true)}
                  >
                    <FaEdit /> Editar sala
                  </button>
                  <button className={styles.redButton}><FaTrashAlt /> Deletar sala</button>
                </>
              )}
            </div>
          </div>
      </div>
      {/* Edit Room Modal */}
      {showEditRoomModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Editar sala</h2>
            <form onSubmit={handleEditRoom}>
              <label>Novo nome da sala:</label>
              <input type="text" required name='roomName' onChange={handleRoomChange}/>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelButton} onClick={() => setShowEditRoomModal(false)}>Cancelar</button>
                <button type="submit" className={styles.modalButton}>Alterar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ErrorBoundary>
  )
}

export default RoomInfo