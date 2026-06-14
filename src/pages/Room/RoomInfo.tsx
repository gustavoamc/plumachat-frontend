import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import styles from './RoomInfo.module.css'
import { ErrorBoundary } from '../../components/routes/ErrorBoundary';
import { FaArrowLeft, FaEdit, FaTrashAlt } from "react-icons/fa";
import { IoIosRemoveCircle, IoMdExit } from "react-icons/io";
import { Modal, modalStyles } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

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
  const navigate = useNavigate();
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
        alert('Erro ao buscar sala: ' + error.response?.data?.message);
        navigate(-1);
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

  const handleLeaveRoom = () => {
    api.post(`/room/leave/${id}`)
      .then(() => {
        navigate('/dashboard');
      })
      .catch(error => {
        alert('Erro ao saída da sala: ' + error.response?.data?.message);
      });
  }

  const handleDeleteRoom = () => {
    if (!window.confirm('Tem certeza que deseja deletar esta sala? Esta ação não pode ser desfeita.')) {
      return;
    }
    api.delete(`/room/${id}`)
      .then(() => {
        navigate('/dashboard');
      })
      .catch(error => {
        alert('Erro ao deletar sala: ' + error.response?.data?.message);
      });
  }
  
  return (
    <ErrorBoundary>
      <Button variant="neutral" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Voltar
      </Button>
      <div className={styles.mainDiv}>
          <div className={styles.block}>
            <h2>Informações da sala</h2>
            <div className={styles.roomInfoDiv}>
              <p><strong>Nome:</strong> {room.name}</p>
              <p><strong>Dono:</strong> {room.owner.username}</p>
              <p><strong>Privacidade:</strong> {room.isPrivate ? 'Privada' : 'Pública'}</p>
              <p><strong>Criada em:</strong> {new Date(room.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className={styles.block}>
            <h2>Participantes da sala</h2>
            <p>total: {room.participants.length}</p>
            <div className={styles.participantsList}>
              {room.participants.map(participant => (
                <div key={participant._id} className={styles.participantDiv}>
                  <p>{participant.username} {user!._id == participant._id ? <strong>(Você)</strong>: ''}</p>
                  {isOnwer && (
                    <Button variant="danger" onClick={() => removeParticipant(participant._id)}><IoIosRemoveCircle /> Remover da sala</Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.block}>
            <h2>Opções da sala</h2>
            <div className={styles.roomOptionsDiv}>
              <Button variant="danger" onClick={handleLeaveRoom}><IoMdExit /> Sair da sala</Button>
              {isOnwer && (
                <>
                  <Button variant="warning" onClick={() => setShowEditRoomModal(true)}>
                    <FaEdit /> Editar sala
                  </Button>
                  <Button variant="danger" onClick={handleDeleteRoom}><FaTrashAlt /> Deletar sala</Button>
                </>
              )}
            </div>
          </div>
      </div>
      {/* Edit Room Modal */}
      {showEditRoomModal && (
        <Modal onClose={() => setShowEditRoomModal(false)}>
          <h2>Editar sala</h2>
          <form onSubmit={handleEditRoom}>
            <label>Novo nome da sala:</label>
            <input type="text" required name='roomName' onChange={handleRoomChange}/>
            <div className={modalStyles.actions}>
              <Button variant="danger" type="button" onClick={() => setShowEditRoomModal(false)}>Cancelar</Button>
              <Button variant="success" type="submit">Alterar</Button>
            </div>
          </form>
        </Modal>
      )}
    </ErrorBoundary>
  )
}

export default RoomInfo