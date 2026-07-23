import { useState, useEffect } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

/**
 * Matrícula em Turma Presencial — Novo Jeito Academy
 * O aluno escolhe UMA turma (que já tem uma grade inteira de encontros,
 * cada um com assunto/data próprios). No fim de cada aula, o professor
 * exibe um QR diferente pra aquele encontro — o aluno escaneia com o
 * próprio celular (já logado) e a presença é confirmada na hora.
 *
 * Se o aluno já estiver matriculado em alguma turma, mostra direto a
 * grade completa com o status de presença de cada encontro (sem deixar
 * escolher outra).
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

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
        }
      } catch (e) {
        console.error("Falha ao checar turma existente", e);
      } finally {
        setCheckingExisting(false);
      }
    }
    checkExisting();
  }, []);

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
      const turmaEscolhida = turmas.find((t) => t.id === turmaId);
      if (turmaEscolhida) setMinhaTurma(turmaEscolhida);
    } catch (e: any) {
      setError(e.message || "Não foi possível se matricular nessa turma.");
    } finally {
      setJoining(false);
    }
  }

  async function handleLogout() {
    if (!window.confirm("Sair da sua área do aluno?")) return;
    await signOut(auth);
    window.location.href = "/login";
  }

  function formatDate(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  }

  // ---------- conteúdo interno, conforme o estado ----------
  let content;

  if (checkingExisting) {
    content = <p style={styles.p}>Carregando...</p>;
  } else if (minhaTurma) {
    const hoje = new Date().toISOString().split("T")[0];

    content = (
      <>
        <div style={{ marginBottom: "1.6rem" }}>
          <div style={styles.eyebrow}>SUA TURMA</div>
          <h2 style={styles.h2}>{minhaTurma.nome}</h2>
          <p style={styles.p}>No fim de cada aula, o professor mostra um QR Code na tela — escaneia com o celular (com você logado) pra confirmar sua presença.</p>
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
      </>
    );
  } else {
    content = (
      <>
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
      </>
    );
  }

  // ---------- wrapper de página, sempre igual (fundo, barra de volta) ----------
  return (
    <div style={styles.outerWrap}>
      <header style={styles.topbar}>
        <a href="/aluno" style={styles.topbarLink}>← Voltar pra área do aluno</a>
        <button style={{ ...styles.topbarLink, color: "#e8746a" }} onClick={handleLogout}>⏻ Sair</button>
      </header>
      <div style={styles.pageBody}>
        <div style={styles.wrap}>{content}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerWrap: { minHeight: "100vh", background: "#050505" },
  topbar: { position: "sticky", top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.6rem", background: "rgba(5,5,5,.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(197,138,74,.18)" },
  topbarLink: { background: "none", border: "none", color: "#c9c2b4", fontSize: "0.82rem", cursor: "pointer", textDecoration: "none", fontFamily: "'Inter',sans-serif" },
  pageBody: { display: "flex", justifyContent: "center", padding: "2.4rem 1.5rem" },

  wrap: { maxWidth: 600, width: "100%", fontFamily: "'Inter',sans-serif", color: "#F5F0E8" },
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
};
