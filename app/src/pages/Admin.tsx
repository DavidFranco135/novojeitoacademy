import { useState, useEffect } from "react";
import { auth } from "../firebase";

/**
 * Painel Admin — Novo Jeito Academy
 * Abas: Visão Geral, Leads, Alunos, Turmas Presenciais, Financeiro
 *
 * Todos os dados aqui são mock — os pontos de integração com a API real
 * estão comentados em cada seção.
 */

const GOLD = "#C58A4A";

type Tab = "overview" | "leads" | "alunos" | "turmas" | "financeiro" | "bolsas" | "conteudo";

// ---------- mock data ----------
const MOCK_STATS = { leads: 84, alunos: 41, faturamento: 20377, conversao: 48.8 };

const MOCK_LEADS = [
  { nome: "Rafael Souza", contato: "(21) 98888-1234", status: "Novo", data: "12/07/2026" },
  { nome: "Bianca Ferreira", contato: "(21) 97777-5678", status: "Contatado", data: "10/07/2026" },
  { nome: "Diego Martins", contato: "(21) 96666-9012", status: "Perdido", data: "08/07/2026" },
];

const MOCK_ALUNOS = [
  { nome: "João Pedro Lima", email: "joao@email.com", pagamento: "Pago", progresso: 100, matricula: "01/06/2026" },
  { nome: "Carla Nogueira", email: "carla@email.com", pagamento: "Pago", progresso: 62, matricula: "15/06/2026" },
  { nome: "Marcos Vinícius", email: "marcos@email.com", pagamento: "Pendente", progresso: 0, matricula: "13/07/2026" },
];

const MOCK_TURMAS = [
  { data: "20/07/2026", horario: "09:00", local: "Barbearia Novo Jeito", vagas: "8/10", presentes: "-" },
  { data: "03/08/2026", horario: "14:00", local: "Barbearia Novo Jeito", vagas: "3/10", presentes: "-" },
];

const MOCK_TRANSACOES = [
  { aluno: "João Pedro Lima", valor: "R$ 497,00", metodo: "PIX", status: "Aprovado", data: "01/06/2026" },
  { aluno: "Carla Nogueira", valor: "R$ 49,70 (1/12)", metodo: "Cartão", status: "Aprovado", data: "15/06/2026" },
  { aluno: "Marcos Vinícius", valor: "R$ 497,00", metodo: "Boleto", status: "Pendente", data: "13/07/2026" },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
      `}</style>

      {/* ===== SIDEBAR ===== */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>
        <div style={styles.logoSub}>PAINEL ADMINISTRATIVO</div>

        <nav style={styles.nav}>
          {([
            ["overview", "📊", "Visão Geral"],
            ["leads", "🎯", "Leads"],
            ["alunos", "🎓", "Alunos"],
            ["turmas", "📍", "Turmas Presenciais"],
            ["bolsas", "🎓", "Bolsas"],
            ["conteudo", "🖼️", "Conteúdo do Site"],
            ["financeiro", "💰", "Financeiro"],
          ] as [Tab, string, string][]).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{ ...styles.navItem, background: tab === id ? "rgba(197,138,74,.1)" : "transparent", borderLeft: tab === id ? `2px solid ${GOLD}` : "2px solid transparent", color: tab === id ? "#F5F0E8" : "#9d9384" }}
            >
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ===== MAIN ===== */}
      <main style={styles.main}>
        {tab === "overview" && <Overview />}
        {tab === "leads" && <Leads />}
        {tab === "alunos" && <Alunos />}
        {tab === "turmas" && <Turmas />}
        {tab === "bolsas" && <Bolsas />}
        {tab === "conteudo" && <ConteudoSite />}
        {tab === "financeiro" && <Financeiro />}
      </main>
    </div>
  );
}

// ============================================================
function Overview() {
  return (
    <div>
      <PageHeader eyebrow="RESUMO" title="Visão geral" />
      <div style={styles.statGrid}>
        <StatCard label="LEADS TOTAIS" value={MOCK_STATS.leads} />
        <StatCard label="ALUNOS ATIVOS" value={MOCK_STATS.alunos} />
        <StatCard label="FATURAMENTO (MÊS)" value={`R$ ${MOCK_STATS.faturamento.toLocaleString("pt-BR")}`} />
        <StatCard label="TAXA DE CONVERSÃO" value={`${MOCK_STATS.conversao}%`} />
      </div>

      <div style={{ marginTop: "2.4rem" }}>
        <SectionLabel>ATIVIDADE RECENTE</SectionLabel>
        <div style={styles.tableCard}>
          <ActivityRow text="Carla Nogueira concluiu a aula 'Skin fade do zero'" time="há 2h" />
          <ActivityRow text="Marcos Vinícius se cadastrou (pagamento pendente)" time="há 5h" />
          <ActivityRow text="João Pedro Lima emitiu o certificado" time="ontem" />
        </div>
      </div>
      {/* API real: GET /api/admin/overview */}
    </div>
  );
}

function ActivityRow({ text, time }: { text: string; time: string }) {
  return (
    <div style={styles.activityRow}>
      <span style={{ fontSize: "0.85rem", color: "#c9c2b4" }}>{text}</span>
      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.7rem", color: "#5a5348" }}>{time}</span>
    </div>
  );
}

// ============================================================
function Leads() {
  return (
    <div>
      <PageHeader eyebrow="AQUISIÇÃO" title="Leads" subtitle="Pessoas que demonstraram interesse mas ainda não finalizaram a matrícula." />
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <Th>Nome</Th><Th>Contato</Th><Th>Status</Th><Th>Data</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LEADS.map((l, i) => (
              <tr key={i} style={styles.tr}>
                <Td>{l.nome}</Td>
                <Td>{l.contato}</Td>
                <Td><StatusBadge status={l.status} /></Td>
                <Td mono>{l.data}</Td>
                <Td><button style={styles.linkBtn}>Contatar →</button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* API real: GET /api/admin/leads · PATCH /api/admin/leads/:id (mudar status) */}
    </div>
  );
}

// ============================================================
function Alunos() {
  return (
    <div>
      <PageHeader eyebrow="GESTÃO" title="Alunos" subtitle="Cadastro, pagamento e progresso de cada aluno matriculado." />
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <Th>Nome</Th><Th>E-mail</Th><Th>Pagamento</Th><Th>Progresso</Th><Th>Matrícula</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ALUNOS.map((a, i) => (
              <tr key={i} style={styles.tr}>
                <Td>{a.nome}</Td>
                <Td muted>{a.email}</Td>
                <Td><StatusBadge status={a.pagamento} /></Td>
                <Td>
                  <div style={styles.progressBarOuter}>
                    <div style={{ ...styles.progressBarInner, width: `${a.progresso}%` }} />
                  </div>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.68rem", color: GOLD }}>{a.progresso}%</span>
                </Td>
                <Td mono>{a.matricula}</Td>
                <Td><button style={styles.linkBtn}>Ver detalhes →</button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* API real: GET /api/admin/students · ação manual: liberar/bloquear acesso, reenviar certificado */}
    </div>
  );
}

// ============================================================
function Turmas() {
  return (
    <div>
      <PageHeader eyebrow="PRESENCIAL" title="Turmas Presenciais" subtitle="Datas marcadas, vagas ocupadas e confirmação de presença." />

      <button style={styles.btnPrimary}>+ Criar nova turma</button>

      <div style={{ marginTop: "1.4rem" }}>
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Data</Th><Th>Horário</Th><Th>Local</Th><Th>Vagas</Th><Th>Presença</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TURMAS.map((t, i) => (
                <tr key={i} style={styles.tr}>
                  <Td mono>{t.data}</Td>
                  <Td mono>{t.horario}</Td>
                  <Td>{t.local}</Td>
                  <Td mono>{t.vagas}</Td>
                  <Td muted>{t.presentes}</Td>
                  <Td><button style={styles.linkBtn}>Ver lista →</button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* API real: POST /api/admin/presencial (criar turma) · GET /api/admin/presencial/:id/attendees */}
    </div>
  );
}

// ============================================================
function Bolsas() {
  const [bolsas, setBolsas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://us-central1-barbearia-do-ico.cloudfunctions.net/listScholarshipApplications")
      .then((r) => r.json())
      .then((data) => setBolsas(data.applications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader eyebrow="VAGA SOLIDÁRIA" title="Candidaturas à Bolsa" subtitle="Pessoas que se candidataram à bolsa de 100% através do site." />

      {loading && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando candidaturas...</p>}

      {!loading && bolsas.length === 0 && (
        <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhuma candidatura recebida ainda.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {bolsas.map((b, i) => (
          <div key={b.id || i} style={styles.bolsaCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{b.nome}</div>
                <div style={{ fontSize: "0.78rem", color: "#9d9384", marginTop: "0.2rem" }}>{b.idade ? `${b.idade} anos · ` : ""}{b.profissao || "Não informado"} · {b.whatsapp}</div>
              </div>
              <StatusBadge status={b.status === "novo" ? "Novo" : b.status === "contatado" ? "Contatado" : b.status} />
            </div>
            <p style={{ fontSize: "0.86rem", color: "#c9c2b4", marginTop: "0.9rem", lineHeight: 1.6, fontStyle: "italic" }}>"{b.motivo}"</p>
            <div style={{ marginTop: "1rem" }}>
              <a href={`https://wa.me/55${(b.whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={styles.linkBtn}>Chamar no WhatsApp →</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// URLs das functions — troque barbearia-do-ico pela URL real após o deploy
const GET_CONTENT_URL = "https://us-central1-barbearia-do-ico.cloudfunctions.net/getSiteContent";
const UPDATE_CONTENT_URL = "https://us-central1-barbearia-do-ico.cloudfunctions.net/updateSiteContent";
const UPLOAD_IMAGE_URL = "https://us-central1-barbearia-do-ico.cloudfunctions.net/uploadImage";

interface SiteContent {
  heroTitle: string;
  heroLead: string;
  heroImageUrl: string;
  videoEmbedUrl: string;
  statAlunos: number;
  statAulas: number;
  statAvaliacao: number;
  galleryImages: string[];
  instrutorNome: string;
  instrutorBio1: string;
  instrutorBio2: string;
  instrutorPhotoUrl: string;
  instrutorAnos: number;
  instrutorAlunosFormados: number;
  price: number;
  priceInstallments: number;
}

const EMPTY_CONTENT: SiteContent = {
  heroTitle: "Domine a\nnavalha.\nConstrua seu ofício.",
  heroLead: "",
  heroImageUrl: "",
  videoEmbedUrl: "",
  statAlunos: 0,
  statAulas: 0,
  statAvaliacao: 0,
  galleryImages: ["", "", "", "", "", ""],
  instrutorNome: "",
  instrutorBio1: "",
  instrutorBio2: "",
  instrutorPhotoUrl: "",
  instrutorAnos: 0,
  instrutorAlunosFormados: 0,
  price: 0,
  priceInstallments: 12,
};

function ConteudoSite() {
  const [content, setContent] = useState<SiteContent>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    fetch(GET_CONTENT_URL)
      .then((r) => r.json())
      .then((data) => setContent({ ...EMPTY_CONTENT, ...data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  function updateGalleryImage(idx: number, url: string) {
    setContent((prev) => {
      const gallery = [...prev.galleryImages];
      gallery[idx] = url;
      return { ...prev, galleryImages: gallery };
    });
  }

  async function handleImageUpload(file: File, fieldKey: string, onDone: (url: string) => void) {
    setUploadingField(fieldKey);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(UPLOAD_IMAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, name: fieldKey }),
      });
      const json = await res.json();
      if (json.url) onDone(json.url);
    } catch (e) {
      alert("Falha no upload da imagem. Tente novamente.");
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(UPDATE_CONTENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(content),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      setSavedMsg("✓ Alterações salvas — já estão no ar no site.");
    } catch (e) {
      setSavedMsg("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(""), 4000);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="SITE PÚBLICO" title="Conteúdo do Site" />
        <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando conteúdo atual...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader eyebrow="SITE PÚBLICO" title="Conteúdo do Site" subtitle="Edite fotos, textos, vídeo e preço da página que os visitantes veem — sem mexer em código." />

      <FieldGroup title="Capa (Hero)">
        <ImageField label="Foto de capa" url={content.heroImageUrl} uploading={uploadingField === "hero"} onUpload={(f) => handleImageUpload(f, "hero", (url) => update("heroImageUrl", url))} />
        <TextField label="Título" value={content.heroTitle} multiline onChange={(v) => update("heroTitle", v)} hint="Use quebras de linha pra controlar onde o texto quebra" />
        <TextField label="Texto de apoio" value={content.heroLead} multiline onChange={(v) => update("heroLead", v)} />
      </FieldGroup>

      <FieldGroup title="Estatísticas (abaixo do título)">
        <div style={{ display: "flex", gap: "1rem" }}>
          <NumberField label="Alunos formados" value={content.statAlunos} onChange={(v) => update("statAlunos", v)} />
          <NumberField label="Aulas em vídeo" value={content.statAulas} onChange={(v) => update("statAulas", v)} />
          <NumberField label="Avaliação média" value={content.statAvaliacao} step="0.1" onChange={(v) => update("statAvaliacao", v)} />
        </div>
      </FieldGroup>

      <FieldGroup title="Vídeo de apresentação">
        <TextField label="URL do embed (Cloudflare Stream, YouTube, Vimeo...)" value={content.videoEmbedUrl} onChange={(v) => update("videoEmbedUrl", v)} hint="Cole o link de embed completo (iframe src)" />
      </FieldGroup>

      <FieldGroup title="Galeria de fotos (6 fotos)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.8rem" }}>
          {content.galleryImages.map((url, i) => (
            <ImageField key={i} label={`Foto ${i + 1}`} url={url} compact uploading={uploadingField === `gallery-${i}`} onUpload={(f) => handleImageUpload(f, `gallery-${i}`, (u) => updateGalleryImage(i, u))} />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="Sobre o instrutor">
        <ImageField label="Foto do instrutor" url={content.instrutorPhotoUrl} uploading={uploadingField === "instrutor"} onUpload={(f) => handleImageUpload(f, "instrutor", (url) => update("instrutorPhotoUrl", url))} />
        <TextField label="Nome" value={content.instrutorNome} onChange={(v) => update("instrutorNome", v)} />
        <TextField label="Bio — parágrafo 1" value={content.instrutorBio1} multiline onChange={(v) => update("instrutorBio1", v)} />
        <TextField label="Bio — parágrafo 2" value={content.instrutorBio2} multiline onChange={(v) => update("instrutorBio2", v)} />
        <div style={{ display: "flex", gap: "1rem" }}>
          <NumberField label="Anos de ofício" value={content.instrutorAnos} onChange={(v) => update("instrutorAnos", v)} />
          <NumberField label="Alunos formados" value={content.instrutorAlunosFormados} onChange={(v) => update("instrutorAlunosFormados", v)} />
        </div>
      </FieldGroup>

      <FieldGroup title="Investimento">
        <div style={{ display: "flex", gap: "1rem" }}>
          <NumberField label="Preço (R$)" value={content.price} step="0.01" onChange={(v) => update("price", v)} />
          <NumberField label="Nº de parcelas" value={content.priceInstallments} onChange={(v) => update("priceInstallments", v)} />
        </div>
      </FieldGroup>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
        <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
        {savedMsg && <span style={{ fontSize: "0.82rem", color: savedMsg.startsWith("✓") ? "#78c88c" : "#e8746a" }}>{savedMsg}</span>}
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "2rem", border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "1.4rem 1.6rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" }}>
      <div style={{ ...styles.eyebrow, marginBottom: "1rem" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>{children}</div>
    </div>
  );
}

function TextField({ label, value, onChange, multiline, hint }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; hint?: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.75rem", color: GOLD, marginBottom: "0.35rem" }}>{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", minHeight: 70, background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 3, padding: "0.7rem 0.85rem", color: "#F5F0E8", fontSize: "0.85rem", fontFamily: "inherit", resize: "vertical" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 3, padding: "0.7rem 0.85rem", color: "#F5F0E8", fontSize: "0.85rem" }} />
      )}
      {hint && <div style={{ fontSize: "0.72rem", color: "#5a5348", marginTop: "0.3rem" }}>{hint}</div>}
    </div>
  );
}

function NumberField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: "0.75rem", color: GOLD, marginBottom: "0.35rem" }}>{label}</label>
      <input type="number" step={step || "1"} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={{ width: "100%", background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 3, padding: "0.7rem 0.85rem", color: "#F5F0E8", fontSize: "0.85rem" }} />
    </div>
  );
}

function ImageField({ label, url, onUpload, uploading, compact }: { label: string; url: string; onUpload: (file: File) => void; uploading?: boolean; compact?: boolean }) {
  return (
    <div>
      {!compact && <label style={{ display: "block", fontSize: "0.75rem", color: GOLD, marginBottom: "0.35rem" }}>{label}</label>}
      <div style={{ position: "relative", aspectRatio: compact ? "1" : "16/9", border: "1px dashed rgba(197,138,74,.3)", borderRadius: 4, overflow: "hidden", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {url ? (
          <img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: "0.72rem", color: "#5a5348" }}>{uploading ? "Enviando..." : compact ? label : "Nenhuma imagem"}</span>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
        />
      </div>
    </div>
  );
}

// ============================================================
function Financeiro() {
  return (
    <div>
      <PageHeader eyebrow="FINANCEIRO" title="Transações" subtitle="Pagamentos aprovados, pendentes e recusados via Mercado Pago." />

      <div style={styles.statGrid}>
        <StatCard label="APROVADO (MÊS)" value="R$ 18.880" />
        <StatCard label="PENDENTE" value="R$ 497" />
        <StatCard label="PARCELAS EM ABERTO" value="6" />
      </div>

      <div style={{ marginTop: "1.6rem" }}>
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Aluno</Th><Th>Valor</Th><Th>Método</Th><Th>Status</Th><Th>Data</Th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TRANSACOES.map((t, i) => (
                <tr key={i} style={styles.tr}>
                  <Td>{t.aluno}</Td>
                  <Td mono>{t.valor}</Td>
                  <Td muted>{t.metodo}</Td>
                  <Td><StatusBadge status={t.status} /></Td>
                  <Td mono>{t.data}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* API real: GET /api/admin/transactions — vem do webhook do Mercado Pago já salvo no Firestore */}
    </div>
  );
}

// ============================================================ componentes utilitários
function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={styles.eyebrow}>{eyebrow}</div>
      <h1 style={styles.pageTitle}>{title}</h1>
      {subtitle && <p style={styles.pageSubtitle}>{subtitle}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ ...styles.eyebrow, marginBottom: "0.8rem" }}>{children}</div>;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th style={styles.th}>{children}</th>;
}

function Td({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return <td style={{ ...styles.td, fontFamily: mono ? "'Space Mono',monospace" : "inherit", color: muted ? "#8A8070" : "#F5F0E8", fontSize: mono ? "0.78rem" : "0.85rem" }}>{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Novo: { bg: "rgba(197,138,74,.12)", color: GOLD },
    Contatado: { bg: "rgba(120,160,200,.12)", color: "#7aa0c8" },
    Perdido: { bg: "rgba(232,116,106,.12)", color: "#e8746a" },
    Pago: { bg: "rgba(120,200,140,.12)", color: "#78c88c" },
    Aprovado: { bg: "rgba(120,200,140,.12)", color: "#78c88c" },
    Pendente: { bg: "rgba(197,138,74,.12)", color: GOLD },
    Selecionado: { bg: "rgba(120,200,140,.12)", color: "#78c88c" },
  };
  const s = map[status] || { bg: "rgba(150,150,150,.12)", color: "#999" };
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.72rem", padding: "0.25rem 0.6rem", borderRadius: 3, fontWeight: 600 }}>{status}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100vh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif" },

  sidebar: { width: 260, flexShrink: 0, borderRight: "1px solid rgba(197,138,74,.18)", padding: "1.8rem 1.2rem", height: "100vh", position: "sticky", top: 0 },
  logo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.05rem" },
  logoSub: { fontFamily: "'Space Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.15em", color: "#5a5348", marginTop: "0.3rem", marginBottom: "2rem" },
  nav: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  navItem: { display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.7rem 0.8rem", border: "none", borderRadius: 3, fontSize: "0.85rem", cursor: "pointer", textAlign: "left" },

  main: { flex: 1, padding: "2.4rem 3rem", maxWidth: 1100 },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: GOLD },
  pageTitle: { fontFamily: "'Playfair Display',serif", fontSize: "1.8rem", marginTop: "0.4rem" },
  pageSubtitle: { fontSize: "0.88rem", color: "#9d9384", marginTop: "0.4rem", maxWidth: 520, lineHeight: 1.6 },

  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1rem" },
  statCard: { border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "1.2rem 1.4rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  statLabel: { fontFamily: "'Space Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.08em", color: "#9d9384" },
  statValue: { fontFamily: "'Playfair Display',serif", fontSize: "1.9rem", color: GOLD, marginTop: "0.4rem" },

  tableCard: { border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, overflow: "hidden", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  bolsaCard: { border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "1.2rem 1.4rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.06em", color: "#9d9384", padding: "0.9rem 1.2rem", borderBottom: "1px solid rgba(197,138,74,.18)" },
  tr: { borderBottom: "1px solid rgba(197,138,74,.08)" },
  td: { padding: "0.85rem 1.2rem" },

  activityRow: { display: "flex", justifyContent: "space-between", padding: "0.9rem 1.2rem", borderBottom: "1px solid rgba(197,138,74,.08)" },

  progressBarOuter: { width: 90, height: 5, background: "rgba(197,138,74,.15)", borderRadius: 3, display: "inline-block", marginRight: "0.5rem", overflow: "hidden", verticalAlign: "middle" },
  progressBarInner: { height: "100%", background: GOLD },

  linkBtn: { background: "transparent", border: "none", color: GOLD, fontSize: "0.8rem", cursor: "pointer" },
  btnPrimary: { background: GOLD, color: "#050505", border: "none", padding: "0.7rem 1.3rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" },
};
