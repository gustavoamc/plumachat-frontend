import { useEffect, useRef, useState } from "react";
import api from "../../../utils/api";
import styles from "./Grid.module.css";
import { Button } from "../../../components/ui/Button";

interface InviteKey {
  _id: string;
  code: string;
  used: boolean;
  usedBy?: { username: string; email: string } | null;
  usedAt?: string | null;
  expiresAt: string;
  note?: string;
  createdAt: string;
}

export default function InviteKeys() {
  const [keys, setKeys] = useState<InviteKey[]>([]);
  const [amount, setAmount] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [note, setNote] = useState("");
  const isFetched = useRef(false);

  const fetchKeys = () => {
    api
      .get("/invite")
      .then((res) => setKeys(res.data))
      .catch((error) => console.log("Erro: " + error));
  };

  useEffect(() => {
    if (isFetched.current) return;
    isFetched.current = true;
    fetchKeys();
  }, []);

  const handleCreate = (e: any) => {
    e.preventDefault();

    api
      .post("/invite", { amount, expiresInDays, note: note || undefined })
      .then((response) => {
        alert(response.data.message);
        setNote("");
        setKeys((prev) => [...response.data.keys, ...prev]);
      })
      .catch((error) => {
        alert(error?.response?.data?.message || "Erro ao criar chave(s).");
        console.log("Erro: " + error);
      });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Confirma remover esta chave de convite ?")) return;

    api
      .delete(`/invite/${id}`)
      .then((response) => {
        alert(response.data.message);
        setKeys((prev) => prev.filter((key) => key._id !== id));
      })
      .catch((error) => {
        alert(error?.response?.data?.message || "Erro ao remover chave.");
        console.log("Erro: " + error);
      });
  };

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
  };

  const formatDate = (stringDate: string) =>
    new Date(stringDate).toLocaleString();

  const isExpired = (key: InviteKey) =>
    !key.used && new Date(key.expiresAt).getTime() < Date.now();

  return (
    <div>
      <form className={styles.filterBar} onSubmit={handleCreate}>
        <div className={styles.orderButtonsDiv}>
          <label htmlFor="amount">Quantidade:</label>
          <input
            type="number"
            id="amount"
            min={1}
            max={50}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className={styles.searchBar}
            style={{ maxWidth: "5rem" }}
          />
          <label htmlFor="expiresInDays">Expira em (dias):</label>
          <input
            type="number"
            id="expiresInDays"
            min={1}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            className={styles.searchBar}
            style={{ maxWidth: "6rem" }}
          />
        </div>
        <input
          type="text"
          placeholder="Anotação (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={styles.searchBar}
        />
        <Button type="submit" variant="success">
          Gerar chave(s)
        </Button>
      </form>

      <ul className={styles.userList}>
        {keys.map((key) => (
          <li key={key._id} className={styles.userItem}>
            <div className={styles.infoDiv}>
              <p>
                <span className={styles.boldSpan}>Código: </span>
                {key.code}
              </p>
              <p>
                <span className={styles.boldSpan}>Status: </span>
                {key.used
                  ? `Usada por ${key.usedBy?.username ?? "?"}`
                  : isExpired(key)
                  ? "Expirada"
                  : "Disponível"}
              </p>
              <p>
                <span className={styles.boldSpan}>Expira em: </span>
                {formatDate(key.expiresAt)}
              </p>
              {key.note && (
                <p>
                  <span className={styles.boldSpan}>Anotação: </span>
                  {key.note}
                </p>
              )}
            </div>
            <div className={styles.orderButtonsDiv}>
              {!key.used && (
                <Button variant="info" onClick={() => handleCopy(key.code)}>
                  📋 Copiar
                </Button>
              )}
              {!key.used && (
                <Button variant="danger" onClick={() => handleDelete(key._id)}>
                  🗑️ Remover
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
