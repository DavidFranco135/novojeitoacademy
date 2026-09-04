import { useState, useEffect, useRef } from "react";
import { auth } from "../firebase";

/**
 * Painel Admin — Novo Jeito Academy
 * Abas: Visão Geral, Leads, Alunos, Turmas Presenciais, Financeiro
 *
 * Todos os dados aqui são mock — os pontos de integração com a API real
 * estão comentados em cada seção.
 */

const GOLD = "#C58A4A";
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";
const SITE_BASE = "https://portal.novojeitobarbearia.com.br";

type Tab = "overview" | "leads" | "alunos" | "turmas" | "financeiro" | "bolsas" | "conteudo" | "curriculo" | "assinatura" | "formados" | "laboratorio" | "avisos";

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(`${FUNCTIONS_BASE}/${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
}

// Exporta uma lista de objetos como arquivo CSV e dispara o download
function exportToCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // \uFEFF = BOM, abre acentuação certa no Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 12;

// Paginação simples client-side — corta a lista já carregada em páginas de PAGE_SIZE
function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { page, setPage, totalPages, pageItems };
}

function PaginationControls({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "1.2rem" }}>
      <button style={{ ...styles.linkBtn, opacity: page === 1 ? 0.35 : 1 }} disabled={page === 1} onClick={() => onChange(page - 1)}>← Anterior</button>
      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.75rem", color: "#9d9384" }}>Página {page} de {totalPages}</span>
      <button style={{ ...styles.linkBtn, opacity: page === totalPages ? 0.35 : 1 }} disabled={page === totalPages} onClick={() => onChange(page + 1)}>Próxima →</button>
    </div>
  );
}

const NAV_ITEMS: [Tab, string, string][] = [
  ["overview", "📊", "Visão Geral"],
  ["leads", "🎯", "Leads"],
  ["alunos", "🎓", "Alunos"],
  ["formados", "🏆", "Formados"],
  ["turmas", "📍", "Turmas Presenciais"],
  ["laboratorio", "🧪", "Laboratório"],
  ["bolsas", "🎓", "Bolsas"],
  ["conteudo", "🖼️", "Conteúdo do Site"],
  ["curriculo", "📚", "Currículo"],
  ["assinatura", "✍️", "Assinatura"],
  ["avisos", "📣", "Avisos"],
  ["financeiro", "💰", "Financeiro"],
];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [navOpen, setNavOpen] = useState(false);
  const tabAtual = NAV_ITEMS.find((n) => n[0] === tab);

  return (
    <div style={styles.page} className="admin-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

        @media (max-width: 860px) {
          .admin-page { flex-direction: column !important; }
          .admin-sidebar {
            width: 100% !important;
            height: auto !important;
            position: static !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(197,138,74,.18) !important;
            padding: 1.2rem !important;
          }
          .admin-mobile-toggle {
            display: flex !important;
          }
          .admin-nav {
            flex-direction: column !important;
            gap: 0.15rem !important;
            max-height: 0 !important;
            overflow: hidden !important;
            transition: max-height .3s ease !important;
          }
          .admin-nav.admin-nav-open {
            max-height: 700px !important;
            margin-top: 0.6rem !important;
          }
          .admin-nav button {
            width: 100% !important;
            justify-content: flex-start !important;
            padding: 0.65rem 0.8rem !important;
            font-size: 0.85rem !important;
          }
          .admin-main {
            padding: 1.4rem 1.2rem !important;
            max-width: 100% !important;
          }
          .aluno-actions {
            gap: 0.6rem 1rem !important;
          }
        }
        .aluno-actions a:hover, .aluno-actions button:hover {
          text-decoration: underline;
        }
      `}</style>

      {/* ===== SIDEBAR ===== */}
      <aside style={styles.sidebar} className="admin-sidebar">
        <div style={styles.logo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>
        <div style={styles.logoSub}>PAINEL ADMINISTRATIVO</div>

        <button
          className="admin-mobile-toggle"
          onClick={() => setNavOpen((v) => !v)}
          style={{ display: "none", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "0.7rem 0.9rem", marginTop: "0.8rem", background: "rgba(197,138,74,.06)", border: "1px solid rgba(197,138,74,.25)", borderRadius: 4, color: "#F5F0E8", fontSize: "0.82rem", cursor: "pointer" }}
        >
          <span>{tabAtual?.[1]} {tabAtual?.[2]}</span>
          <span style={{ color: GOLD }}>{navOpen ? "▲" : "▼"}</span>
        </button>

        <nav style={styles.nav} className={`admin-nav${navOpen ? " admin-nav-open" : ""}`}>
          {NAV_ITEMS.map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setNavOpen(false); }}
              style={{ ...styles.navItem, background: tab === id ? "rgba(197,138,74,.1)" : "transparent", borderLeft: tab === id ? `2px solid ${GOLD}` : "2px solid transparent", color: tab === id ? "#F5F0E8" : "#9d9384" }}
            >
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ===== MAIN ===== */}
      <main style={styles.main} className="admin-main">
        {tab === "overview" && <Overview />}
        {tab === "leads" && <Leads />}
        {tab === "alunos" && <Alunos />}
        {tab === "formados" && <Formados />}
        {tab === "turmas" && <Turmas />}
        {tab === "laboratorio" && <Laboratorio />}
        {tab === "bolsas" && <Bolsas />}
        {tab === "conteudo" && <ConteudoSite />}
        {tab === "curriculo" && <Curriculo />}
        {tab === "assinatura" && <AssinaturaContratada />}
        {tab === "avisos" && <Avisos />}
        {tab === "financeiro" && <Financeiro />}
      </main>
    </div>
  );
}

// ============================================================
function Overview() {
  const [stats, setStats] = useState({ leads: 0, alunos: 0, faturamento: 0, conversao: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch("getOverviewStats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader eyebrow="RESUMO" title="Visão geral" />
      {loading ? (
        <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>
      ) : (
        <div style={styles.statGrid}>
          <StatCard label="LEADS TOTAIS" value={stats.leads} />
          <StatCard label="ALUNOS ATIVOS" value={stats.alunos} />
          <StatCard label="FATURAMENTO (MÊS)" value={`R$ ${stats.faturamento.toLocaleString("pt-BR")}`} />
          <StatCard label="TAXA DE CONVERSÃO" value={`${stats.conversao}%`} />
        </div>
      )}
      {/* API real: GET getOverviewStats */}
    </div>
  );
}

// ============================================================
function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, setPage, totalPages, pageItems } = usePagination(leads);

  useEffect(() => {
    authedFetch("listLeads")
      .then((r) => r.json())
      .then((data) => setLeads(data.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleExport() {
    exportToCSV(
      leads.map((l) => ({ Nome: l.nome, Contato: l.contato, Status: l.status, Data: l.data })),
      "leads_novo_jeito_academy.csv"
    );
  }

  return (
    <div>
      <PageHeader eyebrow="AQUISIÇÃO" title="Leads" subtitle="Pessoas que demonstraram interesse mas ainda não finalizaram a matrícula." />
      {!loading && leads.length > 0 && (
        <button style={{ ...styles.linkBtn, marginBottom: "1rem" }} onClick={handleExport}>⬇ Exportar CSV ({leads.length})</button>
      )}
      {loading && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>}
      {!loading && leads.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhum lead capturado ainda.</p>}
      {!loading && leads.length > 0 && (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Nome</Th><Th>Contato</Th><Th>Status</Th><Th>Data</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l, i) => (
                <tr key={l.id || i} style={styles.tr}>
                  <Td>{l.nome}</Td>
                  <Td>{l.contato}</Td>
                  <Td><StatusBadge status={l.status === "novo" ? "Novo" : l.status} /></Td>
                  <Td mono>{l.data}</Td>
                  <Td><a href={`https://wa.me/55${(l.contato || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={styles.linkBtn}>Contatar →</a></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
      {/* API real: GET listLeads */}
    </div>
  );
}

// ============================================================
const emptyCadastroForm = { nome: "", email: "", telefone: "", cpf: "", rg: "", dataNascimento: "", endereco: "", cidade: "" };

function Alunos() {
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const { page, setPage, totalPages, pageItems } = usePagination(alunos);

  const [showNovoForm, setShowNovoForm] = useState(false);
  const [novoForm, setNovoForm] = useState({ ...emptyCadastroForm, formaPagamento: "dinheiro" as "dinheiro" | "pago", valor: "697" });
  const [creatingNovo, setCreatingNovo] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyCadastroForm, modulosAplicaveis: [] as string[], aulasExcluidas: [] as string[] });
  const [savingEdit, setSavingEdit] = useState(false);
  const [courseModules, setCourseModules] = useState<{ id: string; title: string }[]>([]);
  const [courseModulesFull, setCourseModulesFull] = useState<any[]>([]);
  const [detailForId, setDetailForId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("https://us-central1-barbearia-do-ico.cloudfunctions.net/getCourseContent")
      .then((r) => r.json())
      .then((data) => {
        setCourseModules((data.modules || []).map((m: any) => ({ id: m.id, title: m.title })));
        setCourseModulesFull(data.modules || []);
      })
      .catch(() => {});
  }, []);

  async function handleVerDesempenho(aluno: any) {
    if (detailForId === aluno.id) {
      setDetailForId(null);
      return;
    }
    setDetailForId(aluno.id);
    setDetailData(null);
    setLoadingDetail(true);
    try {
      const res = await authedFetch(`getStudentDetail?enrollmentId=${aluno.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      setDetailData(data);
    } catch {
      setDetailData({ error: true });
    } finally {
      setLoadingDetail(false);
    }
  }

  function formatDataBRDesempenho(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  // Lista vazia = "sem restrição" (todos os módulos valem, todos aparecem marcados).
  // Ao desmarcar o primeiro, vira uma lista explícita com todos MENOS esse. Se o
  // admin remarcar tudo de novo, volta sozinho pro estado "sem restrição".
  function toggleEditModulo(moduloId: string) {
    setEditForm((prev) => {
      const current = prev.modulosAplicaveis.length > 0 ? prev.modulosAplicaveis : courseModules.map((m) => m.id);
      const next = current.includes(moduloId) ? current.filter((id) => id !== moduloId) : [...current, moduloId];
      return { ...prev, modulosAplicaveis: next.length === courseModules.length ? [] : next };
    });
  }

  // Aula específica dentro de um módulo aplicável — pra aluno que já sabe só
  // uma parte do conteúdo daquele módulo, não o módulo inteiro.
  function toggleEditAula(lessonId: string) {
    setEditForm((prev) => ({
      ...prev,
      aulasExcluidas: prev.aulasExcluidas.includes(lessonId)
        ? prev.aulasExcluidas.filter((id) => id !== lessonId)
        : [...prev.aulasExcluidas, lessonId],
    }));
  }

  function loadAlunos() {
    setLoading(true);
    authedFetch("listStudents")
      .then((r) => r.json())
      .then((data) => setAlunos(data.students || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function handleExport() {
    exportToCSV(
      alunos.map((a) => ({ Nome: a.nome, Email: a.email, Pagamento: a.pagamento, Progresso: `${a.progresso}%`, Matricula: a.matricula })),
      "alunos_novo_jeito_academy.csv"
    );
  }

  useEffect(() => {
    loadAlunos();
  }, []);

  async function handleToggleAccess(aluno: any) {
    const acao = aluno.bloqueado ? "desbloquear" : "bloquear";
    if (!window.confirm(`Confirma ${acao} o acesso de ${aluno.nome}?`)) return;

    setActingOn(aluno.id);
    try {
      await authedFetch("toggleStudentAccess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: aluno.id, blocked: !aluno.bloqueado }),
      });
      loadAlunos();
    } catch {
      alert("Não foi possível atualizar o acesso.");
    } finally {
      setActingOn(null);
    }
  }

  function handleEditar(aluno: any) {
    setEditingId(aluno.id);
    setEditForm({
      nome: aluno.nome || "",
      email: aluno.email || "",
      telefone: aluno.telefone || "",
      cpf: aluno.cpf || "",
      rg: aluno.rg || "",
      dataNascimento: aluno.dataNascimento || "",
      endereco: aluno.endereco || "",
      cidade: aluno.cidade || "",
      modulosAplicaveis: aluno.modulosAplicaveis || [],
      aulasExcluidas: aluno.aulasExcluidas || [],
    });
  }

  async function handleSalvarEdicao() {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      const res = await authedFetch("updateStudent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: editingId, ...editForm }),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      loadAlunos();
    } catch {
      alert("Não foi possível salvar as alterações.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleCriarCadastro() {
    const f = novoForm;
    if (
      f.nome.trim().length < 3 ||
      !/\S+@\S+\.\S+/.test(f.email) ||
      f.telefone.replace(/\D/g, "").length < 10 ||
      f.cpf.replace(/\D/g, "").length !== 11
    ) {
      alert("Preencha nome, e-mail, WhatsApp e CPF corretamente antes de criar o cadastro.");
      return;
    }

    setCreatingNovo(true);
    try {
      const res = await authedFetch("createEnrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: f.nome,
          email: f.email,
          telefone: f.telefone,
          cpf: f.cpf,
          rg: f.rg || undefined,
          dataNascimento: f.dataNascimento || undefined,
          endereco: f.endereco || undefined,
          cidade: f.cidade || undefined,
          paymentMethod: f.formaPagamento === "dinheiro" ? "dinheiro" : undefined,
          valorCombinado: f.formaPagamento === "dinheiro" ? f.valor : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");

      const link = `${SITE_BASE}/matricula?assinar=${data.enrollmentId}`;
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // segue mesmo se falhar — o prompt abaixo garante a cópia manual
      }
      window.prompt(
        "Cadastro criado! Envie esse link pro aluno assinar o contrato (bolsa/dinheiro libera o acesso automaticamente ao assinar; pago segue pro checkout) — já copiado:",
        link
      );
      setShowNovoForm(false);
      setNovoForm({ ...emptyCadastroForm, formaPagamento: "dinheiro", valor: "697" });
      loadAlunos();
    } catch (e: any) {
      alert(e.message || "Não foi possível criar o cadastro.");
    } finally {
      setCreatingNovo(false);
    }
  }

  async function handleExcluir(aluno: any) {
    if (!window.confirm(`Tem certeza que quer EXCLUIR ${aluno.nome} por completo? Isso apaga matrícula, progresso, login e vaga em turma. Não tem como desfazer.`)) return;
    if (!window.confirm(`Confirma de novo: excluir ${aluno.nome} definitivamente?`)) return;

    setActingOn(aluno.id);
    try {
      const res = await authedFetch("deleteStudent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: aluno.id }),
      });
      if (!res.ok) throw new Error();
      loadAlunos();
    } catch {
      alert("Não foi possível excluir o aluno.");
    } finally {
      setActingOn(null);
    }
  }

  function handleCopySignLink(aluno: any) {
    const link = `${SITE_BASE}/matricula?assinar=${aluno.id}`;
    navigator.clipboard.writeText(link).catch(() => {});
    window.prompt("Link para o aluno assinar o contrato (já copiado — cole no WhatsApp):", link);
  }

  async function handleConfirmarPagamento(aluno: any) {
    const valorStr = window.prompt(`Confirmar pagamento em dinheiro de ${aluno.nome}. Valor recebido (R$):`, "697");
    if (valorStr === null) return; // cancelou
    const valorPago = parseFloat(valorStr.replace(",", ".")) || 0;
    if (!valorPago) {
      alert("Informe um valor válido.");
      return;
    }
    if (!window.confirm(`Confirma que recebeu R$ ${valorPago.toFixed(2)} de ${aluno.nome} e quer liberar o acesso dele agora?`)) return;

    setActingOn(aluno.id);
    try {
      const res = await authedFetch("confirmPendingPayment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: aluno.id, valorPago }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");

      if (data.loginLink) {
        try {
          await navigator.clipboard.writeText(data.loginLink);
        } catch {
          // segue mesmo se falhar — o prompt abaixo garante a cópia manual
        }
        window.prompt("Pagamento confirmado! Acesso liberado. Envie esse link de login pro aluno (já copiado — cole no WhatsApp):", data.loginLink);
      }
      loadAlunos();
    } catch (e: any) {
      alert(e.message || "Não foi possível confirmar o pagamento.");
    } finally {
      setActingOn(null);
    }
  }

  async function handleEnviarWhatsApp(aluno: any) {
    setActingOn(aluno.id);
    try {
      if (!aluno.contractUrl) throw new Error("Esse aluno ainda não assinou o contrato.");

      let comprovanteUrl = aluno.comprovanteUrl;
      if (!comprovanteUrl) {
        const res = await authedFetch("generateComprovante", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId: aluno.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Não foi possível gerar o comprovante");
        comprovanteUrl = data.comprovanteUrl;
      }

      const numero = `55${(aluno.telefone || "").replace(/\D/g, "")}`;
      const texto =
        `Olá, ${aluno.nome}! Segue o seu contrato e o comprovante de matrícula da Novo Jeito Academy:\n\n` +
        `📄 Contrato assinado: ${aluno.contractUrl}\n` +
        `✅ Comprovante de adesão: ${comprovanteUrl}`;
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank");
      loadAlunos();
    } catch (e: any) {
      alert(e.message || "Não foi possível preparar o envio.");
    } finally {
      setActingOn(null);
    }
  }

  async function handleAction(action: "resendAccessEmail" | "resendCertificate" | "resendContract" | "generateComprovante", enrollmentId: string, linkField: string) {
    setActingOn(enrollmentId);
    try {
      const res = await authedFetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");

      const link = data[linkField];
      if (link) {
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          // clipboard pode falhar silenciosamente em alguns navegadores — segue mesmo assim,
          // o prompt abaixo garante que o admin vê e pode copiar na mão de qualquer forma
        }
        // sempre mostra o link na tela (não só copia "no escuro") — assim dá pra confirmar
        // visualmente que é um link novo antes de mandar, e copiar de novo se precisar
        window.prompt("Link gerado agora (já copiado — confirme e cole no WhatsApp do aluno):", link);
      }
      if (action === "resendCertificate") loadAlunos();
    } catch (e: any) {
      alert(e.message || "Não foi possível concluir a ação.");
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="GESTÃO" title="Alunos" subtitle="Cadastro, pagamento, progresso e ações sobre cada aluno matriculado." />

      <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button style={styles.btnPrimary} onClick={() => setShowNovoForm(!showNovoForm)}>
          {showNovoForm ? "Cancelar" : "+ Novo cadastro"}
        </button>
        {!loading && alunos.length > 0 && (
          <button style={styles.linkBtn} onClick={handleExport}>⬇ Exportar CSV ({alunos.length})</button>
        )}
      </div>

      {showNovoForm && (
        <div style={{ ...styles.bolsaCard, marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0.7rem" }}>
            <div>
              <label style={fieldLabelStyle}>Nome completo</label>
              <input style={inputStyle} value={novoForm.nome} onChange={(e) => setNovoForm({ ...novoForm, nome: e.target.value })} placeholder="Nome do aluno" />
            </div>
            <div>
              <label style={fieldLabelStyle}>E-mail</label>
              <input style={inputStyle} value={novoForm.email} onChange={(e) => setNovoForm({ ...novoForm, email: e.target.value })} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label style={fieldLabelStyle}>WhatsApp</label>
              <input style={inputStyle} value={novoForm.telefone} onChange={(e) => setNovoForm({ ...novoForm, telefone: e.target.value })} placeholder="(21) 99999-9999" />
            </div>
            <div>
              <label style={fieldLabelStyle}>CPF</label>
              <input style={inputStyle} value={novoForm.cpf} onChange={(e) => setNovoForm({ ...novoForm, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <label style={fieldLabelStyle}>RG</label>
              <input style={inputStyle} value={novoForm.rg} onChange={(e) => setNovoForm({ ...novoForm, rg: e.target.value })} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Data de nascimento</label>
              <input type="date" style={inputStyle} value={novoForm.dataNascimento} onChange={(e) => setNovoForm({ ...novoForm, dataNascimento: e.target.value })} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Endereço</label>
              <input style={inputStyle} value={novoForm.endereco} onChange={(e) => setNovoForm({ ...novoForm, endereco: e.target.value })} placeholder="Rua, número, bairro" />
            </div>
            <div>
              <label style={fieldLabelStyle}>Cidade</label>
              <input style={inputStyle} value={novoForm.cidade} onChange={(e) => setNovoForm({ ...novoForm, cidade: e.target.value })} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Forma de pagamento</label>
              <select
                style={inputStyle}
                value={novoForm.formaPagamento}
                onChange={(e) => setNovoForm({ ...novoForm, formaPagamento: e.target.value as "dinheiro" | "pago" })}
              >
                <option value="dinheiro">Dinheiro (combinado)</option>
                <option value="pago">Pagamento online (Mercado Pago)</option>
              </select>
            </div>
            {novoForm.formaPagamento === "dinheiro" && (
              <div>
                <label style={fieldLabelStyle}>Valor combinado (R$)</label>
                <input style={inputStyle} value={novoForm.valor} onChange={(e) => setNovoForm({ ...novoForm, valor: e.target.value })} placeholder="697" />
              </div>
            )}
          </div>
          <p style={{ fontSize: "0.76rem", color: "#9d9384", marginTop: "1rem", lineHeight: 1.6 }}>
            O cadastro fica <b>pendente de assinatura</b> até o aluno assinar o contrato pelo link gerado — o acesso só é liberado depois disso.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <button style={styles.btnPrimary} disabled={creatingNovo} onClick={handleCriarCadastro}>
              {creatingNovo ? "Criando..." : "Criar cadastro e gerar link"}
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>}
      {!loading && alunos.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhum aluno cadastrado ainda.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {pageItems.map((a, i) => (
          <div key={a.id || i} style={styles.bolsaCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{a.nome}</div>
                <div style={{ fontSize: "0.78rem", color: "#9d9384", marginTop: "0.2rem" }}>{a.email} · {a.pendente ? "cadastrado em" : "matriculado em"} {a.matricula}</div>
              </div>
              <StatusBadge status={a.pagamento} />
            </div>
            {a.bloqueioMotivo && (
              <div style={{ fontSize: "0.76rem", color: "#e8746a", marginTop: "0.5rem" }}>⚠️ {a.bloqueioMotivo}</div>
            )}

            {!a.pendente && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.9rem" }}>
                <div style={styles.progressBarOuter}>
                  <div style={{ ...styles.progressBarInner, width: `${a.progresso}%` }} />
                </div>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.68rem", color: GOLD }}>{a.progresso}% das aulas</span>
              </div>
            )}

            {!a.pendente && a.boletoParcelasRestantes > 0 && (
              <p style={{ fontSize: "0.76rem", color: "#e8a04a", marginTop: "0.6rem" }}>
                🧾 Faltam {a.boletoParcelasRestantes} parcela{a.boletoParcelasRestantes > 1 ? "s" : ""} do boleto — gere em Financeiro → Cobrança avulsa.
              </p>
            )}

            <div className="aluno-actions" style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              {a.pendente ? (
                <>
                  {a.aguardandoPagamento ? (
                    <>
                      <span style={{ fontSize: "0.76rem", color: "#e8a04a" }}>
                        ⏳ Contrato assinado, aguardando pagamento{a.preferePagamentoDinheiro ? " — 💵 pediu pra pagar em dinheiro" : ""}
                      </span>
                      {a.contractUrl && <a href={a.contractUrl} target="_blank" rel="noreferrer" style={styles.linkBtn}>Ver contrato</a>}
                      <button style={{ ...styles.linkBtn, color: "#78c88c" }} disabled={actingOn === a.id} onClick={() => handleConfirmarPagamento(a)}>
                        {actingOn === a.id ? "Confirmando..." : "💵 Marcar como pago (dinheiro)"}
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "0.76rem", color: "#e8746a" }}>⚠️ Contrato não assinado</span>
                      <button style={styles.linkBtn} onClick={() => handleCopySignLink(a)}>
                        Copiar link para assinar contrato
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {a.contractUrl ? (
                    <a href={a.contractUrl} target="_blank" rel="noreferrer" style={styles.linkBtn}>Ver contrato</a>
                  ) : (
                    <span style={{ fontSize: "0.76rem", color: "#e8746a" }}>⚠️ Contrato não assinado</span>
                  )}
                  {a.certificateUrl && <a href={a.certificateUrl} target="_blank" rel="noreferrer" style={styles.linkBtn}>Ver certificado</a>}
                  {a.contractUrl && (
                    <button style={{ ...styles.linkBtn, color: "#78c88c" }} disabled={actingOn === a.id} onClick={() => handleEnviarWhatsApp(a)}>
                      {actingOn === a.id ? "Preparando..." : "📲 Enviar contrato + comprovante no WhatsApp"}
                    </button>
                  )}
                  <button style={styles.linkBtn} disabled={actingOn === a.id} onClick={() => handleAction("resendAccessEmail", a.id, "loginLink")}>
                    Copiar link de acesso
                  </button>
                  <button style={styles.linkBtn} disabled={actingOn === a.id} onClick={() => handleAction("resendCertificate", a.id, "certificateUrl")}>
                    Copiar link do certificado
                  </button>
                  <button style={styles.linkBtn} disabled={actingOn === a.id} onClick={() => handleAction("generateComprovante", a.id, "comprovanteUrl")}>
                    Copiar comprovante de adesão
                  </button>
                  <button style={styles.linkBtn} onClick={() => handleVerDesempenho(a)}>
                    {detailForId === a.id ? "▲ Fechar desempenho" : "📊 Ver desempenho"}
                  </button>
                  {a.contractUrl ? (
                    <button style={styles.linkBtn} disabled={actingOn === a.id} onClick={() => handleAction("resendContract", a.id, "contractUrl")}>
                      Copiar link do contrato
                    </button>
                  ) : (
                    <button style={styles.linkBtn} onClick={() => handleCopySignLink(a)}>
                      Copiar link para assinar contrato
                    </button>
                  )}
                  <button
                    style={{ ...styles.linkBtn, color: a.bloqueado ? "#78c88c" : "#e8746a" }}
                    disabled={actingOn === a.id}
                    onClick={() => handleToggleAccess(a)}
                  >
                    {a.bloqueado ? "Desbloquear acesso" : "Bloquear acesso"}
                  </button>
                </>
              )}
              <button style={styles.linkBtn} disabled={actingOn === a.id} onClick={() => handleEditar(a)}>
                Editar dados
              </button>
              <button style={{ ...styles.linkBtn, color: "#e8746a" }} disabled={actingOn === a.id} onClick={() => handleExcluir(a)}>
                {a.pendente ? "Excluir cadastro" : "Excluir aluno"}
              </button>
            </div>

            {detailForId === a.id && (
              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(197,138,74,.15)" }}>
                {loadingDetail && <p style={{ color: "#9d9384", fontSize: "0.85rem" }}>Carregando desempenho...</p>}
                {!loadingDetail && detailData?.error && <p style={{ color: "#e8746a", fontSize: "0.85rem" }}>Não foi possível carregar o desempenho desse aluno.</p>}
                {!loadingDetail && detailData && !detailData.error && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1.4rem" }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: GOLD, marginBottom: "0.5rem" }}>AULAS ({detailData.percent}%)</div>
                        {courseModulesFull.length === 0 && <p style={{ fontSize: "0.8rem", color: "#9d9384" }}>Currículo não carregado.</p>}
                        {courseModulesFull.map((m: any) => (
                          <div key={m.id} style={{ marginBottom: "0.7rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>{m.title}</div>
                            {m.lessons.map((l: any) => {
                              const feita = detailData.completedLessons.includes(l.id);
                              return (
                                <div key={l.id} style={{ fontSize: "0.76rem", color: feita ? "#78c88c" : "#5a5348", paddingLeft: "0.6rem" }}>
                                  {feita ? "✓" : "○"} {l.title}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      <div>
                        <div style={{ fontSize: "0.75rem", color: GOLD, marginBottom: "0.5rem" }}>TURMA PRESENCIAL</div>
                        {!detailData.turma && <p style={{ fontSize: "0.8rem", color: "#9d9384" }}>Não está matriculado em nenhuma turma presencial.</p>}
                        {detailData.turma && (
                          <>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>{detailData.turma.nome}</div>
                            {detailData.turma.encontros.map((e: any, i: number) => {
                              const confirmado = detailData.presencas?.[e.data];
                              return (
                                <div key={i} style={{ fontSize: "0.76rem", color: confirmado ? "#78c88c" : "#5a5348" }}>
                                  {confirmado ? "✓" : "○"} {formatDataBRDesempenho(e.data)} · {e.topico}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {editingId === a.id && (
              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(197,138,74,.15)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0.7rem" }}>
                  <div>
                    <label style={fieldLabelStyle}>Nome completo</label>
                    <input style={inputStyle} value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>E-mail (cuidado: isso muda o login dele)</label>
                    <input style={inputStyle} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>WhatsApp</label>
                    <input style={inputStyle} value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>CPF</label>
                    <input style={inputStyle} value={editForm.cpf} onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>RG</label>
                    <input style={inputStyle} value={editForm.rg} onChange={(e) => setEditForm({ ...editForm, rg: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Data de nascimento</label>
                    <input type="date" style={inputStyle} value={editForm.dataNascimento} onChange={(e) => setEditForm({ ...editForm, dataNascimento: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Endereço</label>
                    <input style={inputStyle} value={editForm.endereco} onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Cidade</label>
                    <input style={inputStyle} value={editForm.cidade} onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })} />
                  </div>
                </div>

                <label style={{ ...fieldLabelStyle, marginTop: "1.2rem" }}>Módulos desse aluno (desmarque os que não se aplicam a ele)</label>
                <p style={{ fontSize: "0.72rem", color: "#5a5348", margin: "0.2rem 0 0.4rem" }}>Se ele já sabe só ALGUMAS aulas de um módulo (não o módulo inteiro), deixe o módulo marcado e desmarque só as aulas específicas logo abaixo dele.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.4rem" }}>
                  {courseModules.map((m) => {
                    const moduloAplicavel = editForm.modulosAplicaveis.length === 0 || editForm.modulosAplicaveis.includes(m.id);
                    const moduloCompleto = courseModulesFull.find((cm: any) => cm.id === m.id);
                    return (
                      <div key={m.id}>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#c9c2b4", cursor: "pointer" }}>
                          <input type="checkbox" checked={moduloAplicavel} onChange={() => toggleEditModulo(m.id)} />
                          {m.title}
                        </label>
                        {moduloAplicavel && moduloCompleto && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.35rem", marginLeft: "1.5rem" }}>
                            {moduloCompleto.lessons.map((l: any) => (
                              <label key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "#9d9384", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={!editForm.aulasExcluidas.includes(l.id)}
                                  onChange={() => toggleEditAula(l.id)}
                                />
                                {l.title}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
                  <button style={styles.btnPrimary} disabled={savingEdit} onClick={handleSalvarEdicao}>
                    {savingEdit ? "Salvando..." : "Salvar alterações"}
                  </button>
                  <button style={styles.linkBtn} onClick={() => setEditingId(null)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
      {/* API real: listStudents · toggleStudentAccess · resendAccessEmail · resendCertificate · resendContract · createEnrollment · updateStudent */}
    </div>
  );
}

// ============================================================
// Formados — alunos com certificado já emitido (reaproveita listStudents,
// só filtra quem tem certificateUrl preenchido).
function Formados() {
  const [formados, setFormados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, setPage, totalPages, pageItems } = usePagination(formados);

  useEffect(() => {
    authedFetch("listStudents")
      .then((r) => r.json())
      .then((data) => {
        const alunos = (data.students || []).filter((a: any) => a.certificateUrl);
        alunos.sort((a: any, b: any) => (a.certificateIssuedAt < b.certificateIssuedAt ? 1 : -1));
        setFormados(alunos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleExport() {
    exportToCSV(
      formados.map((a) => ({ Nome: a.nome, Email: a.email, "Certificado emitido em": a.certificateIssuedAt, Código: a.certificateCode })),
      "alunos_formados_novo_jeito_academy.csv"
    );
  }

  return (
    <div>
      <PageHeader eyebrow="TROFÉU" title="Alunos Formados" subtitle="Quem já concluiu o curso e teve o certificado emitido." />

      {!loading && formados.length > 0 && (
        <button style={{ ...styles.linkBtn, marginBottom: "1rem" }} onClick={handleExport}>⬇ Exportar CSV ({formados.length})</button>
      )}

      {loading && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>}
      {!loading && formados.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhum aluno formado ainda.</p>}

      {!loading && formados.length > 0 && (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Aluno</Th><Th>E-mail</Th><Th>Certificado em</Th><Th>Código</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((a) => (
                <tr key={a.id} style={styles.tr}>
                  <Td>{a.nome}</Td>
                  <Td>{a.email}</Td>
                  <Td mono>{a.certificateIssuedAt || "-"}</Td>
                  <Td mono>{a.certificateCode || "-"}</Td>
                  <Td><a href={a.certificateUrl} target="_blank" rel="noreferrer" style={styles.linkBtn}>Ver certificado →</a></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

// ============================================================
function Turmas() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [encontrosForm, setEncontrosForm] = useState([{ topico: "", data: "", horario: "", local: "", moduloRelacionado: "", aulaRelacionada: "" }]);
  const [nomeTurma, setNomeTurma] = useState("");
  const [vagasTurma, setVagasTurma] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState<string | null>(null);
  const [attendanceEncontros, setAttendanceEncontros] = useState<any[]>([]);
  const [attendanceAlunos, setAttendanceAlunos] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [assigningTurmaId, setAssigningTurmaId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [qrModal, setQrModal] = useState<{ url: string; topico: string } | null>(null);
  const [generatingQrFor, setGeneratingQrFor] = useState<string | null>(null);
  const [deletingTurmaId, setDeletingTurmaId] = useState<string | null>(null);
  const [editingTurmaId, setEditingTurmaId] = useState<string | null>(null);
  const [colarGradeText, setColarGradeText] = useState("");
  const [colarGradeErro, setColarGradeErro] = useState("");
  const [onlineModules, setOnlineModules] = useState<{ id: string; title: string }[]>([
    { id: "", title: "Nenhum — não vincular a um módulo" },
  ]);
  const [onlineLessonsByModulo, setOnlineLessonsByModulo] = useState<Record<string, { id: string; title: string }[]>>({});
  const [precoTurma, setPrecoTurma] = useState("");

  useEffect(() => {
    fetch("https://us-central1-barbearia-do-ico.cloudfunctions.net/getCourseContent")
      .then((r) => r.json())
      .then((data) => {
        const mods = (data.modules || []).map((m: any, i: number) => ({
          id: m.id,
          title: `${String(i + 1).padStart(2, "0")} · ${m.title}`,
        }));
        setOnlineModules([{ id: "", title: "Nenhum — não vincular a um módulo" }, ...mods]);
        const lessonsByModulo: Record<string, { id: string; title: string }[]> = {};
        (data.modules || []).forEach((m: any) => {
          lessonsByModulo[m.id] = (m.lessons || []).map((l: any) => ({ id: l.id, title: l.title }));
        });
        setOnlineLessonsByModulo(lessonsByModulo);
      })
      .catch(() => {});
  }, []);

  function loadTurmas() {
    setLoading(true);
    authedFetch("listTurmas?all=1")
      .then((r) => r.json())
      .then((data) => setTurmas(data.turmas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTurmas();
    authedFetch("listStudents")
      .then((r) => r.json())
      .then((data) => setAllStudents(data.students || []))
      .catch(() => {});
  }, []);

  function addEncontroRow() {
    setEncontrosForm((prev) => [...prev, { topico: "", data: "", horario: "", local: "", moduloRelacionado: "", aulaRelacionada: "" }]);
  }

  function updateEncontro(idx: number, field: string, value: string) {
    setEncontrosForm((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }

  function removeEncontro(idx: number) {
    setEncontrosForm((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setNomeTurma("");
    setVagasTurma(10);
    setPrecoTurma("");
    setEncontrosForm([{ topico: "", data: "", horario: "", local: "", moduloRelacionado: "", aulaRelacionada: "" }]);
    setColarGradeText("");
    setColarGradeErro("");
    setEditingTurmaId(null);
    setShowForm(false);
  }

  function openEditTurma(turma: any) {
    setEditingTurmaId(turma.id);
    setNomeTurma(turma.nome);
    setVagasTurma(turma.vagasTotal);
    setPrecoTurma(turma.preco ? String(turma.preco) : "");
    setEncontrosForm(
      (turma.encontros || []).map((e: any) => ({
        topico: e.topico || "",
        data: e.data || "",
        horario: e.horario || "",
        local: e.local || "",
        moduloRelacionado: e.moduloRelacionado || "",
        aulaRelacionada: e.aulaRelacionada || "",
      }))
    );
    setColarGradeText("");
    setColarGradeErro("");
    setShowForm(true);
  }

  // Cola um bloco de texto (uma linha por encontro) e preenche a grade inteira
  // de uma vez, em vez de digitar campo por campo — cada linha:
  // DD/MM/AAAA;HH:MM;Local;idDoMódulo;idDaAula;Tópico
  // (idDoMódulo e idDaAula podem ficar vazios; formato antigo de 5 campos,
  // sem idDaAula, continua funcionando)
  function handleColarGrade() {
    setColarGradeErro("");
    const linhas = colarGradeText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) {
      setColarGradeErro("Cole ao menos uma linha.");
      return;
    }

    const novosEncontros: typeof encontrosForm = [];
    for (const linha of linhas) {
      const partes = linha.split(";").map((p) => p.trim());
      if (partes.length < 5) {
        setColarGradeErro(`Linha fora do formato esperado (5 ou 6 campos separados por ";"): "${linha}"`);
        return;
      }
      const [dataBR, horario, local, moduloRelacionado] = partes;
      const aulaRelacionada = partes.length >= 6 ? partes[4] : "";
      const topicoPartes = partes.length >= 6 ? partes.slice(5) : partes.slice(4);
      const [dia, mes, ano] = dataBR.split("/");
      if (!dia || !mes || !ano) {
        setColarGradeErro(`Data inválida (use DD/MM/AAAA): "${dataBR}"`);
        return;
      }
      novosEncontros.push({
        data: `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`,
        horario,
        local,
        moduloRelacionado,
        aulaRelacionada,
        topico: topicoPartes.join(";"),
      });
    }

    setEncontrosForm(novosEncontros);
  }

  async function handleSalvarTurma() {
    if (!nomeTurma || !vagasTurma || encontrosForm.some((e) => !e.topico || !e.data || !e.horario || !e.local)) {
      alert("Preencha o nome, as vagas e todos os campos de cada encontro.");
      return;
    }

    setCreating(true);
    try {
      const path = editingTurmaId ? "updateTurma" : "createTurma";
      const preco = precoTurma ? parseFloat(precoTurma.replace(",", ".")) : undefined;
      const body = editingTurmaId
        ? { turmaId: editingTurmaId, nome: nomeTurma, vagasTotal: vagasTurma, encontros: encontrosForm, preco }
        : { nome: nomeTurma, vagasTotal: vagasTurma, encontros: encontrosForm, preco };

      const res = await authedFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      resetForm();
      loadTurmas();
    } catch (e: any) {
      alert(e.message || `Não foi possível ${editingTurmaId ? "salvar as alterações da" : "criar a"} turma.`);
    } finally {
      setCreating(false);
    }
  }

  async function verPresenca(turma: any) {
    setAttendanceFor(turma.id);
    setAttendanceEncontros(turma.encontros || []);
    setAttendanceAlunos([]);
    try {
      const res = await authedFetch(`listTurmaAttendance?turmaId=${turma.id}`);
      const data = await res.json();
      setAttendanceAlunos(data.alunos || []);
    } catch {
      setAttendanceAlunos([]);
    }
  }

  async function handleExcluirTurma(turma: any) {
    if (!window.confirm(`Tem certeza que quer EXCLUIR a turma "${turma.nome}" por completo? Isso apaga a turma e a matrícula de todos os alunos nela (incluindo o histórico de presença). Não tem como desfazer.`)) return;
    if (!window.confirm(`Confirma de novo: excluir "${turma.nome}" definitivamente?`)) return;

    setDeletingTurmaId(turma.id);
    try {
      const res = await authedFetch("deleteTurma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId: turma.id }),
      });
      if (!res.ok) throw new Error();
      if (attendanceFor === turma.id) setAttendanceFor(null);
      loadTurmas();
    } catch {
      alert("Não foi possível excluir a turma.");
    } finally {
      setDeletingTurmaId(null);
    }
  }

  function formatDataBR(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  async function handleGerarQR(turmaId: string, data: string) {
    setGeneratingQrFor(`${turmaId}_${data}`);
    try {
      const res = await authedFetch("getLessonCheckinLink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId, data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro");
      setQrModal({ url: json.checkinUrl, topico: json.topico });
    } catch (e: any) {
      alert(e.message || "Não foi possível gerar o QR dessa aula.");
    } finally {
      setGeneratingQrFor(null);
    }
  }

  async function handleAtribuir(turmaId: string) {
    if (!selectedStudentId) return;
    setAssigning(true);
    try {
      const res = await authedFetch("adminAssignTurma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: selectedStudentId, turmaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setSelectedStudentId("");
      setAssigningTurmaId(null);
      loadTurmas();
      alert("Aluno atribuído à turma com sucesso!");
    } catch (e: any) {
      alert(e.message || "Não foi possível atribuir o aluno a essa turma.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="PRESENCIAL" title="Turmas Presenciais" subtitle="Turmas com grade completa de encontros — cada um com seu próprio assunto e data." />

      <button style={styles.btnPrimary} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
        {showForm ? "Cancelar" : "+ Criar nova turma"}
      </button>

      {showForm && (
        <div style={{ ...styles.bolsaCard, marginTop: "1rem" }}>
          <div style={{ ...styles.eyebrow, marginBottom: "0.8rem" }}>
            {editingTurmaId ? "EDITANDO TURMA" : "NOVA TURMA"}
          </div>

          <label style={{ display: "block", fontSize: "0.75rem", color: GOLD, marginBottom: "0.35rem" }}>Nome da turma</label>
          <input value={nomeTurma} onChange={(e) => setNomeTurma(e.target.value)} placeholder="Ex: Turma Agosto/2026" style={inputStyle} />

          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.9rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: GOLD, marginBottom: "0.35rem" }}>Número de vagas</label>
              <input type="number" value={vagasTurma} onChange={(e) => setVagasTurma(parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: GOLD, marginBottom: "0.35rem" }}>Preço específico (opcional)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 350 (deixe em branco pra usar o preço padrão)"
                value={precoTurma}
                onChange={(e) => setPrecoTurma(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#5a5348", marginTop: "0.3rem" }}>Útil pra turma de aluno que já sabe parte do conteúdo e vai pagar um valor diferente do curso completo.</p>

          <div style={{ marginTop: "1.4rem", padding: "1rem", border: "1px dashed rgba(197,138,74,.3)", borderRadius: 4 }}>
            <div style={{ fontSize: "0.75rem", color: GOLD, marginBottom: "0.4rem" }}>Colar grade pronta (opcional)</div>
            <p style={{ fontSize: "0.72rem", color: "#9d9384", marginBottom: "0.6rem" }}>
              Uma linha por encontro, campos separados por ";": <code style={{ color: "#c9c2b4" }}>DD/MM/AAAA;HH:MM;Local;idDoMódulo;idDaAula;Tópico</code> (idDoMódulo e idDaAula podem ficar vazios). Substitui a grade abaixo inteira.
            </p>
            <textarea
              value={colarGradeText}
              onChange={(e) => setColarGradeText(e.target.value)}
              placeholder={"31/08/2026;09:00;Barbearia Novo Jeito;m1;l1;Boas-vindas e Introdução\n02/09/2026;09:00;Barbearia Novo Jeito;m1;l2;Biossegurança"}
              style={{ ...inputStyle, width: "100%", minHeight: 90, fontFamily: "'Space Mono',monospace", fontSize: "0.72rem" }}
            />
            {colarGradeErro && <p style={{ fontSize: "0.75rem", color: "#e8746a", marginTop: "0.5rem" }}>{colarGradeErro}</p>}
            <button onClick={handleColarGrade} style={{ ...styles.linkBtn, marginTop: "0.6rem" }}>Preencher grade com esse texto</button>
          </div>

          <div style={{ marginTop: "1.2rem", fontSize: "0.75rem", color: GOLD }}>Grade de encontros</div>
          {encontrosForm.map((enc, idx) => (
            <div key={idx} style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="Assunto" value={enc.topico} onChange={(e) => updateEncontro(idx, "topico", e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 140 }} />
              <input type="date" value={enc.data} onChange={(e) => updateEncontro(idx, "data", e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 130 }} />
              <input placeholder="Horário" value={enc.horario} onChange={(e) => updateEncontro(idx, "horario", e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 90 }} />
              <input placeholder="Local" value={enc.local} onChange={(e) => updateEncontro(idx, "local", e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 120 }} />
              {encontrosForm.length > 1 && (
                <button onClick={() => removeEncontro(idx)} style={{ ...styles.linkBtn, color: "#e8746a" }}>✕</button>
              )}
              <select
                value={enc.moduloRelacionado}
                onChange={(e) => updateEncontro(idx, "moduloRelacionado", e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              >
                {onlineModules.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              {enc.moduloRelacionado && (onlineLessonsByModulo[enc.moduloRelacionado] || []).length > 0 && (
                <select
                  value={enc.aulaRelacionada}
                  onChange={(e) => updateEncontro(idx, "aulaRelacionada", e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="">Nenhuma aula específica vinculada</option>
                  {onlineLessonsByModulo[enc.moduloRelacionado].map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
          <button onClick={addEncontroRow} style={{ ...styles.linkBtn, marginTop: "0.8rem" }}>+ Adicionar outro encontro</button>

          <div style={{ marginTop: "1.4rem" }}>
            <button style={styles.btnPrimary} onClick={handleSalvarTurma} disabled={creating}>
              {creating ? "Salvando..." : editingTurmaId ? "Salvar alterações" : "Salvar turma"}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: "1.4rem" }}>
        {loading && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>}
        {!loading && turmas.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhuma turma criada ainda.</p>}
        {!loading && turmas.length > 0 && (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Turma</Th><Th>Encontros</Th><Th>Vagas</Th><Th></Th><Th></Th><Th></Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((t) => (
                  <tr key={t.id} style={styles.tr}>
                    <Td>{t.nome}</Td>
                    <Td mono>{t.encontros?.length || 0}</Td>
                    <Td mono>{t.vagasOcupadas}/{t.vagasTotal}</Td>
                    <Td><button style={styles.linkBtn} onClick={() => verPresenca(t)}>Ver presença →</button></Td>
                    <Td><button style={styles.linkBtn} onClick={() => setAssigningTurmaId(assigningTurmaId === t.id ? null : t.id)}>+ Adicionar aluno</button></Td>
                    <Td><button style={styles.linkBtn} onClick={() => openEditTurma(t)}>✎ Editar</button></Td>
                    <Td>
                      <button
                        style={{ ...styles.linkBtn, color: "#e8746a" }}
                        disabled={deletingTurmaId === t.id}
                        onClick={() => handleExcluirTurma(t)}
                      >
                        {deletingTurmaId === t.id ? "Excluindo..." : "🗑 Excluir"}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {assigningTurmaId && (
          <div style={{ ...styles.bolsaCard, marginTop: "1rem", display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 220 }}
            >
              <option value="">Selecione um aluno...</option>
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.nome} — {s.email}</option>
              ))}
            </select>
            <button style={styles.btnPrimary} disabled={!selectedStudentId || assigning} onClick={() => handleAtribuir(assigningTurmaId)}>
              {assigning ? "Atribuindo..." : "Confirmar"}
            </button>
          </div>
        )}
      </div>

      {attendanceFor && (
        <div style={{ marginTop: "1.6rem" }}>
          <SectionLabel>PRESENÇA POR ENCONTRO</SectionLabel>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.2rem" }}>
            {attendanceEncontros.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", fontSize: "0.82rem", padding: "0.5rem 0", borderBottom: "1px solid rgba(197,138,74,.1)" }}>
                <span style={{ color: "#c9c2b4" }}>{formatDataBR(e.data)} · {e.topico}</span>
                <button
                  style={styles.linkBtn}
                  disabled={generatingQrFor === `${attendanceFor}_${e.data}`}
                  onClick={() => handleGerarQR(attendanceFor, e.data)}
                >
                  {generatingQrFor === `${attendanceFor}_${e.data}` ? "Gerando..." : "📱 Gerar QR dessa aula"}
                </button>
              </div>
            ))}
          </div>

          {attendanceAlunos.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.85rem" }}>Ninguém matriculado nessa turma ainda.</p>}
          {attendanceAlunos.length > 0 && (
            <div style={styles.tableCard}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <Th>Aluno</Th>
                    {attendanceEncontros.map((e, i) => (
                      <Th key={i}>{e.topico}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceAlunos.map((a, i) => (
                    <tr key={i} style={styles.tr}>
                      <Td>{a.nome}</Td>
                      {attendanceEncontros.map((e, j) => (
                        <Td key={j} mono>{a.presencas?.[e.data] ? "✓" : "-"}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {qrModal && (
        <div style={styles.qrOverlay} onClick={() => setQrModal(null)}>
          <div style={styles.qrOverlayCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "0.8rem", color: GOLD, marginBottom: "0.4rem" }}>{qrModal.topico}</div>
            <p style={{ fontSize: "0.82rem", color: "#c9c2b4", marginBottom: "1.2rem" }}>Mostre essa tela pros alunos escanearem com o celular (já logados) pra confirmar presença.</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&color=C58A4A&bgcolor=050505&data=${encodeURIComponent(qrModal.url)}`}
              alt="QR Code de check-in da aula"
              style={{ width: "100%", maxWidth: 320, display: "block", margin: "0 auto" }}
            />
            <button style={{ ...styles.btnPrimary, maxWidth: 200, margin: "1.4rem auto 0" }} onClick={() => setQrModal(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
      {/* API real: listTurmas?all=1 · createTurma · listTurmaAttendance · getLessonCheckinLink */}
    </div>
  );
}

const inputStyle: React.CSSProperties = { background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 3, padding: "0.6rem 0.8rem", color: "#F5F0E8", fontSize: "0.82rem", fontFamily: "inherit" };
const smallInputStyle: React.CSSProperties = { background: "#0a0a0a", border: "1px solid rgba(197,138,74,.2)", borderRadius: 3, padding: "0.5rem 0.7rem", color: "#F5F0E8", fontSize: "0.8rem", fontFamily: "inherit" };
const fieldLabelStyle: React.CSSProperties = { display: "block", fontSize: "0.75rem", color: GOLD, marginBottom: "0.35rem" };

// ============================================================
function Bolsas() {
  const [bolsas, setBolsas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  function loadBolsas() {
    authedFetch("listScholarshipApplications")
      .then((r) => r.json())
      .then((data) => setBolsas(data.applications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBolsas();
  }, []);

  async function handleConceder(applicationId: string) {
    setGranting(applicationId);
    try {
      const res = await authedFetch("grantScholarship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");

      if (data.matriculaLink) {
        try {
          await navigator.clipboard.writeText(data.matriculaLink);
        } catch {
          // segue mesmo se falhar — o prompt abaixo garante a cópia manual
        }
        window.prompt(
          "Bolsa aprovada! Envie esse link pro aluno preencher os dados, assinar o contrato e liberar o acesso automaticamente (já copiado — confirme e cole no WhatsApp):",
          data.matriculaLink
        );
      }
      loadBolsas();
    } catch (e: any) {
      alert(e.message || "Não foi possível conceder a bolsa.");
    } finally {
      setGranting(null);
    }
  }

  async function handleRejeitar(applicationId: string) {
    if (!window.confirm("Confirma rejeitar essa candidatura? Ela continua na lista, marcada como não selecionada.")) return;
    setActing(applicationId);
    try {
      const res = await authedFetch("rejectScholarship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!res.ok) throw new Error();
      loadBolsas();
    } catch {
      alert("Não foi possível rejeitar a candidatura.");
    } finally {
      setActing(null);
    }
  }

  async function handleExcluirBolsa(applicationId: string) {
    if (!window.confirm("Tem certeza que quer EXCLUIR essa candidatura por completo? Não tem como desfazer.")) return;
    setActing(applicationId);
    try {
      const res = await authedFetch("deleteScholarship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!res.ok) throw new Error();
      loadBolsas();
    } catch {
      alert("Não foi possível excluir a candidatura.");
    } finally {
      setActing(null);
    }
  }

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
              <StatusBadge status={
                b.status === "novo" ? "Novo" :
                b.status === "contatado" ? "Contatado" :
                b.status === "aprovado" ? "Aguardando aluno" :
                b.status === "selecionado" ? "Matriculado" :
                b.status === "não selecionado" ? "Rejeitada" :
                b.status
              } />
            </div>
            <p style={{ fontSize: "0.86rem", color: "#c9c2b4", marginTop: "0.9rem", lineHeight: 1.6, fontStyle: "italic" }}>"{b.motivo}"</p>
            <div style={{ marginTop: "1rem", display: "flex", gap: "1.2rem", alignItems: "center", flexWrap: "wrap" }}>
              <a href={`https://wa.me/55${(b.whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={styles.linkBtn}>Chamar no WhatsApp →</a>
              {b.status !== "selecionado" && (
                <button
                  style={{ ...styles.linkBtn, color: "#78c88c" }}
                  disabled={granting === b.id || acting === b.id}
                  onClick={() => handleConceder(b.id)}
                >
                  {granting === b.id ? "Gerando link..." : b.status === "aprovado" ? "🔗 Copiar link novamente" : "🎓 Conceder bolsa →"}
                </button>
              )}
              {b.status === "selecionado" && <span style={{ fontSize: "0.78rem", color: "#78c88c" }}>✓ Matrícula concluída — acesso liberado</span>}
              {b.status !== "selecionado" && b.status !== "não selecionado" && (
                <button
                  style={{ ...styles.linkBtn, color: "#e8a04a" }}
                  disabled={granting === b.id || acting === b.id}
                  onClick={() => handleRejeitar(b.id)}
                >
                  {acting === b.id ? "..." : "✕ Rejeitar"}
                </button>
              )}
              <button
                style={{ ...styles.linkBtn, color: "#e8746a" }}
                disabled={granting === b.id || acting === b.id}
                onClick={() => handleExcluirBolsa(b.id)}
              >
                {acting === b.id ? "..." : "🗑 Excluir"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Assinatura da CONTRATADA (dono/instrutor) — desenhada uma vez aqui e reaproveitada
// automaticamente em todo contrato e certificado gerado dali pra frente.
function AssinaturaContratada() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function loadCurrent() {
    authedFetch("getOwnerSignature")
      .then((r) => r.json())
      .then((data) => setCurrent(data.signatureBase64 || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCurrent();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // azul de caneta — o canvas fica transparente (só os traços têm cor), então
    // essa é a cor que vai aparecer de verdade no PDF final (fundo branco)
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    const me = e as React.MouseEvent;
    return { x: (me.clientX - rect.left) * scaleX, y: (me.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }

  function endDraw() {
    drawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleSalvar() {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    setSaving(true);
    try {
      const signatureBase64 = canvas.toDataURL("image/png");
      const res = await authedFetch("saveOwnerSignature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureBase64 }),
      });
      if (!res.ok) throw new Error();
      setCurrent(signatureBase64);
      clearSignature();
    } catch {
      alert("Não foi possível salvar a assinatura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="CONTRATADA"
        title="Assinatura"
        subtitle="Desenhe aqui a sua assinatura uma única vez — ela é carimbada automaticamente em todo contrato e certificado emitido a partir de agora (documentos já emitidos não mudam)."
      />

      {!loading && current && (
        <div style={{ ...styles.bolsaCard, marginBottom: "1.2rem" }}>
          <div style={fieldLabelStyle}>Assinatura atual</div>
          <img src={current} alt="Assinatura atual da contratada" style={{ maxWidth: 300, background: "#111", borderRadius: 3 }} />
        </div>
      )}

      <label style={fieldLabelStyle}>{current ? "Desenhe uma nova assinatura pra substituir a atual" : "Desenhe sua assinatura"}</label>
      <div style={{ position: "relative", maxWidth: 500 }}>
        <canvas
          ref={canvasRef}
          width={500}
          height={160}
          style={{ width: "100%", height: 160, background: "#111", border: "1px dashed rgba(197,138,74,.4)", borderRadius: 3, touchAction: "none", cursor: "crosshair" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <button
          style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.5)", border: "1px solid rgba(197,138,74,.3)", color: "#F5F0E8", fontSize: "0.72rem", padding: "0.3rem 0.6rem", borderRadius: 3, cursor: "pointer" }}
          onClick={clearSignature}
        >
          Limpar
        </button>
      </div>

      <button style={{ ...styles.btnPrimary, maxWidth: 260, marginTop: "1.2rem" }} disabled={!hasSignature || saving} onClick={handleSalvar}>
        {saving ? "Salvando..." : "Salvar assinatura"}
      </button>
    </div>
  );
}

// ============================================================
// URLs das functions — troque barbearia-do-ico pela URL real após o deploy
const GET_CONTENT_URL = "https://us-central1-barbearia-do-ico.cloudfunctions.net/getSiteContent";
const UPDATE_CONTENT_URL = "https://us-central1-barbearia-do-ico.cloudfunctions.net/updateSiteContent";
const UPLOAD_IMAGE_URL = "https://us-central1-barbearia-do-ico.cloudfunctions.net/uploadImage";

interface Testimonial {
  stars: number;
  text: string;
  autor: string;
  turma: string;
}

interface FaqItem {
  pergunta: string;
  resposta: string;
}

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
  precoCursoAvista: number;
  precoCursoCartaoTotal: number;
  precoCursoCartaoParcelas: number;
  precoCursoBoletoTotal: number;
  precoCursoBoletoParcelas: number;
  precoKitAvista: number;
  precoKitCartaoTotal: number;
  precoKitCartaoParcelas: number;
  kitEstoque: number;
  testimonials: Testimonial[];
  faq: FaqItem[];
  scholarshipTitle: string;
  scholarshipText: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  whatsappNumero: string;
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
  precoCursoAvista: 697,
  precoCursoCartaoTotal: 897,
  precoCursoCartaoParcelas: 10,
  precoCursoBoletoTotal: 900,
  precoCursoBoletoParcelas: 3,
  precoKitAvista: 1297,
  precoKitCartaoTotal: 1497,
  precoKitCartaoParcelas: 10,
  kitEstoque: 3,
  testimonials: [],
  faq: [],
  scholarshipTitle: "",
  scholarshipText: "",
  maintenanceMode: false,
  maintenanceMessage: "Estamos com o site em manutenção no momento. Voltamos em breve — obrigado pela paciência!",
  whatsappNumero: "",
};

// ============================================================
function Curriculo() {
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    fetch("https://us-central1-barbearia-do-ico.cloudfunctions.net/getCourseContent")
      .then((r) => r.json())
      .then((data) => setModules(data.modules || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addModule() {
    setModules((prev) => [...prev, { id: `m_${Date.now()}`, title: "Novo módulo", description: "", lessons: [] }]);
  }
  function removeModule(idx: number) {
    if (!window.confirm("Excluir esse módulo inteiro (e todas as aulas dele)?")) return;
    setModules((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateModule(idx: number, field: string, value: string) {
    setModules((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }
  function addLesson(moduleIdx: number) {
    setModules((prev) =>
      prev.map((m, i) =>
        i === moduleIdx
          ? { ...m, lessons: [...m.lessons, { id: `l_${Date.now()}`, title: "Nova aula", duration: "10:00", videoUid: "" }] }
          : m
      )
    );
  }
  function removeLesson(moduleIdx: number, lessonIdx: number) {
    setModules((prev) =>
      prev.map((m, i) => (i === moduleIdx ? { ...m, lessons: m.lessons.filter((_: any, li: number) => li !== lessonIdx) } : m))
    );
  }
  function updateLesson(moduleIdx: number, lessonIdx: number, field: string, value: string) {
    setModules((prev) =>
      prev.map((m, i) =>
        i === moduleIdx
          ? { ...m, lessons: m.lessons.map((l: any, li: number) => (li === lessonIdx ? { ...l, [field]: value } : l)) }
          : m
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await authedFetch("updateCourseContent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules }),
      });
      if (!res.ok) throw new Error();
      setSavedMsg("✓ Currículo salvo — já atualizado na Área do Aluno e no site público.");
    } catch {
      setSavedMsg("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(""), 4000);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="CONTEÚDO DO CURSO" title="Currículo" />
        <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader eyebrow="CONTEÚDO DO CURSO" title="Currículo" subtitle="Módulos e aulas online — o que aparece na Área do Aluno e na grade curricular do site público." />

      {modules.map((mod, mi) => (
        <div key={mod.id} style={{ border: "1px solid rgba(197,138,74,.2)", borderRadius: 6, padding: "1.2rem 1.4rem", marginBottom: "1.2rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "0.8rem" }}>
            <span style={{ fontFamily: "'Space Mono',monospace", color: GOLD, fontSize: "0.85rem" }}>{String(mi + 1).padStart(2, "0")}</span>
            <input value={mod.title} onChange={(e) => updateModule(mi, "title", e.target.value)} placeholder="Título do módulo" style={{ ...inputStyle, flex: 1, fontWeight: 600 }} />
            <button onClick={() => removeModule(mi)} style={{ ...styles.linkBtn, color: "#e8746a" }}>Excluir módulo</button>
          </div>
          <input
            value={mod.description || ""}
            onChange={(e) => updateModule(mi, "description", e.target.value)}
            placeholder="Descrição curta (aparece no site público)"
            style={{ ...inputStyle, width: "100%", marginBottom: "1rem" }}
          />

          <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>AULAS DESSE MÓDULO</div>
          {mod.lessons.map((lesson: any, li: number) => (
            <div key={lesson.id} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <input value={lesson.title} onChange={(e) => updateLesson(mi, li, "title", e.target.value)} placeholder="Título da aula" style={{ ...smallInputStyle, flex: 2, minWidth: 160 }} />
              <input value={lesson.duration} onChange={(e) => updateLesson(mi, li, "duration", e.target.value)} placeholder="MM:SS" style={{ ...smallInputStyle, width: 80 }} />
              <input value={lesson.videoUid} onChange={(e) => updateLesson(mi, li, "videoUid", e.target.value)} placeholder="ID do vídeo (Cloudflare Stream)" style={{ ...smallInputStyle, flex: 1, minWidth: 160 }} />
              <button onClick={() => removeLesson(mi, li)} style={{ ...styles.linkBtn, color: "#e8746a" }}>✕</button>
            </div>
          ))}
          <button onClick={() => addLesson(mi)} style={{ ...styles.linkBtn, marginTop: "0.4rem" }}>+ Adicionar aula nesse módulo</button>
        </div>
      ))}

      <button onClick={addModule} style={{ ...styles.btnGhostGold, marginBottom: "1.6rem" }}>+ Adicionar novo módulo</button>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar currículo"}
        </button>
        {savedMsg && <span style={{ fontSize: "0.82rem", color: savedMsg.startsWith("✓") ? "#78c88c" : "#e8746a" }}>{savedMsg}</span>}
      </div>
      <p style={{ fontSize: "0.76rem", color: "#5a5348", marginTop: "1rem" }}>
        Dica: editar título/duração de uma aula existente não afeta o progresso de quem já assistiu. Só excluir a aula é que "perde" essa marcação específica pra quem já tinha assistido ela.
      </p>
    </div>
  );
}

// ============================================================
// Laboratório Novo Jeito — cadastro de modelos, agenda de horários e fila
// de avaliação do professor (o "Módulo 7" da grade: atendimento supervisionado)
// ============================================================
const CATEGORIAS_AVALIACAO: { key: string; label: string }[] = [
  { key: "tecnica", label: "Técnica" },
  { key: "degrade", label: "Degradê" },
  { key: "tesoura", label: "Tesoura" },
  { key: "barba", label: "Barba" },
  { key: "atendimento", label: "Atendimento" },
  { key: "higiene", label: "Higiene" },
];

function StarRatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.15rem" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, fontSize: "1.1rem", color: n <= value ? GOLD : "rgba(197,138,74,.25)" }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Laboratorio() {
  const [subview, setSubview] = useState<"fila" | "modelos" | "agenda">("fila");

  return (
    <div>
      <PageHeader
        eyebrow="MÓDULO 7"
        title="Laboratório Novo Jeito"
        subtitle="Cadastro de modelos, agenda de horários e avaliação dos atendimentos supervisionados."
      />
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.6rem", flexWrap: "wrap" }}>
        <button onClick={() => setSubview("fila")} style={{ ...styles.btnGhostGold, ...(subview === "fila" ? { background: "rgba(197,138,74,.12)" } : {}) }}>
          Fila de avaliação
        </button>
        <button onClick={() => setSubview("modelos")} style={{ ...styles.btnGhostGold, ...(subview === "modelos" ? { background: "rgba(197,138,74,.12)" } : {}) }}>
          Modelos cadastrados
        </button>
        <button onClick={() => setSubview("agenda")} style={{ ...styles.btnGhostGold, ...(subview === "agenda" ? { background: "rgba(197,138,74,.12)" } : {}) }}>
          Agendar atendimento
        </button>
      </div>

      {subview === "fila" && <FilaAvaliacao />}
      {subview === "modelos" && <ModelosCadastrados />}
      {subview === "agenda" && <AgendarAtendimento />}
    </div>
  );
}

function FilaAvaliacao() {
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avaliando, setAvaliando] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);

  function load() {
    setLoading(true);
    authedFetch("listAtendimentosAdmin?status=realizado")
      .then((r) => r.json())
      .then((data) => setAtendimentos(data.atendimentos || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function abrirAvaliacao(id: string) {
    setAvaliando(id);
    setNotas({ tecnica: 5, degrade: 5, tesoura: 5, barba: 5, atendimento: 5, higiene: 5 });
    setComentario("");
  }

  async function handleAvaliar(atendimentoId: string) {
    setSalvando(true);
    try {
      const res = await authedFetch("avaliarAtendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atendimentoId, avaliacao: notas, comentarioProfessor: comentario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setAvaliando(null);
      load();
    } catch (e: any) {
      alert(e.message || "Não foi possível salvar a avaliação.");
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>;
  if (atendimentos.length === 0) return <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhum atendimento aguardando avaliação no momento.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {atendimentos.map((a) => (
        <div key={a.id} style={styles.bolsaCard}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.modeloNome}</div>
              <div style={{ fontSize: "0.78rem", color: "#9d9384" }}>Atendido por {a.alunoNome} · {(a.servicos || []).join(", ")}</div>
              <div style={{ fontSize: "0.72rem", color: "#5a5348", marginTop: "0.2rem" }}>{a.dataAgendada} às {a.horarioAgendado}</div>
            </div>
            {avaliando !== a.id && (
              <button style={styles.btnPrimary} onClick={() => abrirAvaliacao(a.id)}>Avaliar</button>
            )}
          </div>

          {(a.fotoAntes || a.fotoDepois) && (
            <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.9rem" }}>
              {a.fotoAntes && (
                <div>
                  <div style={{ fontSize: "0.62rem", color: "#9d9384", marginBottom: "0.3rem" }}>ANTES</div>
                  <img src={a.fotoAntes} alt="Antes" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(197,138,74,.2)" }} />
                </div>
              )}
              {a.fotoDepois && (
                <div>
                  <div style={{ fontSize: "0.62rem", color: "#9d9384", marginBottom: "0.3rem" }}>DEPOIS</div>
                  <img src={a.fotoDepois} alt="Depois" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(197,138,74,.2)" }} />
                </div>
              )}
            </div>
          )}

          {avaliando === a.id && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(197,138,74,.15)", paddingTop: "1rem" }}>
              {CATEGORIAS_AVALIACAO.map((c) => (
                <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.82rem" }}>{c.label}</span>
                  <StarRatingInput value={notas[c.key] || 0} onChange={(n) => setNotas((prev) => ({ ...prev, [c.key]: n }))} />
                </div>
              ))}
              <textarea
                placeholder="Comentário do professor (opcional)"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                style={{ ...inputStyle, width: "100%", minHeight: 60, marginTop: "0.6rem" }}
              />
              <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem" }}>
                <button style={styles.btnPrimary} disabled={salvando} onClick={() => handleAvaliar(a.id)}>
                  {salvando ? "Salvando..." : "Confirmar avaliação"}
                </button>
                <button style={styles.linkBtn} onClick={() => setAvaliando(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ModelosCadastrados() {
  const [modelos, setModelos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", idade: "", tipoCabelo: "", servico: "", observacoes: "" });

  function load() {
    authedFetch("listModelos")
      .then((r) => r.json())
      .then((data) => setModelos(data.modelos || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSalvar() {
    if (!form.nome.trim()) {
      alert("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const res = await authedFetch("createModelo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, idade: form.idade ? parseInt(form.idade) : null }),
      });
      if (!res.ok) throw new Error();
      setForm({ nome: "", telefone: "", idade: "", tipoCabelo: "", servico: "", observacoes: "" });
      setShowForm(false);
      load();
    } catch {
      alert("Não foi possível cadastrar o modelo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button style={styles.btnPrimary} onClick={() => setShowForm(!showForm)}>{showForm ? "Cancelar" : "+ Cadastrar modelo"}</button>

      {showForm && (
        <div style={{ ...styles.bolsaCard, marginTop: "1rem", marginBottom: "1.2rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={{ ...inputStyle, flex: 2, minWidth: 160 }} />
            <input placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
            <input placeholder="Idade" type="number" value={form.idade} onChange={(e) => setForm({ ...form, idade: e.target.value })} style={{ ...inputStyle, width: 90 }} />
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <input placeholder="Tipo de cabelo" value={form.tipoCabelo} onChange={(e) => setForm({ ...form, tipoCabelo: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
            <input placeholder="Serviço" value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
          </div>
          <textarea placeholder="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} style={{ ...inputStyle, width: "100%", minHeight: 50, marginTop: "0.6rem" }} />
          <button style={{ ...styles.btnPrimary, marginTop: "0.8rem" }} disabled={saving} onClick={handleSalvar}>{saving ? "Salvando..." : "Salvar modelo"}</button>
        </div>
      )}

      {loading && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>}
      {!loading && modelos.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhum modelo cadastrado ainda.</p>}
      {!loading && modelos.length > 0 && (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead><tr><Th>Nome</Th><Th>Telefone</Th><Th>Idade</Th><Th>Tipo de cabelo</Th><Th>Serviço</Th></tr></thead>
            <tbody>
              {modelos.map((m) => (
                <tr key={m.id} style={styles.tr}>
                  <Td>{m.nome}</Td><Td muted>{m.telefone || "-"}</Td><Td muted>{m.idade || "-"}</Td><Td muted>{m.tipoCabelo || "-"}</Td><Td muted>{m.servico || "-"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgendarAtendimento() {
  const [modelos, setModelos] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [modeloId, setModeloId] = useState("");
  const [nomeModeloNovo, setNomeModeloNovo] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [dataAgendada, setDataAgendada] = useState("");
  const [horarioAgendado, setHorarioAgendado] = useState("");
  const [saving, setSaving] = useState(false);
  const [agendaDia, setAgendaDia] = useState<any[]>([]);

  useEffect(() => {
    authedFetch("listModelos").then((r) => r.json()).then((d) => setModelos(d.modelos || [])).catch(() => {});
    authedFetch("listStudents").then((r) => r.json()).then((d) => setStudents(d.students || [])).catch(() => {});
  }, []);

  function loadAgendaDoDia(data: string) {
    if (!data) return;
    fetch(`${FUNCTIONS_BASE}/getAgendaDoDia?data=${data}`)
      .then((r) => r.json())
      .then((d) => setAgendaDia(d.agenda || []))
      .catch(() => {});
  }

  async function handleAgendar() {
    if (!enrollmentId || !dataAgendada || !horarioAgendado || (!modeloId && !nomeModeloNovo.trim())) {
      alert("Preencha aluno, modelo, data e horário.");
      return;
    }
    setSaving(true);
    try {
      const res = await authedFetch("agendarAtendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modeloId: modeloId || undefined,
          modeloNovo: modeloId ? undefined : { nome: nomeModeloNovo },
          enrollmentId,
          dataAgendada,
          horarioAgendado,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setNomeModeloNovo("");
      setHorarioAgendado("");
      loadAgendaDoDia(dataAgendada);
      alert("Atendimento agendado!");
    } catch (e: any) {
      alert(e.message || "Não foi possível agendar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={styles.bolsaCard}>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
            <option value="">— Modelo novo (digite ao lado) —</option>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          {!modeloId && (
            <input placeholder="Nome do novo modelo" value={nomeModeloNovo} onChange={(e) => setNomeModeloNovo(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
          )}
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
          <select value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
            <option value="">Selecione o aluno responsável</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <input type="date" value={dataAgendada} onChange={(e) => { setDataAgendada(e.target.value); loadAgendaDoDia(e.target.value); }} style={{ ...inputStyle, width: 160 }} />
          <input type="time" value={horarioAgendado} onChange={(e) => setHorarioAgendado(e.target.value)} style={{ ...inputStyle, width: 120 }} />
        </div>
        <button style={{ ...styles.btnPrimary, marginTop: "0.8rem" }} disabled={saving} onClick={handleAgendar}>{saving ? "Agendando..." : "Agendar atendimento"}</button>
      </div>

      {dataAgendada && (
        <div style={{ marginTop: "1.4rem" }}>
          <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>AGENDA DO DIA {dataAgendada.split("-").reverse().join("/")}</div>
          {agendaDia.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.85rem" }}>Nada agendado ainda pra esse dia.</p>}
          {agendaDia.map((item, i) => (
            <div key={i} style={styles.activityRow}>
              <span>{item.horario} — {item.modeloNome}</span>
              <span style={{ color: "#9d9384", fontSize: "0.8rem" }}>{item.alunoNome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Avisos — recado do admin pra Área do Aluno (todos ou um aluno específico)
// ============================================================
function Avisos() {
  const [avisos, setAvisos] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [destino, setDestino] = useState<"todos" | string>("todos");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    authedFetch("listAvisosAdmin")
      .then((r) => r.json())
      .then((data) => setAvisos(data.avisos || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    authedFetch("listStudents").then((r) => r.json()).then((d) => setStudents(d.students || [])).catch(() => {});
  }, []);

  async function handleEnviar() {
    if (!titulo.trim() || !mensagem.trim()) {
      alert("Preencha título e mensagem.");
      return;
    }
    setSaving(true);
    try {
      const res = await authedFetch("createAviso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, mensagem, destinatarios: destino === "todos" ? "todos" : [destino] }),
      });
      if (!res.ok) throw new Error();
      setTitulo("");
      setMensagem("");
      setDestino("todos");
      load();
    } catch {
      alert("Não foi possível enviar o aviso.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(avisoId: string) {
    if (!window.confirm("Remover esse aviso? Ele some da Área do Aluno pra todo mundo.")) return;
    setDeletingId(avisoId);
    try {
      const res = await authedFetch("deleteAviso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avisoId }),
      });
      if (!res.ok) throw new Error();
      load();
    } catch {
      alert("Não foi possível remover o aviso.");
    } finally {
      setDeletingId(null);
    }
  }

  function destinoLabel(a: any) {
    if (a.destinatarios === "todos") return "Todos os alunos";
    const ids: string[] = a.destinatarios || [];
    const nomes = ids.map((id) => students.find((s) => s.id === id)?.nome || "Aluno").join(", ");
    return nomes || "Aluno específico";
  }

  return (
    <div>
      <PageHeader eyebrow="COMUNICAÇÃO" title="Avisos" subtitle="Manda um recado que aparece na Área do Aluno até quem recebeu dispensar." />

      <div style={styles.bolsaCard}>
        <input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        <textarea placeholder="Mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} style={{ ...inputStyle, width: "100%", minHeight: 70, marginTop: "0.6rem" }} />
        <select value={destino} onChange={(e) => setDestino(e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: "0.6rem" }}>
          <option value="todos">Todos os alunos</option>
          {students.map((s) => <option key={s.id} value={s.id}>Só: {s.nome}</option>)}
        </select>
        <button style={{ ...styles.btnPrimary, marginTop: "0.8rem" }} disabled={saving} onClick={handleEnviar}>{saving ? "Enviando..." : "Enviar aviso"}</button>
      </div>

      <div style={{ marginTop: "1.6rem" }}>
        {loading && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>}
        {!loading && avisos.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhum aviso enviado ainda.</p>}
        {!loading && avisos.map((a) => (
          <div key={a.id} style={{ ...styles.activityRow, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{a.titulo}</div>
              <div style={{ fontSize: "0.8rem", color: "#9d9384", marginTop: "0.2rem" }}>{a.mensagem}</div>
              <div style={{ fontSize: "0.68rem", color: "#5a5348", marginTop: "0.3rem" }}>{destinoLabel(a)}</div>
            </div>
            <button style={{ ...styles.linkBtn, color: "#e8746a" }} disabled={deletingId === a.id} onClick={() => handleExcluir(a.id)}>
              {deletingId === a.id ? "..." : "Remover"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  function updateTestimonial(idx: number, field: keyof Testimonial, value: string | number) {
    setContent((prev) => {
      const list = [...prev.testimonials];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, testimonials: list };
    });
  }
  function addTestimonial() {
    setContent((prev) => ({ ...prev, testimonials: [...prev.testimonials, { stars: 5, text: "", autor: "", turma: "" }] }));
  }
  function removeTestimonial(idx: number) {
    setContent((prev) => ({ ...prev, testimonials: prev.testimonials.filter((_, i) => i !== idx) }));
  }

  function updateFaq(idx: number, field: keyof FaqItem, value: string) {
    setContent((prev) => {
      const list = [...prev.faq];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, faq: list };
    });
  }
  function addFaq() {
    setContent((prev) => ({ ...prev, faq: [...prev.faq, { pergunta: "", resposta: "" }] }));
  }
  function removeFaq(idx: number) {
    setContent((prev) => ({ ...prev, faq: prev.faq.filter((_, i) => i !== idx) }));
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

      <div style={{
        border: `1px solid ${content.maintenanceMode ? "#e8746a" : "rgba(197,138,74,.25)"}`,
        borderRadius: 6, padding: "1.2rem 1.4rem", marginBottom: "2rem",
        background: content.maintenanceMode ? "rgba(232,116,106,.08)" : "linear-gradient(160deg,#0d0d0d,#050505)",
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.8rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={content.maintenanceMode}
            onChange={(e) => update("maintenanceMode", e.target.checked)}
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: content.maintenanceMode ? "#e8746a" : "#F5F0E8" }}>
            🛠️ Site em manutenção {content.maintenanceMode ? "(ATIVO — visitantes veem só a tela de manutenção)" : ""}
          </span>
        </label>
        {content.maintenanceMode && (
          <div style={{ marginTop: "1rem" }}>
            <TextField label="Mensagem exibida" value={content.maintenanceMessage} multiline onChange={(v) => update("maintenanceMessage", v)} />
          </div>
        )}
        <p style={{ fontSize: "0.76rem", color: "#5a5348", marginTop: "0.8rem" }}>
          Quando ativado, o site público inteiro (academy.novojeitobarbearia.com.br) mostra só essa tela — ninguém vê o resto do conteúdo até você desativar aqui de novo. Não precisa fazer deploy nenhum, é instantâneo depois de salvar.
        </p>
      </div>

      <FieldGroup title="Capa (Hero)">
        <ImageField label="Foto de capa" url={content.heroImageUrl} uploading={uploadingField === "hero"} onUpload={(f) => handleImageUpload(f, "hero", (url) => update("heroImageUrl", url))} />
        <TextField label="Título" value={content.heroTitle} multiline onChange={(v) => update("heroTitle", v)} hint="Use quebras de linha pra controlar onde o texto quebra" />
        <TextField label="Texto de apoio" value={content.heroLead} multiline onChange={(v) => update("heroLead", v)} />
      </FieldGroup>

      <FieldGroup title="Estatísticas (abaixo do título)">
        <div style={{ display: "flex", gap: "1rem" }}>
          <NumberField label="Alunos formados" value={content.statAlunos} onChange={(v) => update("statAlunos", v)} />
          <NumberField label="Aulas presenciais" value={content.statAulas} onChange={(v) => update("statAulas", v)} />
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

      <FieldGroup title="Contato">
        <TextField
          label="Número de WhatsApp (com DDD, só números)"
          value={content.whatsappNumero}
          onChange={(v) => update("whatsappNumero", v.replace(/\D/g, ""))}
          hint="Ex: 21999999999. Alimenta o botão flutuante de WhatsApp no site público — deixe vazio pra esconder o botão."
        />
      </FieldGroup>

      <FieldGroup title="Investimento — Curso de Barbeiro Profissional">
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <NumberField label="À vista / Pix / dinheiro (R$)" value={content.precoCursoAvista} step="0.01" onChange={(v) => update("precoCursoAvista", v)} />
          <NumberField label="Total no cartão parcelado (R$)" value={content.precoCursoCartaoTotal} step="0.01" onChange={(v) => update("precoCursoCartaoTotal", v)} />
          <NumberField label="Nº de parcelas no cartão" value={content.precoCursoCartaoParcelas} onChange={(v) => update("precoCursoCartaoParcelas", v)} />
          <NumberField label="Total no boleto (R$)" value={content.precoCursoBoletoTotal} step="0.01" onChange={(v) => update("precoCursoBoletoTotal", v)} />
          <NumberField label="Nº de parcelas no boleto" value={content.precoCursoBoletoParcelas} onChange={(v) => update("precoCursoBoletoParcelas", v)} />
        </div>
        <p style={{ fontSize: "0.76rem", color: "#5a5348", marginTop: "0.6rem" }}>
          Cada valor é independente, não é uma divisão automática. O boleto cobra só a 1ª parcela no checkout — as demais precisam ser enviadas manualmente pelo Financeiro (Cobrança avulsa) nas datas de vencimento.
        </p>
      </FieldGroup>

      <FieldGroup title="Investimento — Curso + Kit profissional">
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <NumberField label="À vista / Pix / dinheiro (R$)" value={content.precoKitAvista} step="0.01" onChange={(v) => update("precoKitAvista", v)} />
          <NumberField label="Total no cartão parcelado (R$)" value={content.precoKitCartaoTotal} step="0.01" onChange={(v) => update("precoKitCartaoTotal", v)} />
          <NumberField label="Nº de parcelas no cartão" value={content.precoKitCartaoParcelas} onChange={(v) => update("precoKitCartaoParcelas", v)} />
          <NumberField label="Kits em estoque" value={content.kitEstoque} onChange={(v) => update("kitEstoque", v)} />
        </div>
        <p style={{ fontSize: "0.76rem", color: "#5a5348", marginTop: "0.6rem" }}>
          Não tem boleto nesse plano. Quando o estoque chegar a 0, o site mostra "Temporariamente indisponível" no lugar do botão de matrícula — reponha aqui quando chegar kit novo.
        </p>
      </FieldGroup>

      <FieldGroup title="Bolsa de 100%">
        <TextField label="Título da seção" value={content.scholarshipTitle} onChange={(v) => update("scholarshipTitle", v)} hint="Pode usar <em>palavra</em> pra deixar em dourado itálico" />
        <TextField label="Texto de apoio" value={content.scholarshipText} multiline onChange={(v) => update("scholarshipText", v)} />
      </FieldGroup>

      <FieldGroup title="Depoimentos">
        {content.testimonials.map((t, i) => (
          <div key={i} style={{ border: "1px solid rgba(197,138,74,.15)", borderRadius: 4, padding: "0.9rem", marginBottom: "0.6rem" }}>
            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <input placeholder="Nome" value={t.autor} onChange={(e) => updateTestimonial(i, "autor", e.target.value)} style={{ ...smallInputStyle, flex: 1 }} />
              <input placeholder="Turma" value={t.turma} onChange={(e) => updateTestimonial(i, "turma", e.target.value)} style={{ ...smallInputStyle, width: 120 }} />
              <input type="number" min={1} max={5} value={t.stars} onChange={(e) => updateTestimonial(i, "stars", parseInt(e.target.value) || 5)} style={{ ...smallInputStyle, width: 60 }} />
              <button onClick={() => removeTestimonial(i)} style={{ ...styles.linkBtn, color: "#e8746a" }}>✕</button>
            </div>
            <textarea placeholder="Texto do depoimento" value={t.text} onChange={(e) => updateTestimonial(i, "text", e.target.value)} style={{ ...smallInputStyle, width: "100%", minHeight: 60 }} />
          </div>
        ))}
        <button onClick={addTestimonial} style={{ ...styles.linkBtn, marginTop: "0.4rem" }}>+ Adicionar depoimento</button>
      </FieldGroup>

      <FieldGroup title="Perguntas Frequentes (FAQ)">
        {content.faq.map((f, i) => (
          <div key={i} style={{ border: "1px solid rgba(197,138,74,.15)", borderRadius: 4, padding: "0.9rem", marginBottom: "0.6rem" }}>
            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <input placeholder="Pergunta" value={f.pergunta} onChange={(e) => updateFaq(i, "pergunta", e.target.value)} style={{ ...smallInputStyle, flex: 1 }} />
              <button onClick={() => removeFaq(i)} style={{ ...styles.linkBtn, color: "#e8746a" }}>✕</button>
            </div>
            <textarea placeholder="Resposta" value={f.resposta} onChange={(e) => updateFaq(i, "resposta", e.target.value)} style={{ ...smallInputStyle, width: "100%", minHeight: 60 }} />
          </div>
        ))}
        <button onClick={addFaq} style={{ ...styles.linkBtn, marginTop: "0.4rem" }}>+ Adicionar pergunta</button>
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
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totals, setTotals] = useState({ aprovado: 0, pendente: 0 });
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const { page, setPage, totalPages, pageItems } = usePagination(transactions);

  const [charges, setCharges] = useState<any[]>([]);
  const [loadingCharges, setLoadingCharges] = useState(true);
  const [chargeTipo, setChargeTipo] = useState<"novo" | "existente">("novo");
  const [chargeForm, setChargeForm] = useState({ enrollmentId: "", nome: "", telefone: "", descricao: "", valor: "" });
  const [creatingCharge, setCreatingCharge] = useState(false);
  const [cancelingChargeId, setCancelingChargeId] = useState<string | null>(null);
  const [chargeModal, setChargeModal] = useState<{ url: string; valor: string; tipo: "novo" | "existente" } | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  function loadTransactions() {
    setLoading(true);
    authedFetch("listTransactions")
      .then((r) => r.json())
      .then((data) => {
        setTransactions(data.transactions || []);
        setTotals({ aprovado: data.aprovado || 0, pendente: data.pendente || 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadCharges() {
    setLoadingCharges(true);
    authedFetch("listCharges")
      .then((r) => r.json())
      .then((data) => setCharges(data.charges || []))
      .catch(() => {})
      .finally(() => setLoadingCharges(false));
  }

  useEffect(() => {
    loadTransactions();
    loadCharges();
    authedFetch("listStudents").then((r) => r.json()).then((d) => setStudents(d.students || [])).catch(() => {});
  }, []);

  async function handleCreateCharge() {
    const valorNumerico = parseFloat(chargeForm.valor.replace(",", "."));
    if (!valorNumerico || valorNumerico <= 0) {
      alert("Informe um valor válido.");
      return;
    }
    if (chargeTipo === "existente" && !chargeForm.enrollmentId) {
      alert("Escolha o aluno.");
      return;
    }
    setCreatingCharge(true);
    try {
      const res = await authedFetch("createCharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: chargeTipo === "existente" ? chargeForm.enrollmentId : null,
          nome: chargeTipo === "novo" ? chargeForm.nome || null : null,
          telefone: chargeTipo === "novo" ? chargeForm.telefone || null : null,
          descricao: chargeForm.descricao || null,
          valor: valorNumerico,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");

      setChargeForm({ enrollmentId: "", nome: "", telefone: "", descricao: "", valor: "" });
      setChargeModal({ url: data.checkoutUrl, valor: `R$ ${valorNumerico.toFixed(2).replace(".", ",")}`, tipo: chargeTipo });
      loadCharges();
    } catch (e: any) {
      alert(e.message || "Não foi possível gerar o link de cobrança.");
    } finally {
      setCreatingCharge(false);
    }
  }

  async function handleCancelCharge(chargeId: string) {
    if (!window.confirm("Cancelar essa cobrança pendente?")) return;
    setCancelingChargeId(chargeId);
    try {
      const res = await authedFetch("cancelCharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      loadCharges();
    } catch (e: any) {
      alert(e.message || "Não foi possível cancelar essa cobrança.");
    } finally {
      setCancelingChargeId(null);
    }
  }

  async function handleCopyChargeLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copiado.");
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  function handleExport() {
    exportToCSV(
      transactions.map((t) => ({ Aluno: t.aluno, Valor: t.valor, Metodo: t.metodo, Status: t.status, Data: t.data })),
      "financeiro_novo_jeito_academy.csv"
    );
  }

  async function handleRegistrarDinheiro() {
    const nome = window.prompt("Nome completo do aluno:");
    if (!nome) return;
    const telefone = window.prompt("WhatsApp:");
    if (!telefone) return;
    const valorStr = window.prompt("Valor combinado em dinheiro (R$):", "697");
    if (!valorStr) return;
    const valor = parseFloat(valorStr.replace(",", "."));

    setRegistering(true);
    try {
      const res = await authedFetch("registerCashPayment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, valor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");

      if (data.matriculaLink) {
        try {
          await navigator.clipboard.writeText(data.matriculaLink);
        } catch {
          // segue mesmo se falhar — o prompt abaixo garante a cópia manual
        }
        window.prompt(
          "Envie esse link pro aluno preencher os dados, assinar o contrato e liberar o acesso automaticamente (já copiado — confirme e cole no WhatsApp):",
          data.matriculaLink
        );
      }
      loadTransactions();
    } catch (e: any) {
      alert(e.message || "Não foi possível gerar o link de matrícula.");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="FINANCEIRO" title="Transações" subtitle="Pagamentos aprovados, pendentes e recusados via Mercado Pago." />

      <button style={styles.btnPrimary} disabled={registering} onClick={handleRegistrarDinheiro}>
        {registering ? "Gerando link..." : "+ Gerar link de matrícula (dinheiro)"}
      </button>

      <div style={{ marginTop: "2.2rem" }}>
        <SectionLabel>Cobrança avulsa (link de pagamento)</SectionLabel>
        <p style={{ fontSize: "0.82rem", color: "#9d9384", marginTop: "-0.4rem", marginBottom: "1rem", maxWidth: 620, lineHeight: 1.6 }}>
          Gera um link de pagamento por qualquer valor — entrada, adiantamento ou valor cheio — que termina numa cobrança
          real no Mercado Pago (cartão, Pix ou boleto). A coluna <strong style={{ color: "#c9c2b4" }}>Status</strong> na
          lista abaixo mostra se já foi pago: fica <strong style={{ color: "#78c88c" }}>Pago</strong> assim que o
          Mercado Pago aprova — use o botão "Atualizar" pra ver sem recarregar a página inteira.
        </p>
        <div style={styles.bolsaCard}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <button
              style={{ ...(chargeTipo === "novo" ? styles.btnPrimary : styles.btnGhostGold), flex: "1 1 auto", minWidth: 160 }}
              onClick={() => setChargeTipo("novo")}
            >
              Pessoa nova (sem cadastro)
            </button>
            <button
              style={{ ...(chargeTipo === "existente" ? styles.btnPrimary : styles.btnGhostGold), flex: "1 1 auto", minWidth: 160 }}
              onClick={() => setChargeTipo("existente")}
            >
              Aluno já cadastrado
            </button>
          </div>

          {chargeTipo === "novo" && (
            <>
              <p style={{ fontSize: "0.78rem", color: "#8A8070", marginBottom: "0.8rem", lineHeight: 1.6 }}>
                O link leva a pessoa pro cadastro completo (dados + contrato) e, no final, ela paga esse valor pelo
                Mercado Pago — é o fluxo normal de matrícula, só que com o preço já travado no valor abaixo.
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <input placeholder="Nome (opcional, só de referência)" value={chargeForm.nome} onChange={(e) => setChargeForm({ ...chargeForm, nome: e.target.value })} style={{ ...inputStyle, flex: 2, minWidth: 160 }} />
                <input placeholder="WhatsApp (opcional)" value={chargeForm.telefone} onChange={(e) => setChargeForm({ ...chargeForm, telefone: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
                <input placeholder="Valor (R$)" inputMode="decimal" value={chargeForm.valor} onChange={(e) => setChargeForm({ ...chargeForm, valor: e.target.value })} style={{ ...inputStyle, width: 130 }} />
              </div>
            </>
          )}

          {chargeTipo === "existente" && (
            <>
              <p style={{ fontSize: "0.78rem", color: "#8A8070", marginBottom: "0.8rem", lineHeight: 1.6 }}>
                Vai direto pro checkout do Mercado Pago (sem passar por cadastro/contrato de novo) — pra cobrar um valor
                extra à parte de um aluno que já está no sistema. Não mexe no status nem no valor já pago da matrícula dele.
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <select value={chargeForm.enrollmentId} onChange={(e) => setChargeForm({ ...chargeForm, enrollmentId: e.target.value })} style={{ ...inputStyle, flex: 2, minWidth: 200 }}>
                  <option value="">Selecione o aluno...</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.nome} — {s.email}</option>)}
                </select>
                <input placeholder="Valor (R$)" inputMode="decimal" value={chargeForm.valor} onChange={(e) => setChargeForm({ ...chargeForm, valor: e.target.value })} style={{ ...inputStyle, width: 130 }} />
              </div>
            </>
          )}

          <input
            placeholder="Descrição (opcional, ex: Adiantamento — Turma Janeiro)"
            value={chargeForm.descricao}
            onChange={(e) => setChargeForm({ ...chargeForm, descricao: e.target.value })}
            style={{ ...inputStyle, width: "100%", marginTop: "0.6rem" }}
          />
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
            <button style={{ ...styles.linkBtn, fontSize: "0.75rem" }} onClick={() => setChargeForm({ ...chargeForm, valor: "697" })}>Usar valor cheio (R$ 697)</button>
          </div>
          <button style={{ ...styles.btnPrimary, marginTop: "0.8rem" }} disabled={creatingCharge} onClick={handleCreateCharge}>
            {creatingCharge ? "Gerando link..." : "Gerar link de cobrança"}
          </button>
        </div>

        <div style={{ marginTop: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.8rem", flexWrap: "wrap" }}>
            <button style={{ ...styles.linkBtn, fontSize: "0.78rem" }} disabled={loadingCharges} onClick={loadCharges}>
              {loadingCharges ? "Atualizando..." : "🔄 Atualizar lista"}
            </button>
          </div>
          {loadingCharges && charges.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>}
          {!loadingCharges && charges.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhuma cobrança avulsa gerada ainda.</p>}
          {charges.length > 0 && (
            <div style={styles.tableCard}>
              <table style={{ ...styles.table, minWidth: 760 }}>
                <thead>
                  <tr>
                    <Th>Nome</Th><Th>Tipo</Th><Th>Valor</Th><Th>Descrição</Th><Th>Status</Th><Th>Criada em</Th><Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id} style={styles.tr}>
                      <Td>{c.nome}</Td>
                      <Td muted>{c.tipo}</Td>
                      <Td mono>R$ {(c.valorPago ?? c.valor).toFixed(2).replace(".", ",")}</Td>
                      <Td muted>{c.descricao}</Td>
                      <Td><StatusBadge status={c.status} /></Td>
                      <Td mono>{c.criadaEm}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                          {c.checkoutUrl && c.statusBruto === "pendente" && !c.enrollmentId && (
                            <button style={styles.linkBtn} onClick={() => handleCopyChargeLink(c.checkoutUrl)}>Copiar link</button>
                          )}
                          {c.statusBruto === "pendente" && !c.enrollmentId && (
                            <button style={{ ...styles.linkBtn, color: "#e8746a" }} disabled={cancelingChargeId === c.id} onClick={() => handleCancelCharge(c.id)}>
                              {cancelingChargeId === c.id ? "..." : "Cancelar"}
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...styles.statGrid, marginTop: "2.2rem" }}>
        <StatCard label="APROVADO" value={`R$ ${totals.aprovado.toLocaleString("pt-BR")}`} />
        <StatCard label="PENDENTE" value={`R$ ${totals.pendente.toLocaleString("pt-BR")}`} />
      </div>

      <div style={{ marginTop: "1.6rem" }}>
        {!loading && transactions.length > 0 && (
          <button style={{ ...styles.linkBtn, marginBottom: "1rem" }} onClick={handleExport}>⬇ Exportar CSV ({transactions.length})</button>
        )}
        {loading && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Carregando...</p>}
        {!loading && transactions.length === 0 && <p style={{ color: "#9d9384", fontSize: "0.88rem" }}>Nenhuma transação ainda.</p>}
        {!loading && transactions.length > 0 && (
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Aluno</Th><Th>Valor</Th><Th>Método</Th><Th>Status</Th><Th>Data</Th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t, i) => (
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
        )}
        <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
      </div>
      {chargeModal && (
        <div style={styles.qrOverlay} onClick={() => setChargeModal(null)}>
          <div style={styles.qrOverlayCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "0.8rem", color: GOLD, marginBottom: "0.4rem" }}>Link de cobrança gerado — {chargeModal.valor}</div>
            <p style={{ fontSize: "0.82rem", color: "#c9c2b4", marginBottom: "1.2rem" }}>
              {chargeModal.tipo === "existente"
                ? "Mande esse link por WhatsApp, ou deixe a pessoa escanear o QR Code — vai direto pro checkout do Mercado Pago."
                : "Mande esse link por WhatsApp — a pessoa preenche o cadastro, assina o contrato e paga esse valor pelo Mercado Pago, tudo em sequência."}
            </p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=C58A4A&bgcolor=050505&data=${encodeURIComponent(chargeModal.url)}`}
              alt="QR Code do link de cobrança"
              style={{ width: "100%", maxWidth: 280, display: "block", margin: "0 auto" }}
            />
            <div style={{ wordBreak: "break-all", fontFamily: "'Space Mono',monospace", fontSize: "0.68rem", color: "#9d9384", marginTop: "1rem", padding: "0.6rem", border: "1px solid rgba(197,138,74,.18)", borderRadius: 4 }}>
              {chargeModal.url}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.2rem" }}>
              <button style={{ ...styles.btnGhostGold, flex: 1 }} onClick={() => handleCopyChargeLink(chargeModal.url)}>Copiar link</button>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={() => setChargeModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
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
    "Aguardando aluno": { bg: "rgba(197,138,74,.12)", color: GOLD },
    Matriculado: { bg: "rgba(120,200,140,.12)", color: "#78c88c" },
    Bloqueado: { bg: "rgba(232,116,106,.12)", color: "#e8746a" },
    Cancelado: { bg: "rgba(232,116,106,.12)", color: "#e8746a" },
    "Aguardando cadastro": { bg: "rgba(150,150,150,.12)", color: "#9d9384" },
    "Cadastro iniciado": { bg: "rgba(120,160,200,.12)", color: "#7aa0c8" },
    "Aguardando pagamento": { bg: "rgba(197,138,74,.12)", color: GOLD },
  };
  const s = map[status] || { bg: "rgba(150,150,150,.12)", color: "#999" };
  return <span style={{ background: s.bg, color: s.color, fontSize: "0.72rem", padding: "0.25rem 0.6rem", borderRadius: 3, fontWeight: 600 }}>{status}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100dvh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif" },

  qrOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "2rem" },
  qrOverlayCard: { background: "linear-gradient(160deg,#0d0d0d,#050505)", border: "1px solid rgba(197,138,74,.3)", borderRadius: 8, padding: "2rem", maxWidth: 400, width: "100%", textAlign: "center" },

  sidebar: { width: 260, flexShrink: 0, borderRight: "1px solid rgba(197,138,74,.18)", padding: "1.8rem 1.2rem", height: "100dvh", position: "sticky", top: 0 },
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

  tableCard: { border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, overflow: "hidden", background: "linear-gradient(160deg,#0d0d0d,#050505)", overflowX: "auto" },
  bolsaCard: { border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "1.2rem 1.4rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 560 },
  th: { textAlign: "left", fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.06em", color: "#9d9384", padding: "0.9rem 1.2rem", borderBottom: "1px solid rgba(197,138,74,.18)" },
  tr: { borderBottom: "1px solid rgba(197,138,74,.08)" },
  td: { padding: "0.85rem 1.2rem" },

  activityRow: { display: "flex", justifyContent: "space-between", padding: "0.9rem 1.2rem", borderBottom: "1px solid rgba(197,138,74,.08)" },

  progressBarOuter: { width: 90, height: 5, background: "rgba(197,138,74,.15)", borderRadius: 3, display: "inline-block", marginRight: "0.5rem", overflow: "hidden", verticalAlign: "middle" },
  progressBarInner: { height: "100%", background: GOLD },

  linkBtn: { background: "transparent", border: "none", color: GOLD, fontSize: "0.8rem", cursor: "pointer", textDecoration: "none", font: "inherit" },
  btnPrimary: { background: GOLD, color: "#050505", border: "none", padding: "0.7rem 1.3rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" },
  btnGhostGold: { background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "0.7rem 1.2rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" },
};
