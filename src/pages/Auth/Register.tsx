import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import styles from './Login.module.css'
import { useNavigate } from 'react-router-dom';

function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [registerInfo, setRegisterInfo] = useState({
    username: '',
    email: '',
    password: '',
    inviteCode: ''
  })

  function handleChange(e: any) {
    setRegisterInfo({ ...registerInfo, [e.target.name]: e.target.value })
  }

  function handleRegister(e: any) {
    e.preventDefault();

    console.log('Register')

    api.post('/register', registerInfo).then((response) => {
      const {token, user} = response.data

      login(token, user)

      navigate('/dashboard', {replace: true})
    }).catch((error) => {
      console.log(error)
      alert(error?.response?.data?.message || 'Erro ao criar conta!')
    })
  }

  return (
    <div className={styles.login}>
      <h1>Crie uma conta para começar</h1>
      <br />
      <form onSubmit={handleRegister}>
        <div className={styles.inputs}>
          <label htmlFor="username">Nome de usuário/Apelido:</label>
          <input type="username" name="username" id="username" onChange={handleChange} />
        </div>
        <div className={styles.inputs}>
          <label htmlFor="email">Email:</label>
          <input type="email" name="email" id="email" onChange={handleChange} />
        </div>
        <div className={styles.inputs}>
          <label htmlFor="password">Senha:</label>
          <input type="password" name="password" id="password" onChange={handleChange} />
        </div>
        <div className={styles.inputs}>
          <label htmlFor="inviteCode">Chave de convite:</label>
          <input type="text" name="inviteCode" id="inviteCode" onChange={handleChange} />
        </div>
        <div className={styles.inputs}>
          <button type='submit'>Criar Conta</button>
        </div>
      </form>
      <p>Já tem uma conta ? <a href="/login">Faça login!</a></p>
    </div>
  )
}

export default Register
