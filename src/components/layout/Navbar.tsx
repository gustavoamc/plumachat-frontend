import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import styles from "./Navbar.module.css";
import logo from "../../assets/chat-icon.svg";

export const Navbar = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <Link to="/" className={styles.logoLink}>
          <img src={logo} alt="Logo do Pluma" />
          <span>Pluma</span>
        </Link>
        {isAuthenticated && (
          <>
            <Link to="/dashboard" className={styles.link}>
              Painel principal
            </Link>
          </>
        )}
      </div>
      <div className={styles.right}>
        {isAuthenticated &&
          (user?.role === "admin" || user?.role === "root") && (
            <Link to="/admin" className={styles.link}>
              Área da moderação
            </Link>
          )}
        {isAuthenticated ? (
          <Link to="/profile" className={styles.link}>
            Perfil
          </Link>
        ) : (
          <Link to="/login" className={styles.link}>
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
};
