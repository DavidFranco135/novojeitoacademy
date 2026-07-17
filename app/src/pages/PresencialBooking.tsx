import { useState, useEffect } from "react";

/**
 * Matrícula em Turma Presencial — Novo Jeito Academy
 * O aluno escolhe UMA turma (que já tem uma grade inteira de encontros,
 * cada um com assunto/data próprios) e recebe UM QR pessoal, usado em
 * todos os encontros — o sistema identifica sozinho qual dia é "hoje".
 */

const GOLD = "#C58A4A";
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";

interface Encontro {
  topico: string;
  data: string;
  horario: string;
  local: string;
}

interface Turma {
  id: string;
  nome: string;
  vagasTotal: number;
  vagasOcupadas: number;
  encontros: Encontro[];
}

export default function PresencialBooking({ enrollmentId }: { enrollmentId: string }) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${FUNCTIONS_BASE}/listTurmas`)
      .then((r) => r.json())
      .then((data) => setTurmas(data.turmas || []))
      .catch(() => setError("Não foi possível carregar as turmas disponíveis."))
      .finally(() => setLoading(false));
  }, []);

  async function handleJoin(turmaId: string) {
    setJoining(true);
    setError("");
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/joinTurma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, turmaId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao se matricular");
      setCheckinUrl(json.checkinUrl);
    } catch (e: any) {
      setError(e.message || "Não foi possível se matricular nessa turma.");
    } finally {
      setJoining(false);
    }
  }

  if (checkinUrl) {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=C58A4A&bgcolor=050505&data=${encodeURIComponent(checkinUrl)}`;
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.eyebrow}>MATRÍCULA CONFIRMADA</div>
          <h2 style={styles.h2}>Seu QR de presença</h2>
          <p style={styles.p}>
            Use este mesmo código em <strong>todos os encontros</strong> da sua turma. O sistema
            identifica sozinho qual aula é a de hoje e confirma sua presença nela.
          </p>

          <div style={styles.qrFrame}>
            <div style={styles.corner_tl}></div><div style={styles.corner_tr}></div>
            <div style={styles.corner_bl}></div><div style={styles.corner_br}></div>
            <img src={qrImageUrl} alt="QR Code de presença" style={{ width: "100%", display: "block" }} />
          </div>

          <p style={styles.hint}>Dica: tire um print ou salve esta tela — você pode acessá-la de novo quando quiser em "Minha turma".</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={{ marginBottom: "1.6rem" }}>
        <div style={styles.eyebrow}>MÓDULO PRÁTICO</div>
        <h2 style={styles.h2}>Escolha sua turma presencial</h2>
        <p style={styles.p}>Cada turma tem sua própria grade de encontros, com assuntos diferentes em cada aula. Escolha a que melhor encaixa na sua agenda.</p>
      </div>

      {loading && <p style={styles.p}>Carregando turmas...</p>}
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.turmaList}>
        {turmas.map((t) => {
          const vagasRestantes = t.vagasTotal - t.vagasOcupadas;
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} style={styles.turmaCard}>
              <div style={styles.turmaHeader} onClick={() => setExpandedId(isExpanded ? null : t.id)}>
                <div>
                  <div style={styles.turmaNome}>{t.nome}</div>
                  <div style={styles.turmaMeta}>{t.encontros.length} encontros · {vagasRestantes} {vagasRestantes === 1 ? "vaga restante" : "vagas restantes"}</div>
                </div>
                <span style={{ color: GOLD, fontSize: "1.1rem" }}>{isExpanded ? "−" : "+"}</span>
              </div>

              {isExpanded && (
                <div style={styles.encontrosList}>
                  {t.encontros.map((e, i) => (
                    <div key={i} style={styles.encontroRow}>
                      <span style={styles.encontroData}>{formatDate(e.data)} · {e.horario}</span>
                      <span style={styles.encontroTopico}>{e.topico}</span>
                    </div>
                  ))}
                  <button style={styles.btnPrimary} disabled={joining} onClick={() => handleJoin(t.id)}>
                    {joining ? "Matriculando..." : "Matricular nessa turma"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!loading && turmas.length === 0 && (
          <p style={styles.p}>Nenhuma turma com vaga disponível no momento. Novas turmas são adicionadas periodicamente.</p>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 600, fontFamily: "'Inter',sans-serif", color: "#F5F0E8" },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: GOLD, marginBottom: "0.4rem" },
  h2: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", marginBottom: "0.5rem" },
  p: { fontSize: "0.88rem", color: "#9d9384", lineHeight: 1.6 },
  error: { color: "#e8746a", fontSize: "0.85rem", margin: "0.6rem 0" },

  turmaList: { display: "flex", flexDirection: "column", gap: "0.8rem" },
  turmaCard: { border: "1px solid rgba(197,138,74,.2)", borderRadius: 6, background: "linear-gradient(160deg,#0d0d0d,#050505)", overflow: "hidden" },
  turmaHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 1.3rem", cursor: "pointer" },
  turmaNome: { fontWeight: 600, fontSize: "0.95rem" },
  turmaMeta: { fontFamily: "'Space Mono',monospace", fontSize: "0.7rem", color: GOLD, marginTop: "0.3rem" },

  encontrosList: { padding: "0 1.3rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.5rem" },
  encontroRow: { display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.82rem", padding: "0.5rem 0", borderTop: "1px solid rgba(197,138,74,.1)" },
  encontroData: { fontFamily: "'Space Mono',monospace", color: "#9d9384", whiteSpace: "nowrap" },
  encontroTopico: { color: "#c9c2b4", textAlign: "right" },

  btnPrimary: { background: GOLD, color: "#050505", border: "none", padding: "0.8rem 1.3rem", borderRadius: 4, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", marginTop: "0.6rem" },

  card: { border: "1px solid rgba(197,138,74,.22)", borderRadius: 8, padding: "2.2rem", textAlign: "center", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  qrFrame: { position: "relative", width: 280, margin: "1.8rem auto", border: "1px solid rgba(197,138,74,.3)", borderRadius: 6, padding: "10px", background: "#050505" },
  corner_tl: { position: "absolute", top: 6, left: 6, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_tr: { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  corner_bl: { position: "absolute", bottom: 6, left: 6, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_br: { position: "absolute", bottom: 6, right: 6, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  hint: { fontSize: "0.78rem", color: "#5a5348", marginTop: "1rem" },
};
