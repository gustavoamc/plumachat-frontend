import { useEffect, useRef, useState } from 'react';
import styles from './Grid.module.css'
import api from '../../../utils/api';
import { FaSortAlphaDown, FaSortAlphaUp } from 'react-icons/fa';
import { Modal, modalStyles } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

interface User {
  _id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  isBanned: boolean;
  banReason: string;
  banUntil: string;
  createdAt: string;
  updatedAt: string;
}

export const defaultUser: User = {
  _id: '',
  username: '',
  email: '',
  role: 'user',
  isBanned: false,
  banReason: '',
  banUntil: '',
  createdAt: '',
  updatedAt: '',
};


function UsersList() {
  const [defaultUsers, setDefaultUsers] = useState<User[]>([]); //for reseting sort or search
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User>(defaultUser);
  const [banReason, setBanReason] = useState('');
  const [banUntil, setBanUntil] = useState('');
  const [openBanModal, setOpenBanModal] = useState(false);
  const isFetched = useRef(false);

  useEffect(() => {
    if (isFetched.current) return;
    isFetched.current = true;

    api.get("/admin/users") // fetch only "user" and "admin"
      .then(res => {
        setUsers(res.data)
        setDefaultUsers(res.data)
        setSelectedUser(res.data[0])
      })
      .catch(((error) => {
        console.log("Erro: " + error)
      }))
  }, []);

  const handleBan = (id: string) => {
    console.log('ban')

    api.patch(`/admin/ban/${id}`, {
      banReason,
      banUntil
    }).then((response) => {
      alert(response.data.message);
      setUsers(prev => prev.map(user => user._id === id ? { ...user, isBanned: true, banReason, banUntil } : user));
      setDefaultUsers(prev => prev.map(user => user._id === id ? { ...user, isBanned: true, banReason, banUntil } : user));
      setSelectedUser(prev => ({...prev, isBanned: true, banReason, banUntil}))
      setOpenBanModal(false);
    }).catch((error) => {
      alert('Erro: ' + error.message)
    })
  }

  const handleUnban = (id: string) => {
    const confirmation = confirm('Confirma a retirada do ban deste usuário ?')
    
    if(!confirmation){
      return
    }
    console.log('unban')

    api.patch(`/admin/unban/${id}`)
    .then((response) => {
      alert(response.data.message);
      setUsers(prev => prev.map(user => user._id === id ? { ...user, isBanned: false, banReason: '', banUntil: ''} : user));
      setDefaultUsers(prev => prev.map(user => user._id === id ? { ...user, isBanned: false, banReason: '', banUntil: '' } : user));
      setSelectedUser(prev => ({...prev, isBanned: false, banReason:'', banUntil:''}));
      setBanReason('');
      setBanUntil('');
    }).catch((error) => {
      alert('Erro: ' + error.message)
    })
  }

  const handleSearch = (e: any) => {
    const { name, value } = e.target;
    if (name === 'search' && value !== ''){
      setUsers(users.filter(user => 
        user.username.toLowerCase().includes(value.toLowerCase()) ||
        user.email.includes(value)
      )
    );
    } else {
      setUsers(defaultUsers)
    }
  }

  const handleSort = (filter: string) => {
    switch (filter) {
      case 'nameSortAZ':
        setUsers(
          [...users].sort((a, b) =>
            a.username.toLowerCase().localeCompare(b.username.toLowerCase())
          )
        );
        break;

      case 'nameSortZA':
        setUsers(
          [...users].sort((a, b) =>
            b.username.toLowerCase().localeCompare(a.username.toLowerCase())
          )
        );
        break;

      case 'creationSortAsc':
        setUsers(
          [...users].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        );
        break;

      case 'creationSortDesc':
        setUsers(
          [...users].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        break;
      case 'role':
        setUsers(
          [...users].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        break;

      default:
        break;
    }
  }

  const formatDate = (stringDate: string) => {
    let date = new Date(stringDate);
    return date.toLocaleDateString();
  }

  return (
    <div className={styles.gridContainer}>
      <div className={styles.leftColumn}>
        <div className={styles.filterBar}>
          <input type="text" name="search" placeholder="Buscar nome de usuário ou email" className={styles.searchBar} onChange={handleSearch}/>
          <div className={styles.orderButtonsDiv}>
            <h2>Ordenar por:</h2>
            <button className={styles.sortButton} name="nameSortAZ" onClick={() => handleSort("nameSortAZ")}>
              <FaSortAlphaDown />
            </button>
            <button className={styles.sortButton} name="nameSortZA" onClick={() => handleSort("nameSortZA")}>
              <FaSortAlphaUp />
            </button>
            <button className={styles.sortButton} name="creationSortAsc" onClick={() => handleSort("creationSortAsc")}>
              Mais Antigo
            </button>
            <button className={styles.sortButton} name="creationSortDesc" onClick={() => handleSort("creationSortDesc")}>
              Mais Recente
            </button>
            <button className={styles.sortButton} name="role" onClick={() => handleSort("role")}>
              Função
            </button>
          </div>
        </div>
        <span className={styles.boldSpan}>Quantidade de usuários: {users.length}, sendo {users.reduce((acc, user) => user.role == 'admin' ? acc + 1 : acc + 0, 0)} Administradores.</span>
        {users.map((user, i) => (
          <li key={user._id} className={styles.userItem} onClick={() => setSelectedUser(user)}>
            <div className={styles.infoDiv}>
              <p><span className={styles.boldSpan}>{i + 1 + ' -'}</span></p>
              <p><span className={styles.boldSpan}>Id de usuário: </span>{user._id}</p>
              <p><span className={styles.boldSpan}>Nome de usuário: </span>{user.username}</p>
              <p><span className={styles.boldSpan}>Email: </span>{user.email}</p>
              <p><span className={styles.boldSpan}>Função: </span>{user.role}</p>
            </div>
          </li>
        ))}
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.rightColumnHeader}>
          <h2>Detalhes do Usuário</h2>
          <p><span className={styles.boldSpan}>Email: </span> {selectedUser.email}</p>
          <p><span className={styles.boldSpan}>Role: </span> {selectedUser.role}</p>
          <p><span className={styles.boldSpan}>Criado em: </span> {formatDate(selectedUser.createdAt ?? '')}</p>
          <p><span className={styles.boldSpan}>Última atualização em: </span> {formatDate(selectedUser.updatedAt ?? '')}</p>
          <p><span className={styles.boldSpan}>Status: </span> {selectedUser.isBanned ? 'Banido' : 'Em atividade'}</p>
          <p><span className={styles.boldSpan}>Motivo do Banimento: </span> {selectedUser.banReason ? selectedUser.banReason : '---'}</p>
          <p><span className={styles.boldSpan}>Banido até: </span> {selectedUser.banUntil ? formatDate(selectedUser.banUntil) : '---'}</p>
        </div>

        <div className={styles.actionsButtons}>
          {selectedUser.isBanned ?
            <Button variant="success" onClick={() => handleUnban(selectedUser._id)}>Desbanir</Button>
            :
            <Button variant="danger" onClick={() => setOpenBanModal(true)}>Banir</Button>
          }
        </div>
      </div>

      {/* MODAL */}
      {openBanModal && (
        <Modal onClose={() => setOpenBanModal(false)}>
          <h3>Banir Usuário</h3>
          <p>Motivo do banimento:</p>
          <input
            type="text"
            placeholder="Ex.: Quebrou as regras de conduta"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
          />
          <p>Banir até:</p>
          <input
            type="date"
            value={banUntil}
            onChange={(e) => setBanUntil(e.target.value)}
          />
          <div className={modalStyles.actions}>
            <Button variant="neutral" onClick={() => setOpenBanModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => handleBan(selectedUser._id)}>Confirmar Ban</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default UsersList;
