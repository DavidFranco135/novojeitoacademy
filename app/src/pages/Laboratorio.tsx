import { useState, useEffect } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

/**
 * Laboratório Novo Jeito — Área do Aluno
 * O "Módulo 7" da grade: depois de dominar a técnica, o aluno atende modelos
 * reais (bonecos -> colegas/família -> clientes voluntários), sempre com foto
 * antes/depois e avaliação do professor. Aqui o aluno:
 *  - Registra um atendimento novo (ou completa um horário já agendado pelo admin)
 *  - Vê o histórico de tudo que já fez, com a nota do professor quando sair
 *  - Acompanha a própria Carteira Profissional (estatísticas + melhores trabalhos)
 */

const GOLD = "#C58A4A";
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";

const SERVICOS_DISPONIVEIS = ["Corte", "Degradê", "Barba", "Tesoura", "Sobrancelha", "Outro"];
const CATEGORIAS_AVALIACAO: { key: string; label: string }[] = [
  { key: "tecnica", label: "Técnica" },
  { key: "degrade", label: "Degradê" },
  { key: "tesoura", label: "Tesoura" },
  { key: "barba", label: "Barba" },
  { key: "atendimento", label: "Atendimento" },
  { key: "higiene", label: "Higiene" },
];

interface Atendimento {
  id: string;
  modeloNome: string;
  servicos: string[];
  fotoAntes: string | null;
  fotoDepois: string | null;
  status: "agendado" | "realizado" | "avaliado";
  dataAgendada: string;
  horarioAgendado: string;
  avaliacao: Record<string, number> | null;
  comentarioProfessor?: string;
}

interface Carteira {
  nome: string;
  horasEstudo: number;
  horasPraticas: number;
  modelosAtendidos: number;
  cortesRealizados: number;
  barbasRealizadas: number;
  degradesRealizados: number;
  notaMedia: number;
  mediasPorCategoria: Record<string, number>;
  melhoresTrabalhos: { fotoAntes: string; fotoDepois: string; modeloNome: string; media: number; servicos: string[]; data: string }[];
  avaliacoesRecebidas: number;
  percentCurso: number;
  certificateUrl: string | null;
  certificateCode: string | null;
  certificateIssuedAt: string | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadFoto(file: File): Promise<string> {
  const imageBase64 = await fileToBase64(file);
  const res = await fetch(`${FUNCTIONS_BASE}/uploadImage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, name: `laboratorio-${Date.now()}` }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Falha no upload da foto");
  return data.url as string;
}

export default function Laboratorio() {
  const [tab, setTab] = useState<"registrar" | "historico" | "carteira">("registrar");

  async function handleLogout() {
    if (!window.confirm("Sair da sua área do aluno?")) return;
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div style={styles.outerWrap}>
      <style>{`
        @media (max-width: 640px) {
          .lab-tabs { flex-wrap: wrap !important; }
          .lab-tabs button { flex: 1 1 auto !important; }
        }
      `}</style>
      <header style={styles.topbar}>
        <a href="/aluno" style={styles.topbarLink}>← Voltar pra área do aluno</a>
        <button style={{ ...styles.topbarLink, color: "#e8746a" }} onClick={handleLogout}>⏻ Sair</button>
      </header>
      <div style={styles.pageBody}>
        <div style={styles.wrap}>
          <div style={styles.eyebrow}>MÓDULO 7</div>
          <h2 style={styles.h2}>Laboratório Novo Jeito</h2>
          <p style={styles.p}>Registre seus atendimentos, acompanhe as avaliações do professor e veja sua Carteira Profissional evoluir.</p>

          <div style={styles.tabs} className="lab-tabs">
            <button onClick={() => setTab("registrar")} style={{ ...styles.tabBtn, ...(tab === "registrar" ? styles.tabBtnActive : {}) }}>Registrar atendimento</button>
            <button onClick={() => setTab("historico")} style={{ ...styles.tabBtn, ...(tab === "historico" ? styles.tabBtnActive : {}) }}>Meu histórico</button>
            <button onClick={() => setTab("carteira")} style={{ ...styles.tabBtn, ...(tab === "carteira" ? styles.tabBtnActive : {}) }}>Carteira Profissional</button>
          </div>

          {tab === "registrar" && <RegistrarAtendimento />}
          {tab === "historico" && <MeuHistorico />}
          {tab === "carteira" && <CarteiraProfissional />}
        </div>
      </div>
    </div>
  );
}

function RegistrarAtendimento() {
  const [meusModelos, setMeusModelos] = useState<{ id: string; nome: string; telefone: string }[]>([]);
  const [modeloId, setModeloId] = useState("");
  const [nomeModeloNovo, setNomeModeloNovo] = useState("");
  const [telefoneModeloNovo, setTelefoneModeloNovo] = useState("");
  const [servicos, setServicos] = useState<string[]>([]);
  const [duracaoMinutos, setDuracaoMinutos] = useState("");
  const [fotoAntesFile, setFotoAntesFile] = useState<File | null>(null);
  const [fotoDepoisFile, setFotoDepoisFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    async function load() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/listMeusModelos`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setMeusModelos(data.modelos || []);
      } catch (e) {
        console.error("Falha ao carregar modelos", e);
      }
    }
    load();
  }, []);

  function toggleServico(s: string) {
    setServicos((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleEnviar() {
    setMensagem("");
    if (!modeloId && !nomeModeloNovo.trim()) {
      setMensagem("Escolha um modelo já atendido antes ou digite o nome de um modelo novo.");
      return;
    }
    if (servicos.length === 0) {
      setMensagem("Selecione ao menos um serviço realizado.");
      return;
    }
    if (!fotoAntesFile || !fotoDepoisFile) {
      setMensagem("Foto de antes e depois são obrigatórias.");
      return;
    }

    setEnviando(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const [fotoAntes, fotoDepois] = await Promise.all([uploadFoto(fotoAntesFile), uploadFoto(fotoDepoisFile)]);

      const res = await fetch(`${FUNCTIONS_BASE}/registrarAtendimento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          modeloId: modeloId || undefined,
          modeloNovo: modeloId ? undefined : { nome: nomeModeloNovo, telefone: telefoneModeloNovo },
          servicos,
          fotoAntes,
          fotoDepois,
          duracaoMinutos: duracaoMinutos ? parseInt(duracaoMinutos) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao registrar atendimento");

      setMensagem("✓ Atendimento enviado! Assim que o professor avaliar, aparece no seu histórico.");
      setModeloId("");
      setNomeModeloNovo("");
      setTelefoneModeloNovo("");
      setServicos([]);
      setDuracaoMinutos("");
      setFotoAntesFile(null);
      setFotoDepoisFile(null);
    } catch (e: any) {
      setMensagem(e.message || "Não foi possível registrar o atendimento.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>QUEM VOCÊ ATENDEU</div>
      <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} style={{ ...styles.input, width: "100%" }}>
        <option value="">— Modelo novo (preencha abaixo) —</option>
        {meusModelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
      {!modeloId && (
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          <input placeholder="Nome do modelo" value={nomeModeloNovo} onChange={(e) => setNomeModeloNovo(e.target.value)} style={{ ...styles.input, flex: 2, minWidth: 160 }} />
          <input placeholder="Telefone (opcional)" value={telefoneModeloNovo} onChange={(e) => setTelefoneModeloNovo(e.target.value)} style={{ ...styles.input, flex: 1, minWidth: 140 }} />
        </div>
      )}

      <div style={{ ...styles.eyebrow, marginTop: "1.4rem", marginBottom: "0.6rem" }}>SERVIÇOS REALIZADOS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {SERVICOS_DISPONIVEIS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleServico(s)}
            style={{ ...styles.chip, ...(servicos.includes(s) ? styles.chipActive : {}) }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ ...styles.eyebrow, marginTop: "1.4rem", marginBottom: "0.6rem" }}>DURAÇÃO (MINUTOS, OPCIONAL)</div>
      <input type="number" placeholder="Ex: 45" value={duracaoMinutos} onChange={(e) => setDuracaoMinutos(e.target.value)} style={{ ...styles.input, width: 120 }} />

      <div style={{ display: "flex", gap: "1rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ ...styles.eyebrow, marginBottom: "0.5rem" }}>FOTO ANTES</div>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setFotoAntesFile(e.target.files?.[0] || null)} style={styles.fileInput} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ ...styles.eyebrow, marginBottom: "0.5rem" }}>FOTO DEPOIS</div>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setFotoDepoisFile(e.target.files?.[0] || null)} style={styles.fileInput} />
        </div>
      </div>

      {mensagem && <p style={{ fontSize: "0.82rem", color: mensagem.startsWith("✓") ? "#78c88c" : "#e8746a", marginTop: "1rem" }}>{mensagem}</p>}

      <button style={{ ...styles.btnPrimary, width: "100%", marginTop: "1.2rem" }} disabled={enviando} onClick={handleEnviar}>
        {enviando ? "Enviando..." : "Enviar pra avaliação do professor"}
      </button>
    </div>
  );
}

function MeuHistorico() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/listMeusAtendimentos`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setAtendimentos(data.atendimentos || []);
      } catch (e) {
        console.error("Falha ao carregar histórico", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p style={styles.p}>Carregando...</p>;
  if (atendimentos.length === 0) return <p style={styles.p}>Você ainda não registrou nenhum atendimento no Laboratório.</p>;

  const statusLabel: Record<string, string> = { agendado: "Agendado", realizado: "Aguardando avaliação", avaliado: "Avaliado" };
  const statusColor: Record<string, string> = { agendado: "#9d9384", realizado: GOLD, avaliado: "#78c88c" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {atendimentos.map((a) => (
        <div key={a.id} style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.modeloNome}</div>
              <div style={{ fontSize: "0.78rem", color: "#9d9384" }}>{(a.servicos || []).join(", ") || "—"} · {a.dataAgendada}</div>
            </div>
            <span style={{ fontSize: "0.72rem", color: statusColor[a.status], fontWeight: 600 }}>{statusLabel[a.status]}</span>
          </div>

          {(a.fotoAntes || a.fotoDepois) && (
            <div style={{ display: "flex", gap: "0.7rem", marginTop: "0.8rem" }}>
              {a.fotoAntes && <img src={a.fotoAntes} alt="Antes" style={styles.thumb} />}
              {a.fotoDepois && <img src={a.fotoDepois} alt="Depois" style={styles.thumb} />}
            </div>
          )}

          {a.status === "avaliado" && a.avaliacao && (
            <div style={{ marginTop: "0.9rem", borderTop: "1px solid rgba(197,138,74,.15)", paddingTop: "0.8rem" }}>
              {CATEGORIAS_AVALIACAO.map((c) => (
                <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  <span style={{ color: "#9d9384" }}>{c.label}</span>
                  <span style={{ color: GOLD }}>{"★".repeat(a.avaliacao![c.key] || 0)}{"☆".repeat(5 - (a.avaliacao![c.key] || 0))}</span>
                </div>
              ))}
              {a.comentarioProfessor && <p style={{ fontSize: "0.8rem", color: "#c9c2b4", marginTop: "0.5rem", fontStyle: "italic" }}>"{a.comentarioProfessor}"</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CarteiraProfissional() {
  const [carteira, setCarteira] = useState<Carteira | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/getMinhaCarteira`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) setCarteira(data);
      } catch (e) {
        console.error("Falha ao carregar carteira", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p style={styles.p}>Carregando...</p>;
  if (!carteira) return <p style={styles.p}>Não foi possível carregar sua carteira agora.</p>;

  return (
    <div>
      <div style={styles.walletHeader}>
        <div>
          <div style={{ ...styles.eyebrow, color: "#050505" }}>CARTEIRA PROFISSIONAL</div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", color: "#050505", marginTop: "0.2rem" }}>{carteira.nome}</h3>
        </div>
        <div style={{ fontSize: "1.6rem" }}>💈</div>
      </div>

      <div style={styles.statGrid}>
        <StatBox label="Horas de estudo" value={`${carteira.horasEstudo}h`} />
        <StatBox label="Horas de prática" value={`${carteira.horasPraticas}h`} />
        <StatBox label="Modelos atendidos" value={carteira.modelosAtendidos} />
        <StatBox label="Cortes realizados" value={carteira.cortesRealizados} />
        <StatBox label="Degradês realizados" value={carteira.degradesRealizados} />
        <StatBox label="Barbas realizadas" value={carteira.barbasRealizadas} />
        <StatBox label="Avaliações recebidas" value={carteira.avaliacoesRecebidas} />
        <StatBox label="Nota média" value={carteira.notaMedia > 0 ? `${carteira.notaMedia}/5` : "—"} />
      </div>

      {carteira.avaliacoesRecebidas > 0 && (
        <div style={{ marginTop: "1.6rem" }}>
          <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>MÉDIA POR CATEGORIA</div>
          {CATEGORIAS_AVALIACAO.map((c) => (
            <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "0.4rem 0", borderBottom: "1px solid rgba(197,138,74,.08)" }}>
              <span>{c.label}</span>
              <span style={{ color: GOLD }}>{carteira.mediasPorCategoria[c.key] || "—"}</span>
            </div>
          ))}
        </div>
      )}

      {carteira.melhoresTrabalhos.length > 0 && (
        <div style={{ marginTop: "1.8rem" }}>
          <div style={{ ...styles.eyebrow, marginBottom: "0.8rem" }}>MELHORES TRABALHOS</div>
          <div style={styles.gallery}>
            {carteira.melhoresTrabalhos.map((t, i) => (
              <div key={i} style={styles.galleryItem}>
                <img src={t.fotoDepois} alt={t.modeloNome} style={styles.galleryImg} />
                <div style={{ fontSize: "0.7rem", color: "#9d9384", marginTop: "0.3rem" }}>{t.modeloNome} · {t.media.toFixed(1)}★</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: "1.8rem" }}>
        <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>CERTIFICADO</div>
        {carteira.certificateUrl ? (
          <a href={carteira.certificateUrl} target="_blank" rel="noreferrer" style={{ ...styles.btnGhostGold, display: "inline-block", textDecoration: "none" }}>
            Ver certificado ({carteira.certificateCode})
          </a>
        ) : (
          <p style={styles.p}>Ainda não emitido — conclua {100 - carteira.percentCurso}% do curso restante pra liberar.</p>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerWrap: { minHeight: "100dvh", background: "#050505" },
  topbar: { position: "sticky", top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.6rem", background: "rgba(5,5,5,.9)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(197,138,74,.18)" },
  topbarLink: { background: "none", border: "none", color: "#c9c2b4", fontSize: "0.82rem", cursor: "pointer", textDecoration: "none", fontFamily: "'Inter',sans-serif" },
  pageBody: { display: "flex", justifyContent: "center", padding: "2.4rem 1.5rem" },

  wrap: { maxWidth: 640, width: "100%", fontFamily: "'Inter',sans-serif", color: "#F5F0E8" },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: GOLD },
  h2: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", margin: "0.4rem 0 0.5rem" },
  p: { fontSize: "0.88rem", color: "#9d9384", lineHeight: 1.6 },

  tabs: { display: "flex", gap: "0.5rem", margin: "1.4rem 0 1.6rem", overflowX: "auto" },
  tabBtn: { background: "transparent", border: `1px solid rgba(197,138,74,.3)`, color: "#c9c2b4", padding: "0.6rem 1rem", borderRadius: 4, fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" },
  tabBtnActive: { background: GOLD, color: "#050505", fontWeight: 600, borderColor: GOLD },

  card: { border: "1px solid rgba(197,138,74,.2)", borderRadius: 6, background: "linear-gradient(160deg,#0d0d0d,#050505)", padding: "1.2rem 1.4rem" },
  input: { background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 3, padding: "0.6rem 0.8rem", color: "#F5F0E8", fontSize: "0.85rem", fontFamily: "inherit" },
  fileInput: { fontSize: "0.78rem", color: "#9d9384", width: "100%" },

  chip: { background: "transparent", border: "1px solid rgba(197,138,74,.3)", color: "#c9c2b4", padding: "0.5rem 0.9rem", borderRadius: 20, fontSize: "0.8rem", cursor: "pointer" },
  chipActive: { background: GOLD, color: "#050505", fontWeight: 600, borderColor: GOLD },

  thumb: { width: 84, height: 84, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(197,138,74,.2)" },

  btnPrimary: { background: GOLD, color: "#050505", border: "none", padding: "0.8rem 1.3rem", borderRadius: 4, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" },
  btnGhostGold: { background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "0.7rem 1.2rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem" },

  walletHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(135deg,${GOLD},#E8B97A)`, borderRadius: 8, padding: "1.2rem 1.4rem", marginBottom: "1.4rem" },

  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "0.8rem" },
  statBox: { border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "1rem", background: "linear-gradient(160deg,#0d0d0d,#050505)", textAlign: "center" },
  statValue: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", color: GOLD },
  statLabel: { fontSize: "0.68rem", color: "#9d9384", marginTop: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" },

  gallery: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: "0.8rem" },
  galleryItem: { textAlign: "center" },
  galleryImg: { width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4, border: "1px solid rgba(197,138,74,.2)" },
};
