import { useState, useEffect } from "react";

/**
 * Agendamento de Aula Presencial — Novo Jeito Academy
 * Aluno escolhe uma turma com vaga disponível e recebe um QR Code pessoal
 * pra apresentar/ser escaneado no dia do encontro presencial.
 */

const GOLD = "#C58A4A";

// Base real das Firebase Functions (projeto: barbearia-do-ico)
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";

interface PresencialSession {
  id: string;
  date: string;
  time: string;
  location: string;
  vagasTotal: number;
  vagasOcupadas: number;
}

export default function PresencialBooking({ enrollmentId }: { enrollmentId: string }) {
  const [sessions, setSessions] = useState<PresencialSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${FUNCTIONS_BASE}/listPresencialSessions`)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => setError("Não foi possível carregar as turmas disponíveis."))
      .finally(() => setLoading(false));
  }, []);

  async function handleBook(sessionId: string) {
    setBooking(true);
    setError("");
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/bookPresencialSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, sessionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao reservar vaga");
      setCheckinUrl(json.checkinUrl);
    } catch (e: any) {
      setError(e.message || "Não foi possível reservar essa turma.");
    } finally {
      setBooking(false);
    }
  }

  // depois de reservar, mostra o QR pessoal (via serviço público de geração de QR, sem dependência)
  if (checkinUrl) {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=C58A4A&bgcolor=050505&data=${encodeURIComponent(checkinUrl)}`;
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.eyebrow}>VAGA CONFIRMADA</div>
          <h2 style={styles.h2}>Seu QR de check-in</h2>
          <p style={styles.p}>Apresente este código no dia da aula presencial. Ele será escaneado na entrada para confirmar sua presença.</p>

          <div style={styles.qrFrame}>
            <div style={styles.corner_tl}></div><div style={styles.corner_tr}></div>
            <div style={styles.corner_bl}></div><div style={styles.corner_br}></div>
            <img src={qrImageUrl} alt="QR Code de check-in" style={{ width: "100%", display: "block" }} />
          </div>

          <p style={styles.hint}>Dica: tire um print ou salve esta tela — você também pode acessá-la novamente em "Minhas turmas" a qualquer momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: "1.6rem" }}>
        <div style={styles.eyebrow}>MÓDULO PRÁTICO</div>
        <h2 style={styles.h2}>Escolha sua turma presencial</h2>
        <p style={styles.p}>Selecione a data e o horário que funcionam melhor pra você. As vagas são limitadas por turma.</p>
      </div>

      {loading && <p style={styles.p}>Carregando turmas...</p>}
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.sessionList}>
        {sessions.map((s) => {
          const vagasRestantes = s.vagasTotal - s.vagasOcupadas;
          return (
            <div key={s.id} style={styles.sessionCard}>
              <div>
                <div style={styles.sessionDate}>{formatDate(s.date)} · {s.time}</div>
                <div style={styles.sessionLocation}>{s.location}</div>
                <div style={styles.sessionVagas}>{vagasRestantes} {vagasRestantes === 1 ? "vaga restante" : "vagas restantes"}</div>
              </div>
              <button style={styles.btnPrimary} disabled={booking} onClick={() => handleBook(s.id)}>
                {booking ? "Reservando..." : "Reservar vaga"}
              </button>
            </div>
          );
        })}
        {!loading && sessions.length === 0 && (
          <p style={styles.p}>Nenhuma turma com vaga disponível no momento. Novas datas são adicionadas periodicamente.</p>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 560, fontFamily: "'Inter',sans-serif", color: "#F5F0E8" },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: GOLD, marginBottom: "0.4rem" },
  h2: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", marginBottom: "0.5rem" },
  p: { fontSize: "0.88rem", color: "#9d9384", lineHeight: 1.6 },
  error: { color: "#e8746a", fontSize: "0.85rem", margin: "0.6rem 0" },

  sessionList: { display: "flex", flexDirection: "column", gap: "0.8rem" },
  sessionCard: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(197,138,74,.2)", borderRadius: 6, padding: "1.1rem 1.3rem", background: "linear-gradient(160deg,#0d0d0d,#050505)", gap: "1rem", flexWrap: "wrap" },
  sessionDate: { fontWeight: 600, fontSize: "0.95rem" },
  sessionLocation: { fontSize: "0.8rem", color: "#9d9384", marginTop: "0.2rem" },
  sessionVagas: { fontFamily: "'Space Mono',monospace", fontSize: "0.7rem", color: GOLD, marginTop: "0.35rem" },
  btnPrimary: { background: GOLD, color: "#050505", border: "none", padding: "0.7rem 1.3rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" },

  card: { border: "1px solid rgba(197,138,74,.22)", borderRadius: 8, padding: "2.2rem", textAlign: "center", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  qrFrame: { position: "relative", width: 280, margin: "1.8rem auto", border: "1px solid rgba(197,138,74,.3)", borderRadius: 6, padding: "10px", background: "#050505" },
  corner_tl: { position: "absolute", top: 6, left: 6, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_tr: { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  corner_bl: { position: "absolute", bottom: 6, left: 6, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_br: { position: "absolute", bottom: 6, right: 6, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  hint: { fontSize: "0.78rem", color: "#5a5348", marginTop: "1rem" },
};
