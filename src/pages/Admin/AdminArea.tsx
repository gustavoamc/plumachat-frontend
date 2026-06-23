import { useAuth } from "../../hooks/useAuth";
import { useState } from "react";
import styles from "./AdminArea.module.css";
import UsersList from "./AdminAreaTabs/UsersList";
import AdminPromote from "./AdminAreaTabs/AdminPromote";
import InviteKeys from "./AdminAreaTabs/InviteKeys";
import { ErrorBoundary } from "../../components/routes/ErrorBoundary";

export default function AdminArea() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("users");

  const isRoot = user?.role === "root";

  return (
    <div className={styles.wrapper}>
      <h1>Área da moderação</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabButton} ${activeTab === "users" ? styles.active : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Usuários
        </button>

        {isRoot && (
          <button
            className={`${styles.tabButton} ${activeTab === "promote" ? styles.active : ""}`}
            onClick={() => setActiveTab("promote")}
          >
            Gerenciar Admins
          </button>
        )}

        <button
          className={`${styles.tabButton} ${activeTab === "invites" ? styles.active : ""}`}
          onClick={() => setActiveTab("invites")}
        >
          Chaves de Convite
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === "users" && 
          <ErrorBoundary>
            <UsersList />
          </ErrorBoundary>
        }
        {activeTab === "promote" && isRoot &&
          <ErrorBoundary>
            <AdminPromote />
          </ErrorBoundary>
        }
        {activeTab === "invites" &&
          <ErrorBoundary>
            <InviteKeys />
          </ErrorBoundary>
        }
      </div>
    </div>
  );
}
