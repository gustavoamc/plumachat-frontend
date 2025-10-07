import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './Login.module.css'
import api from '../../utils/api';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate()
  const [loginInfo, setLoginInfo] = useState({
    email: '',
    password: ''
  })

  function handleChange(e: any) {
    setLoginInfo({ ...loginInfo, [e.target.name]: e.target.value })
  }

  function handleLogin(e: any) {
    e.preventDefault();

    if (loginInfo.email === '' || loginInfo.password === '') {
      alert('Preencha todos os campos!')
      return;
    }

    api.post('/login', loginInfo)
    .then((response) => {
      const {token, user} = response.data

      login(token, user)

      navigate('/dashboard', {replace: true})
    }).catch((error) => {
      console.log(error)
      alert('Erro ao fazer login! \n' + error.response.data.message)
    })
  }

  return (
    <div className={styles.login}>
      <h1>Entre para começar</h1>
      <br />
      <form onSubmit={handleLogin}>
        <div className={styles.inputs}>
          <label htmlFor="email">Email:</label>
          <input type="email" name="email" id="email" onChange={handleChange} />
        </div>
        <div className={styles.inputs}>
          <label htmlFor="password">Senha:</label>
          <input type="password" name="password" id="password" onChange={handleChange} />
        </div>
        <div className={styles.inputs}>
          <button className={styles.button} type='submit'>Entrar</button>
        </div>
      </form>
      <p>Não tem uma conta ? <Link to="/register">Crie uma!</Link></p>
    </div>
  )
}

export default Login
