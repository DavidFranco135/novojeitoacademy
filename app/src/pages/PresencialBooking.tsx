import { useState, useEffect } from "react";
import { auth } from "../firebase";

/**
 * Matrícula em Turma Presencial — Novo Jeito Academy
 * O aluno escolhe UMA turma (que já tem uma grade inteira de encontros,
 * cada um com assunto/data próprios) e recebe UM QR pessoal, usado em
 * todos os encontros — o sistema identifica sozinho qual dia é "hoje".
 *
 * Se o aluno já estiver matriculado em alguma turma, mostra direto a
 * grade completa + o QR dele (sem deixar escolher outra e sem perder a
 * visão das datas depois que ele já entrou).
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
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [minhaTurma, setMinhaTurma] = useState<Turma | null>(null);
  const [minhasPresencas, setMinhasPresencas] = useState<Record<string, boolean>>({});
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ao carregar, primeiro checa se o aluno JÁ está matriculado em alguma turma
  useEffect(() => {
    async function checkExisting() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setCheckingExisting(false);
        return;
      }
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/getMyTurma`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.turma) {
          setMinhaTurma(data.turma);
          setMinhasPresencas(data.presencas || {});
          setCheckinUrl(data.checkinUrl);
        }
      } catch (e) {
        console.error("Falha ao checar turma existente", e);
      } finally {
        setCheckingExisting(false);
      }
    }
    checkExisting();
  }, []);

  // só busca a lista de turmas disponíveis se o aluno AINDA não estiver matriculado em nenhuma
  useEffect(() => {
    if (checkingExisting || minhaTurma) return;
    fetch(`${FUNCTIONS_BASE}/listTurmas`)
      .then((r) => r.json())
      .then((data) => setTurmas(data.turmas || []))
      .catch(() => setError("Não foi possível carregar as turmas disponíveis."))
      .finally(() => setLoading(false));
  }, [checkingExisting, minhaTurma]);

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
      const turmaEscolhida = turmas.find((t) => t.id === turmaId);
      if (turmaEscolhida) setMinhaTurma(turmaEscolhida);
    } catch (e: any) {
      setError(e.message || "Não foi possível se matricular nessa turma.");
    } finally {
      setJoining(false);
    }
  }

  if (checkingExisting) {
    return <div style={styles.wrap}><p style={styles.p}>Carregando...</p></div>;
  }

  // ===== JÁ MATRICULADO: mostra a grade completa + o QR pessoal =====
  if (minhaTurma && checkinUrl) {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=C58A4A&bgcolor=050505&data=${encodeURIComponent(checkinUrl)}`;
    const hoje = new Date().toISOString().split("T")[0];

    return (
      <div style={styles.wrap}>
        <div style={{ marginBottom: "1.6rem" }}>
          <div style={styles.eyebrow}>SUA TURMA</div>
          <h2 style={styles.h2}>{minhaTurma.nome}</h2>
          <p style={styles.p}>Guarde essas datas — você usa o mesmo QR Code em todos os encontros.</p>
        </div>

        <div style={styles.gradeCard}>
          {minhaTurma.encontros.map((e, i) => {
            const confirmado = minhasPresencas[e.data];
            const isHoje = e.data === hoje;
            return (
              <div key={i} style={{ ...styles.gradeRow, borderColor: isHoje ? GOLD : "rgba(197,138,74,.1)" }}>
                <div>
                  <div style={styles.gradeData}>{formatDate(e.data)} · {e.horario}{isHoje ? " — HOJE" : ""}</div>
                  <div style={styles.gradeTopico}>{e.topico}</div>
                  <div style={styles.gradeLocal}>{e.local}</div>
                </div>
                <span style={{ color: confirmado ? "#78c88c" : "#5a5348", fontSize: "1.1rem" }}>{confirmado ? "✓" : "○"}</span>
              </div>
            );
          })}
        </div>

        <div style={{ ...styles.card, marginTop: "1.6rem" }}>
          <div style={styles.eyebrow}>SEU QR DE PRESENÇA</div>
          <div style={styles.qrFrame}>
            <div style={styles.corner_tl}></div><div style={styles.corner_tr}></div>
            <div style={styles.corner_bl}></div><div style={styles.corner_br}></div>
            <img src={qrImageUrl} alt="QR Code de presença" style={{ width: "100%", display: "block" }} />
          </div>
          <p style={styles.hint}>Mostre esse QR no dia de cada encontro — o sistema identifica sozinho qual aula é a de hoje.</p>
        </div>
      </div>
    );
  }

  // ===== AINDA NÃO MATRICULADO: escolher turma =====
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

  gradeCard: { border: "1px solid rgba(197,138,74,.2)", borderRadius: 6, background: "linear-gradient(160deg,#0d0d0d,#050505)", overflow: "hidden" },
  gradeRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.3rem", borderBottom: "1px solid" },
  gradeData: { fontFamily: "'Space Mono',monospace", fontSize: "0.72rem", color: GOLD },
  gradeTopico: { fontSize: "0.9rem", fontWeight: 600, marginTop: "0.25rem" },
  gradeLocal: { fontSize: "0.78rem", color: "#9d9384", marginTop: "0.15rem" },

  card: { border: "1px solid rgba(197,138,74,.22)", borderRadius: 8, padding: "2rem", textAlign: "center", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  qrFrame: { position: "relative", width: 240, margin: "1rem auto", border: "1px solid rgba(197,138,74,.3)", borderRadius: 6, padding: "10px", background: "#050505" },
  corner_tl: { position: "absolute", top: 6, left: 6, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_tr: { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  corner_bl: { position: "absolute", bottom: 6, left: 6, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_br: { position: "absolute", bottom: 6, right: 6, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  hint: { fontSize: "0.78rem", color: "#5a5348", marginTop: "1rem" },
};
