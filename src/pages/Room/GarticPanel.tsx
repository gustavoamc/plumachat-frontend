import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import styles from "./GarticPanel.module.css";

export interface GarticPlayer {
  id: string;
  username: string;
  score: number;
}

// Mirrors the server's gartic_state payload (see backend garticGame.ts).
export interface GarticState {
  phase: "lobby" | "drawing" | "reveal" | "results";
  round: number;
  totalRounds: number;
  drawerId: string | null;
  drawerName: string | null;
  deadline: number | null;
  wordLength: number | null;
  guessed: string[];
  players: GarticPlayer[];
  youAreDrawer: boolean;
  word: string | null;
}

interface GarticPanelProps {
  game: GarticState | null;
  isOwner: boolean;
  currentUserId: string;
  onStart: () => void;
  onGuess: (text: string) => void;
}

// Live countdown derived from the server's absolute deadline, so it stays
// accurate across reconnects (we don't trust per-second ticks).
function useCountdown(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline == null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  if (deadline == null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function Scoreboard({
  players,
  guessed,
  drawerId,
  currentUserId,
}: {
  players: GarticPlayer[];
  guessed: string[];
  drawerId: string | null;
  currentUserId: string;
}) {
  return (
    <ul className={styles.scoreboard}>
      {players.map((p) => (
        <li
          key={p.id}
          className={`${styles.scoreRow} ${p.id === currentUserId ? styles.you : ""}`}
        >
          <span className={styles.scoreName}>
            {p.id === drawerId && "✏️ "}
            {guessed.includes(p.id) && "✅ "}
            {p.username}
          </span>
          <span className={styles.scoreValue}>{p.score}</span>
        </li>
      ))}
    </ul>
  );
}

export function GarticPanel({
  game,
  isOwner,
  currentUserId,
  onStart,
  onGuess,
}: GarticPanelProps) {
  const [guess, setGuess] = useState("");
  const guessRef = useRef<HTMLInputElement>(null);
  const seconds = useCountdown(game?.deadline ?? null);

  // No active game yet → pre-game lobby.
  if (!game || game.phase === "lobby") {
    return (
      <div className={styles.panel}>
        <div className={styles.lobby}>
          <h3>🎨 Desenhe e adivinhe</h3>
          {isOwner ? (
            <>
              <p>Inicie a partida quando todos estiverem prontos (mín. 2 jogadores).</p>
              <Button variant="success" onClick={onStart}>
                Iniciar jogo
              </Button>
            </>
          ) : (
            <p>Aguardando o dono da sala iniciar a partida…</p>
          )}
        </div>
      </div>
    );
  }

  // Final scoreboard.
  if (game.phase === "results") {
    const winner = game.players[0]; // server sends players sorted by score desc
    return (
      <div className={styles.panel}>
        <div className={styles.lobby}>
          <h3>🏁 Fim de jogo!</h3>
          {winner && (
            <p className={styles.winner}>
              🏆 Vencedor: <strong>{winner.username}</strong> ({winner.score} pts)
            </p>
          )}
          <Scoreboard
            players={game.players}
            guessed={[]}
            drawerId={null}
            currentUserId={currentUserId}
          />
          {isOwner ? (
            <Button variant="success" onClick={onStart}>
              Jogar novamente
            </Button>
          ) : (
            <p>Aguardando o dono iniciar uma nova partida…</p>
          )}
        </div>
      </div>
    );
  }

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const text = guess.trim();
    if (!text) return;
    onGuess(text);
    setGuess("");
  };

  const alreadyGuessed = game.guessed.includes(currentUserId);

  return (
    <div className={styles.panel}>
      <div className={styles.hud}>
        <span className={styles.round}>
          Rodada {game.round}/{game.totalRounds}
        </span>
        <span className={styles.timer}>⏱ {seconds}s</span>
        <span className={styles.drawer}>
          {game.youAreDrawer
            ? "Você está desenhando!"
            : `Desenhando: ${game.drawerName ?? "—"}`}
        </span>
      </div>

      {game.phase === "drawing" && (
        <div className={styles.wordRow}>
          {game.youAreDrawer ? (
            <span className={styles.word}>
              Desenhe: <strong>{game.word}</strong>
            </span>
          ) : (
            <span className={styles.wordMask}>
              {Array.from({ length: game.wordLength ?? 0 })
                .map(() => "_")
                .join(" ")}
              <em> ({game.wordLength ?? 0} letras)</em>
            </span>
          )}
        </div>
      )}

      {game.phase === "reveal" && (
        <div className={styles.wordRow}>
          <span className={styles.word}>
            A palavra era: <strong>{game.word}</strong>
          </span>
        </div>
      )}

      {game.phase === "drawing" && !game.youAreDrawer && (
        <form className={styles.guessForm} onSubmit={submitGuess}>
          <input
            ref={guessRef}
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={alreadyGuessed ? "Você acertou! 🎉" : "Digite seu palpite…"}
            disabled={alreadyGuessed}
          />
          <Button variant="primary" type="submit" disabled={alreadyGuessed}>
            Palpitar
          </Button>
        </form>
      )}

      <Scoreboard
        players={game.players}
        guessed={game.guessed}
        drawerId={game.drawerId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
