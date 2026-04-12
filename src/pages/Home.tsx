import { Link } from "react-router-dom";
import styles from "./Home.module.css";
import { useAuth } from "../hooks/useAuth";

function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className={styles.columns}>
      <div className={`${styles.lateralColumnDiv} ${styles.left}`}>
        <h2>Novidades:</h2>
        <p>
          Nenhuma, isso acabou de lançar. Vai ter bastante coisa escrita, tipo
          que o app trouxe de novo, mas em um resumo.
        </p>
      </div>
      <div className={styles.mainColumnDiv}>
        <h1 className={styles.mainTitle}>Pluma - Chat</h1>
        <h3>Bem-vindo!</h3>
        <div className={styles.container}>
          {isAuthenticated ? (
            <Link to="/dashboard" className={styles.button}>
              Ir para painel principal
            </Link>
          ) : (
            <>
              <h2>Entre ou Crie uma conta para começar!</h2>
              <br />
              <Link to="/login" className={styles.button}>
                Entrar
              </Link>
              <br />
              <h2>ou</h2>
              <br />
              <Link to="/register" className={styles.button}>
                Criar Conta
              </Link>
            </>
          )}
        </div>
        <h6>Todos os direitos reservados SitemTeam@2025</h6>
      </div>
      <div className={`${styles.lateralColumnDiv} ${styles.right}`}>
        <h2>Últimas Atualizações:</h2>
        <p>Nenhuma, isso acabou de lançar</p>
      </div>
    </div>
  );
}

export default Home;
