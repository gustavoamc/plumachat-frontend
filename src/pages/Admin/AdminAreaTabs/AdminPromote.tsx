import { useEffect, useRef, useState } from "react";
import api from "../../../utils/api"
import styles from "./Grid.module.css";
import { FaSortAlphaDown, FaSortAlphaUp } from "react-icons/fa";
import { Button } from '../../../components/ui/Button';

interface User {
  _id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

export default function AdminPromote() {
  const [defaultUsers, setDefaultUsers] = useState<User[]>([]); //for reseting sort or search
  const [users, setUsers] = useState<User[]>([]);
  const isFetched = useRef(false);

  useEffect(() => {
    if (isFetched.current) return;
    isFetched.current = true;

    api.get("/admin/users?isBanned=false") // fetch only non banned users
      .then(res => {
        setUsers(res.data)
        setDefaultUsers(res.data)
      })
      .catch(((error) => {
        console.log("Erro: " + error)
      }))
  }, []);

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

  const handlePromote = (id: string) => {
    const confirmation = confirm('Confirma promover o usuário para admin ?')

    if (!confirmation) {
      return;
    }

    api.patch(`/admin/promote/${id}`)
      .then((response) => {
        alert(response.data.message);
        setUsers(prev => prev.map(user => user._id === id ? { ...user, role: "admin" } : user));
        setDefaultUsers(prev => prev.map(user => user._id === id ? { ...user, role: "admin" } : user));
      })
      .catch((error) => {
        alert(error)
        console.log('Erro: ' + error);
      })
  };

  const handleDemote = (id: string) => {
    const confirmation = confirm('Confirma remover o usuário de admin ?')

    if (!confirmation) {
      return;
    }
    
    api.patch(`/admin/demote/${id}`)
      .then((response) => {
        alert(response.data.message);
        setUsers(prev => prev.map(user => user._id === id ? { ...user, role: "user" } : user));
        setDefaultUsers(prev => prev.map(user => user._id === id ? { ...user, role: "user" } : user));
      })
      .catch((error) => {
        alert(error);
        console.log('Erro: ' + error);
      })
  };

  return (
    <div>
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
      <ul className={styles.userList}>
        {users.map(user => (
          <li key={user._id} className={styles.userItem}>
            <div className={styles.infoDiv}>
              <p><span className={styles.boldSpan}>Id de usuário: </span>{user._id}</p>
              <p><span className={styles.boldSpan}>Nome de usuário: </span>{user.username}</p>
              <p><span className={styles.boldSpan}>Email: </span>{user.email}</p>
              <p><span className={styles.boldSpan}>Conta criada em: </span>{formatDate(user.createdAt)}</p>
            </div>
            {user.role === "user" ? (
              <Button variant="info" onClick={() => handlePromote(user._id)}>
                🔼 Promover a Admin
              </Button>
            ) : (
              <Button variant="danger" onClick={() => handleDemote(user._id)}>
                🔽 Rebaixar para User
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
