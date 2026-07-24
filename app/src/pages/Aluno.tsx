import { useState, useMemo, useEffect } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

/**
 * Área do Aluno — Novo Jeito Academy
 * Dashboard estilo plataforma premium: sidebar de trilha, player central,
 * anel de progresso, certificado liberado ao concluir 100%.
 *
 * A grade curricular (módulos/aulas) vem do backend via getCourseContent —
 * editável pelo painel Admin, aba "Currículo". O progresso de cada aluno
 * (quais aulas já assistiu) vem separadamente via getStudentProgress.
 */

const GOLD = "#C58A4A";
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";

const CATEGORIAS_AVALIACAO: { key: string; label: string }[] = [
  { key: "tecnica", label: "Técnica" },
  { key: "degrade", label: "Degradê" },
  { key: "tesoura", label: "Tesoura" },
  { key: "barba", label: "Barba" },
  { key: "atendimento", label: "Atendimento" },
  { key: "higiene", label: "Higiene" },
];

interface Lesson {
  id: string;
  title: string;
  completed: boolean;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface AvaliacaoRecebida {
  id: string;
  modeloNome: string;
  dataAgendada: string;
  avaliacao: Record<string, number>;
  comentarioProfessor?: string;
}

export default function StudentDashboard() {
  const [modules, setModules] = useState<Module[]>([]);
  const allLessons = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const [activeLessonId, setActiveLessonId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [certPendingReason, setCertPendingReason] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ nome: string; email: string; telefone: string; cpf: string; matricula: string | null; contractUrl: string | null } | null>(null);
  const [showMeusDados, setShowMeusDados] = useState(false);
  const [showCronograma, setShowCronograma] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [minhaTurma, setMinhaTurma] = useState<{ nome: string; encontros: { topico: string; data: string; horario: string; local: string; moduloRelacionado?: string }[] } | null>(null);
  const [minhasPresencas, setMinhasPresencas] = useState<Record<string, boolean>>({});
  const [loadingTurma, setLoadingTurma] = useState(false);
  const [avisos, setAvisos] = useState<{ id: string; titulo: string; mensagem: string }[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoRecebida[]>([]);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId)!;
  const activeModule = modules.find((m) => m.lessons.some((l) => l.id === activeLessonId))!;
  const encontrosDoModuloAtivo = minhaTurma && activeModule ? minhaTurma.encontros.filter((e) => e.moduloRelacionado === activeModule.id) : [];

  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => l.completed).length;
  const progressPct = Math.round((completedCount / totalLessons) * 100);
  const isComplete = progressPct === 100;

  // busca o progresso real do aluno logado ao carregar
  useEffect(() => {
    async function loadCourseAndProgress() {
      // 1) busca o currículo (módulos/aulas) — público, editável pelo painel Admin
      let loadedModules: Module[] = [];
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/getCourseContent`);
        const data = await res.json();
        loadedModules = (data.modules || []).map((m: any) => ({
          ...m,
          lessons: m.lessons.map((l: any) => ({ ...l, completed: false })),
        }));
      } catch (e) {
        console.error("Falha ao carregar currículo", e);
      }
      setModules(loadedModules);
      if (loadedModules[0]?.lessons[0]) {
        setActiveLessonId(loadedModules[0].lessons[0].id);
      }

      // 2) busca o progresso do aluno logado, pra marcar quais aulas já foram concluídas
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/getStudentProgress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setEnrollmentId(data.enrollmentId);
          setProfile({
            nome: data.nome,
            email: data.email,
            telefone: data.telefone,
            cpf: data.cpf,
            matricula: data.matricula,
            contractUrl: data.contractUrl,
          });
          setCertificateUrl(data.certificateUrl || null);
          const completedIds: string[] = data.completedLessons || [];
          const modulosAplicaveis: string[] | null = data.modulosAplicaveis || null;
          const aulasExcluidas: string[] = data.aulasExcluidas || [];
          const filteredModules = loadedModules
            .filter((m) => !modulosAplicaveis || modulosAplicaveis.includes(m.id))
            .map((m) => ({
              ...m,
              lessons: m.lessons
                .filter((l) => !aulasExcluidas.includes(l.id))
                .map((l) => ({ ...l, completed: completedIds.includes(l.id) })),
            }))
            .filter((m) => m.lessons.length > 0); // some da trilha se todas as aulas dele foram puladas
          setModules(filteredModules);
          if (filteredModules.length && !filteredModules.some((m) => m.lessons.some((l) => l.id === activeLessonId))) {
            setActiveLessonId(filteredModules[0].lessons[0].id);
          }

          // se os vídeos já estavam 100% mas o certificado ainda não saiu, descobre o motivo
          if (data.percent === 100 && !data.certificateUrl && data.enrollmentId) {
            const certRes = await fetch(`${FUNCTIONS_BASE}/generateCertificate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enrollmentId: data.enrollmentId }),
            });
            const certData = await certRes.json();
            if (certRes.ok) setCertificateUrl(certData.certificateUrl);
            else setCertPendingReason(certData.reason || certData.error || "Requisito pendente");
          }
        }
      } catch (e) {
        console.error("Falha ao carregar progresso", e);
      } finally {
        setLoading(false);
      }
    }
    loadCourseAndProgress();
  }, []);

  // busca a turma presencial do aluno (se tiver) já ao carregar, pra mostrar na trilha
  useEffect(() => {
    async function loadTurma() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
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
        console.error("Falha ao carregar turma", e);
      }
    }
    loadTurma();
  }, []);

  // busca os avisos ativos destinados a esse aluno (recados enviados pelo Admin)
  useEffect(() => {
    async function loadAvisos() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/getMeusAvisos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setAvisos(data.avisos || []);
      } catch (e) {
        console.error("Falha ao carregar avisos", e);
      }
    }
    loadAvisos();
  }, []);

  // busca as avaliações que o professor já deu nos atendimentos do Laboratório
  useEffect(() => {
    async function loadAvaliacoes() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/listMeusAtendimentos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const avaliados = (data.atendimentos || []).filter((a: any) => a.status === "avaliado" && a.avaliacao);
        setAvaliacoes(avaliados.slice(0, 3));
      } catch (e) {
        console.error("Falha ao carregar avaliações", e);
      }
    }
    loadAvaliacoes();
  }, []);

  async function dismissAviso(avisoId: string) {
    setAvisos((prev) => prev.filter((a) => a.id !== avisoId));
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    try {
      await fetch(`${FUNCTIONS_BASE}/dispensarAviso`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avisoId }),
      });
    } catch (e) {
      console.error("Falha ao dispensar aviso", e);
    }
  }

  // mostra o banner de "instalar app" só se ainda não estiver instalado e o aluno não tiver dispensado antes
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem("installBannerDismissed") === "1";
    if (!isStandalone && !dismissed) {
      setShowInstallBanner(true);
    }
  }, []);

  function dismissInstallBanner() {
    localStorage.setItem("installBannerDismissed", "1");
    setShowInstallBanner(false);
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  async function markComplete(lessonId: string) {
    // atualiza a tela na hora (otimista), e confirma com o backend em seguida
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, completed: true } : l)),
      }))
    );

    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    try {
      const res = await fetch(`${FUNCTIONS_BASE}/markLessonComplete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lessonId, totalLessons }),
      });
      const data = await res.json();

      // se acabou de bater 100%, já tenta liberar o certificado
      // (só emite de verdade se a presença na turma presencial também estiver completa)
      if (data.percent === 100 && enrollmentId && !certificateUrl) {
        setGeneratingCert(true);
        const certRes = await fetch(`${FUNCTIONS_BASE}/generateCertificate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId }),
        });
        const certData = await certRes.json();
        if (certRes.ok) {
          setCertificateUrl(certData.certificateUrl);
          setCertPendingReason(null);
        } else {
          setCertPendingReason(certData.reason || certData.error || "Requisito pendente");
        }
        setGeneratingCert(false);
      }
    } catch (e) {
      console.error("Falha ao salvar conclusão da aula", e);
    }
  }

  function goToNext() {
    const idx = allLessons.findIndex((l) => l.id === activeLessonId);
    if (idx < allLessons.length - 1) setActiveLessonId(allLessons[idx + 1].id);
  }

  async function openCronograma() {
    setShowCronograma(true);
    if (minhaTurma) return; // já buscou antes, não busca de novo
    setLoadingTurma(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE}/getMyTurma`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.turma) {
        setMinhaTurma(data.turma);
        setMinhasPresencas(data.presencas || {});
      }
    } catch (e) {
      console.error("Falha ao carregar turma pro cronograma", e);
    } finally {
      setLoadingTurma(false);
    }
  }

  async function handleLogout() {
    if (!window.confirm("Sair da sua área do aluno?")) return;
    await signOut(auth);
    window.location.href = "/login";
  }

  const circumference = 2 * Math.PI * 26;
  const dashOffset = circumference - (progressPct / 100) * circumference;

  if (loading) {
    return (
      <div style={{ ...styles.page, alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9d9384" }}>Carregando sua área...</p>
      </div>
    );
  }

  if (modules.length === 0 || !activeLesson) {
    return (
      <div style={{ ...styles.page, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.6rem" }}>
        <p style={{ color: "#9d9384" }}>O conteúdo do curso ainda não foi cadastrado.</p>
        <p style={{ color: "#5a5348", fontSize: "0.82rem" }}>Assim que os módulos forem criados no painel Admin, eles aparecem aqui automaticamente.</p>
      </div>
    );
  }

  return (
    <div style={styles.outerWrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-thumb{background:rgba(197,138,74,.35);border-radius:4px}

        @media (max-width: 860px) {
          .aluno-page { flex-direction: column !important; }
          .aluno-sidebar {
            width: 100% !important;
            height: auto !important;
            position: static !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(197,138,74,.18) !important;
            max-height: 60vh !important;
            max-height: 60dvh !important;
          }
          .aluno-main { padding: 1.4rem 1.2rem !important; max-width: 100% !important; }
          .topbar-label { display: none !important; }
        }
      `}</style>

      {/* ===== BARRA FIXA — sempre visível, não depende de rolar nada ===== */}
      <header style={styles.topbar}>
        <div style={styles.topbarLogo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>
        <div style={{ display: "flex", gap: "1.4rem", alignItems: "center" }}>
          <button style={styles.topbarLink} onClick={() => setShowMeusDados(true)}>
            👤 <span className="topbar-label">Meus Dados</span>
          </button>
          <button style={styles.topbarLink} onClick={openCronograma}>
            📅 <span className="topbar-label">Meu Cronograma</span>
          </button>
          <a href="/aluno/presencial" style={styles.topbarLink}>
            📍 <span className="topbar-label">Turma Presencial</span>
          </a>
          <a href="/aluno/laboratorio" style={styles.topbarLink}>
            🧪 <span className="topbar-label">Laboratório</span>
          </a>
          <button style={{ ...styles.topbarLink, color: "#e8746a" }} onClick={handleLogout}>
            ⏻ <span className="topbar-label">Sair</span>
          </button>
        </div>
      </header>

      {/* ===== BANNER DE INSTALAÇÃO (some sozinho se já instalado ou dispensado) ===== */}
      {showInstallBanner && (
        <div style={styles.installBanner}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>📲 Instale o app na tela inicial</div>
            <div style={{ fontSize: "0.78rem", color: "#9d9384", marginTop: "0.25rem" }}>
              {isIOS
                ? <>Toque no ícone de compartilhar <b>⬆️</b> do Safari e depois em <b>"Adicionar à Tela de Início"</b>. Assim você abre direto, sem precisar de link toda vez.</>
                : <>Toque no menu <b>⋮</b> do navegador e depois em <b>"Instalar app"</b> ou <b>"Adicionar à tela inicial"</b>. Assim você abre direto, sem precisar de link toda vez.</>
              }
            </div>
          </div>
          <button onClick={dismissInstallBanner} style={styles.installBannerClose}>✕</button>
        </div>
      )}

      {/* ===== AVISOS DO ADMIN — some sozinho quando o aluno dispensa ===== */}
      {avisos.map((aviso) => (
        <div key={aviso.id} style={{ ...styles.installBanner, background: "rgba(197,138,74,.14)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>📣 {aviso.titulo}</div>
            <div style={{ fontSize: "0.78rem", color: "#c9c2b4", marginTop: "0.25rem" }}>{aviso.mensagem}</div>
          </div>
          <button onClick={() => dismissAviso(aviso.id)} style={styles.installBannerClose}>✕</button>
        </div>
      ))}

      {/* ===== MODAL MEUS DADOS ===== */}
      {showMeusDados && profile && (
        <div style={styles.modalOverlay} onClick={() => setShowMeusDados(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.eyebrow}>MEUS DADOS</div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", marginBottom: "1.2rem" }}>{profile.nome}</h2>
            <div style={styles.dataRow}><span style={styles.dataLabel}>E-MAIL</span><span>{profile.email}</span></div>
            <div style={styles.dataRow}><span style={styles.dataLabel}>WHATSAPP</span><span>{profile.telefone}</span></div>
            <div style={styles.dataRow}><span style={styles.dataLabel}>CPF</span><span>{profile.cpf}</span></div>
            {profile.matricula && <div style={styles.dataRow}><span style={styles.dataLabel}>MATRÍCULA</span><span>{profile.matricula}</span></div>}
            {profile.contractUrl ? (
              <a href={profile.contractUrl} target="_blank" rel="noreferrer" style={{ ...styles.btnGhostGold, display: "inline-block", marginTop: "1.2rem", textDecoration: "none", textAlign: "center" }}>
                Ver meu contrato
              </a>
            ) : (
              <>
                <p style={{ fontSize: "0.78rem", color: "#e8746a", marginTop: "1.2rem" }}>⚠️ Seu contrato ainda não foi assinado.</p>
                <a
                  href={`/matricula?assinar=${enrollmentId}`}
                  style={{ ...styles.btnGhostGold, display: "inline-block", marginTop: "0.6rem", textDecoration: "none", textAlign: "center" }}
                >
                  Assinar contrato agora
                </a>
              </>
            )}
            <p style={{ fontSize: "0.76rem", color: "#5a5348", marginTop: "1.4rem", lineHeight: 1.6 }}>Pra corrigir algum desses dados, entre em contato com a barbearia diretamente.</p>
            <button style={{ ...styles.btnGhostGold, width: "100%", marginTop: "1rem" }} onClick={() => setShowMeusDados(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* ===== MODAL MEU CRONOGRAMA ===== */}
      {showCronograma && (
        <div style={styles.modalOverlay} onClick={() => setShowCronograma(false)}>
          <div style={{ ...styles.modalBox, maxWidth: 560, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.eyebrow}>SEQUÊNCIA COMPLETA</div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", marginBottom: "1.4rem" }}>Meu Cronograma</h2>

            <p style={{ fontSize: "0.78rem", color: "#9d9384", marginBottom: "1.2rem" }}>Cada módulo junto com suas aulas e, quando você já tiver turma presencial marcada, os encontros e a presença de cada um.</p>

            {loadingTurma && <p style={styles.p}>Carregando...</p>}
            {!loadingTurma && !minhaTurma && (
              <p style={{ ...styles.p, marginBottom: "1.4rem" }}>
                Você ainda não se matriculou em nenhuma turma presencial — a presença de cada encontro vai aparecer aqui assim que escolher a sua.{" "}
                <a href="/aluno/presencial" style={{ color: GOLD }}>Escolher turma →</a>
              </p>
            )}

            {modules.map((mod) => {
              const encontrosDoModulo = minhaTurma ? minhaTurma.encontros.filter((e) => e.moduloRelacionado === mod.id) : [];
              return (
                <div key={mod.id} style={{ marginBottom: "1.6rem" }}>
                  <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>{mod.title.toUpperCase()}</div>

                  {mod.lessons.map((lesson) => (
                    <div key={lesson.id} style={styles.cronoRow}>
                      <div>
                        <span style={styles.cronoBadgeOnline}>AULA</span>
                        <div style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>{lesson.title}</div>
                      </div>
                      <span style={{ color: lesson.completed ? "#78c88c" : "#5a5348", fontSize: "1rem" }}>{lesson.completed ? "✓" : "○"}</span>
                    </div>
                  ))}

                  {encontrosDoModulo.map((e, i) => {
                    const confirmado = minhasPresencas[e.data];
                    return (
                      <div key={i} style={styles.cronoRow}>
                        <div>
                          <span style={styles.cronoBadgePresencial}>PRESENÇA</span>
                          <div style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>{e.topico}</div>
                          <div style={{ fontSize: "0.7rem", color: "#5a5348" }}>
                            {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} · {e.horario} · {e.local}
                          </div>
                        </div>
                        <span style={{ color: confirmado ? "#78c88c" : "#5a5348", fontSize: "1rem" }}>{confirmado ? "✓" : "○"}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {minhaTurma && minhaTurma.encontros.some((e) => !e.moduloRelacionado || !modules.some((m) => m.id === e.moduloRelacionado)) && (
              <div style={{ marginBottom: "1.6rem" }}>
                <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>OUTROS ENCONTROS</div>
                {minhaTurma.encontros
                  .filter((e) => !e.moduloRelacionado || !modules.some((m) => m.id === e.moduloRelacionado))
                  .map((e, i) => {
                    const confirmado = minhasPresencas[e.data];
                    return (
                      <div key={i} style={styles.cronoRow}>
                        <div>
                          <span style={styles.cronoBadgePresencial}>PRESENÇA</span>
                          <div style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>{e.topico}</div>
                          <div style={{ fontSize: "0.7rem", color: "#5a5348" }}>
                            {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} · {e.horario} · {e.local}
                          </div>
                        </div>
                        <span style={{ color: confirmado ? "#78c88c" : "#5a5348", fontSize: "1rem" }}>{confirmado ? "✓" : "○"}</span>
                      </div>
                    );
                  })}
              </div>
            )}

            <button style={{ ...styles.btnGhostGold, width: "100%", marginTop: "1.4rem" }} onClick={() => setShowCronograma(false)}>Fechar</button>
          </div>
        </div>
      )}

    <div style={styles.page} className="aluno-page">
      {/* ===== SIDEBAR ===== */}
      <aside style={styles.sidebar} className="aluno-sidebar">
        <div style={styles.progressCard}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(197,138,74,.15)" strokeWidth="5" />
            <circle
              cx="32" cy="32" r="26" fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              transform="rotate(-90 32 32)" style={{ transition: "stroke-dashoffset .5s ease" }}
            />
            <text x="32" y="37" textAnchor="middle" fontSize="13" fontFamily="Space Mono, monospace" fill={GOLD}>{progressPct}%</text>
          </svg>
          <div>
            <div style={styles.progressCardLabel}>SEU PROGRESSO</div>
            <div style={styles.progressCardSub}>{completedCount} de {totalLessons} aulas</div>
          </div>
        </div>

        <nav style={styles.moduleNav}>
          {modules.map((mod, mi) => {
            const encontroVinculado = minhaTurma?.encontros.find((e: any) => e.moduloRelacionado === mod.id);
            const presencaConfirmada = encontroVinculado && minhasPresencas[encontroVinculado.data];
            return (
              <div key={mod.id} style={{ marginBottom: "1.4rem" }}>
                <div style={styles.moduleTitle}>
                  <span style={styles.moduleNum}>{String(mi + 1).padStart(2, "0")}</span>
                  {mod.title}
                </div>
                {mod.lessons.map((lesson) => {
                  const isActive = lesson.id === activeLessonId;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setActiveLessonId(lesson.id)}
                      style={{
                        ...styles.lessonItem,
                        background: isActive ? "rgba(197,138,74,.1)" : "transparent",
                        borderLeft: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
                      }}
                    >
                      <span style={{ ...styles.lessonCheck, background: lesson.completed ? GOLD : "transparent", borderColor: lesson.completed ? GOLD : "rgba(197,138,74,.35)" }}>
                        {lesson.completed ? "✓" : ""}
                      </span>
                      <span style={{ flex: 1, textAlign: "left", color: isActive ? "#F5F0E8" : "#9d9384", fontSize: "0.82rem" }}>{lesson.title}</span>
                    </button>
                  );
                })}

                {encontroVinculado && (
                  <a href="/aluno/presencial" style={styles.presencialInline}>
                    <span style={{ ...styles.lessonCheck, background: presencaConfirmada ? GOLD : "transparent", borderColor: presencaConfirmada ? GOLD : "rgba(197,138,74,.35)" }}>
                      {presencaConfirmada ? "✓" : ""}
                    </span>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      <span style={styles.cronoBadgePresencial}>PRÁTICA</span>
                      <div style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>{encontroVinculado.topico}</div>
                      <div style={{ fontSize: "0.68rem", color: "#5a5348" }}>
                        {new Date(encontroVinculado.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {encontroVinculado.horario}
                      </div>
                    </span>
                  </a>
                )}
              </div>
            );
          })}
        </nav>

        {isComplete && certificateUrl ? (
          <a href={certificateUrl} target="_blank" rel="noreferrer" style={{ ...styles.certificateBtn, textDecoration: "none", display: "block", textAlign: "center" }}>
            🎓 Baixar certificado
          </a>
        ) : (
          <button style={{ ...styles.certificateBtn, opacity: 0.4, cursor: "default", fontSize: certPendingReason ? "0.72rem" : "0.8rem" }} disabled>
            {generatingCert
              ? "Verificando..."
              : isComplete && certPendingReason
              ? `🔒 ${certPendingReason}`
              : "🔒 Certificado (conclua o curso)"}
          </button>
        )}
      </aside>

      {/* ===== MAIN ===== */}
      <main style={styles.main} className="aluno-main">
        <div style={styles.breadcrumb}>
          <span style={{ color: GOLD }}>{activeModule.title}</span>
          <span style={{ margin: "0 .5rem", color: "#5a5348" }}>/</span>
          <span>{activeLesson.title}</span>
        </div>

        <div style={styles.presencialCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={styles.eyebrow}>AULAS PRESENCIAIS · {activeModule.title.toUpperCase()}</span>
            {encontrosDoModuloAtivo.length > 0 && (
              <span style={{ fontSize: "0.72rem", color: "#5a5348" }}>
                {encontrosDoModuloAtivo.filter((e) => minhasPresencas[e.data]).length} de {encontrosDoModuloAtivo.length} confirmadas
              </span>
            )}
          </div>

          {!minhaTurma && (
            <p style={{ fontSize: "0.82rem", color: "#9d9384" }}>
              Você ainda não está matriculado em nenhuma turma presencial.{" "}
              <a href="/aluno/presencial" style={{ color: GOLD }}>Escolher turma →</a>
            </p>
          )}

          {minhaTurma && encontrosDoModuloAtivo.length === 0 && (
            <p style={{ fontSize: "0.82rem", color: "#9d9384" }}>As datas presenciais deste módulo ainda não foram cadastradas pela escola.</p>
          )}

          {encontrosDoModuloAtivo.map((e, i) => {
            const confirmado = minhasPresencas[e.data];
            return (
              <div key={i} style={styles.cronoRow}>
                <div>
                  <div style={{ fontSize: "0.88rem" }}>{e.topico}</div>
                  <div style={{ fontSize: "0.75rem", color: "#9d9384", marginTop: "0.25rem" }}>
                    {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · {e.horario} · {e.local}
                  </div>
                </div>
                <span style={{ color: confirmado ? "#78c88c" : "#5a5348", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                  {confirmado ? "✓ Presença confirmada" : "○ Pendente"}
                </span>
              </div>
            );
          })}
        </div>

        <div style={styles.lessonHeader}>
          <h1 style={styles.lessonTitle}>{activeLesson.title}</h1>
          {!activeLesson.completed ? (
            <button style={styles.btnPrimary} onClick={() => markComplete(activeLesson.id)}>Marcar como concluída</button>
          ) : (
            <button style={styles.btnGhostGold} onClick={goToNext}>Próxima aula →</button>
          )}
        </div>

        {avaliacoes.length > 0 && (
          <div style={styles.materialsBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={styles.eyebrow}>AVALIAÇÕES DO PROFESSOR</span>
              <a href="/aluno/laboratorio" style={{ fontSize: "0.72rem", color: GOLD, textDecoration: "none" }}>Ver todas no Laboratório →</a>
            </div>
            {avaliacoes.map((a) => (
              <div key={a.id} style={{ borderTop: "1px solid rgba(197,138,74,.12)", paddingTop: "0.8rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#c9c2b4", marginBottom: "0.4rem" }}>{a.modeloNome} · {a.dataAgendada}</div>
                {CATEGORIAS_AVALIACAO.map((c) => (
                  <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.2rem" }}>
                    <span style={{ color: "#9d9384" }}>{c.label}</span>
                    <span style={{ color: GOLD }}>{"★".repeat(a.avaliacao[c.key] || 0)}{"☆".repeat(5 - (a.avaliacao[c.key] || 0))}</span>
                  </div>
                ))}
                {a.comentarioProfessor && (
                  <p style={{ fontSize: "0.8rem", color: "#c9c2b4", marginTop: "0.4rem", fontStyle: "italic" }}>"{a.comentarioProfessor}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerWrap: { background: "#050505" },
  topbar: { position: "sticky", top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.6rem", background: "rgba(5,5,5,.9)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(197,138,74,.18)" },
  topbarLogo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "0.95rem", color: "#F5F0E8" },
  topbarLink: { background: "none", border: "none", color: "#c9c2b4", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", textDecoration: "none", fontFamily: "'Inter',sans-serif" },

  installBanner: { display: "flex", alignItems: "flex-start", gap: "1rem", padding: "0.9rem 1.4rem", background: "rgba(197,138,74,.08)", borderBottom: "1px solid rgba(197,138,74,.2)" },
  installBannerClose: { background: "none", border: "none", color: "#9d9384", fontSize: "1rem", cursor: "pointer", flexShrink: 0, padding: "0.2rem" },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" },
  modalBox: { background: "linear-gradient(160deg,#0d0d0d,#050505)", border: "1px solid rgba(197,138,74,.25)", borderRadius: 8, padding: "2rem", maxWidth: 380, width: "100%", color: "#F5F0E8" },
  dataRow: { display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid rgba(197,138,74,.1)", fontSize: "0.85rem" },
  dataLabel: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", color: GOLD, letterSpacing: "0.04em" },

  cronoRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.7rem 0", borderBottom: "1px solid rgba(197,138,74,.1)" },
  cronoBadgeOnline: { fontFamily: "'Space Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.06em", border: "1px solid rgba(197,138,74,.35)", color: GOLD, padding: "0.15rem 0.4rem", borderRadius: 2 },
  cronoBadgePresencial: { fontFamily: "'Space Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.06em", background: GOLD, color: "#050505", padding: "0.15rem 0.4rem", borderRadius: 2 },

  page: { display: "flex", minHeight: "calc(100dvh - 53px)", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif" },

  sidebar: { width: 320, flexShrink: 0, borderRight: "1px solid rgba(197,138,74,.18)", padding: "1.8rem 1.4rem", display: "flex", flexDirection: "column", height: "calc(100dvh - 53px)", position: "sticky", top: 53, overflowY: "auto" },
  sidebarLogo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.05rem", marginBottom: "1.6rem" },

  progressCard: { display: "flex", alignItems: "center", gap: "0.9rem", border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "0.9rem", marginBottom: "1.8rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  progressCardLabel: { fontFamily: "'Space Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.1em", color: GOLD },
  progressCardSub: { fontSize: "0.78rem", color: "#9d9384", marginTop: "0.15rem" },

  moduleNav: { flex: 1 },
  moduleTitle: { display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "#9d9384", marginBottom: "0.6rem", fontWeight: 600 },
  moduleNum: { fontFamily: "'Space Mono',monospace", color: GOLD },

  lessonItem: { display: "flex", alignItems: "center", gap: "0.7rem", width: "100%", padding: "0.55rem 0.6rem", border: "none", borderRadius: 3, cursor: "pointer", marginBottom: "0.15rem" },
  presencialInline: { display: "flex", alignItems: "flex-start", gap: "0.7rem", width: "100%", padding: "0.6rem", marginTop: "0.3rem", borderRadius: 3, textDecoration: "none", color: "#F5F0E8", background: "rgba(197,138,74,.06)", border: "1px dashed rgba(197,138,74,.3)" },
  lessonCheck: { width: 16, height: 16, borderRadius: "50%", border: "1px solid", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "#050505" },

  certificateBtn: { marginTop: "1.4rem", border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, padding: "0.8rem", borderRadius: 4, fontSize: "0.8rem", fontWeight: 600 },

  main: { flex: 1, padding: "2.4rem 3rem", maxWidth: 980 },
  breadcrumb: { fontSize: "0.75rem", color: "#9d9384", marginBottom: "1rem", fontFamily: "'Space Mono',monospace" },

  presencialCard: { border: "1px solid rgba(197,138,74,.22)", borderRadius: 6, padding: "1.2rem 1.4rem", background: "linear-gradient(160deg,#111,#0a0a0a)", marginBottom: "1.6rem" },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: "#9d9384" },

  lessonHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.6rem", gap: "1rem", flexWrap: "wrap" },
  lessonTitle: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem" },
  btnPrimary: { background: GOLD, color: "#050505", border: "none", padding: "0.75rem 1.4rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" },
  btnGhostGold: { background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "0.75rem 1.4rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" },

  materialsBox: { border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.6rem" },
};
