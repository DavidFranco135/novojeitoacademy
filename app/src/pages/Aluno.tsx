import { useState, useMemo, useEffect } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

/**
 * Área do Aluno — Novo Jeito Academy
 * Dashboard estilo plataforma premium: sidebar de trilha, player central,
 * anel de progresso, certificado liberado ao concluir 100%.
 *
 * A grade curricular (títulos/duração/vídeo) é fixa no código — é o conteúdo
 * do curso, não muda por aluno. O que É por aluno (quais aulas já assistiu)
 * vem de verdade do backend via getStudentProgress / markLessonComplete.
 */

const GOLD = "#C58A4A";
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";
const CLOUDFLARE_STREAM_CUSTOMER = "customer-XXXX"; // troque pelo subdomínio real do Cloudflare Stream

interface Lesson {
  id: string;
  title: string;
  duration: string;
  videoUid: string;
  completed: boolean;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

// Grade curricular do curso — conteúdo fixo, igual pra todo aluno.
// "completed" começa falso aqui e é preenchido com o progresso real após a busca.
const COURSE_MODULES: Module[] = [
  {
    id: "m1",
    title: "Fundamentos da Navalha",
    lessons: [
      { id: "l1", title: "Afiação e cuidado das lâminas", duration: "14:20", videoUid: "", completed: false },
      { id: "l2", title: "Postura e ergonomia", duration: "11:05", videoUid: "", completed: false },
      { id: "l3", title: "Segurança de trabalho", duration: "09:40", videoUid: "", completed: false },
      { id: "l15", title: "Tipos de navalha e escolha do equipamento", duration: "20:00", videoUid: "", completed: false },
      { id: "l16", title: "Manutenção e conservação das ferramentas", duration: "18:00", videoUid: "", completed: false },
      { id: "l17", title: "Preparação do cliente e do ambiente de trabalho", duration: "26:55", videoUid: "", completed: false },
    ],
  },
  {
    id: "m2",
    title: "Cortes Clássicos e Degradês",
    lessons: [
      { id: "l4", title: "Social clássico passo a passo", duration: "22:10", videoUid: "", completed: false },
      { id: "l5", title: "Skin fade do zero", duration: "26:45", videoUid: "", completed: false },
      { id: "l18", title: "Degradê baixo (low fade)", duration: "16:00", videoUid: "", completed: false },
      { id: "l19", title: "Degradê médio (mid fade)", duration: "16:00", videoUid: "", completed: false },
      { id: "l20", title: "Degradê alto (high fade)", duration: "15:00", videoUid: "", completed: false },
      { id: "l21", title: "Corte social moderno", duration: "14:00", videoUid: "", completed: false },
      { id: "l22", title: "Corte navalhado", duration: "15:00", videoUid: "", completed: false },
      { id: "l23", title: "Risco e desenhos (line up)", duration: "12:00", videoUid: "", completed: false },
      { id: "l24", title: "Textura e finalização com tesoura", duration: "15:00", videoUid: "", completed: false },
      { id: "l25", title: "Corte infantil", duration: "13:00", videoUid: "", completed: false },
      { id: "l26", title: "Adaptando o corte ao formato do rosto", duration: "17:00", videoUid: "", completed: false },
      { id: "l27", title: "Acabamento com máquina zero", duration: "18:05", videoUid: "", completed: false },
    ],
  },
  {
    id: "m3",
    title: "Barba e Acabamento",
    lessons: [
      { id: "l6", title: "Desenho de barba", duration: "16:30", videoUid: "", completed: false },
      { id: "l7", title: "Toalha quente e finalização", duration: "13:15", videoUid: "", completed: false },
      { id: "l28", title: "Produtos para barba: óleos e balms", duration: "14:00", videoUid: "", completed: false },
      { id: "l29", title: "Barba estilo degradê (fade de barba)", duration: "16:00", videoUid: "", completed: false },
      { id: "l30", title: "Contorno e alinhamento", duration: "15:00", videoUid: "", completed: false },
      { id: "l31", title: "Barboterapia", duration: "18:00", videoUid: "", completed: false },
      { id: "l32", title: "Bigode: técnicas de aparo", duration: "13:00", videoUid: "", completed: false },
      { id: "l33", title: "Cuidados pós-atendimento", duration: "24:15", videoUid: "", completed: false },
    ],
  },
  {
    id: "m4",
    title: "Gestão da Própria Barbearia",
    lessons: [
      { id: "l8", title: "Precificação de serviços", duration: "14:00", videoUid: "", completed: false },
      { id: "l9", title: "Como montar seu portfólio", duration: "15:00", videoUid: "", completed: false },
      { id: "l10", title: "Atendimento e experiência do cliente", duration: "16:00", videoUid: "", completed: false },
      { id: "l11", title: "Fidelização e programa de indicação", duration: "14:00", videoUid: "", completed: false },
      { id: "l12", title: "Redes sociais para barbeiros", duration: "17:00", videoUid: "", completed: false },
      { id: "l13", title: "Gestão financeira básica", duration: "15:00", videoUid: "", completed: false },
      { id: "l14", title: "Como abrir sua própria barbearia", duration: "19:00", videoUid: "", completed: false },
    ],
  },
  {
    id: "m5",
    title: "Tendências 2026: Nevou e Coloração Masculina",
    lessons: [
      { id: "l34", title: "Fades modernos: low, mid, high e taper fade", duration: "18:00", videoUid: "", completed: false },
      { id: "l35", title: "Textured crop e mullet moderno na prática", duration: "20:00", videoUid: "", completed: false },
      { id: "l36", title: "Nevou: teste de mecha e preparação segura", duration: "16:00", videoUid: "", completed: false },
      { id: "l37", title: "Descoloração masculina passo a passo", duration: "24:00", videoUid: "", completed: false },
      { id: "l38", title: "Matização e cuidados pós-coloração", duration: "14:00", videoUid: "", completed: false },
    ],
  },
];

export default function StudentDashboard() {
  const [modules, setModules] = useState<Module[]>(COURSE_MODULES);
  const allLessons = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const [activeLessonId, setActiveLessonId] = useState(allLessons[0].id);
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

  const activeLesson = allLessons.find((l) => l.id === activeLessonId)!;
  const activeModule = modules.find((m) => m.lessons.some((l) => l.id === activeLessonId))!;

  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => l.completed).length;
  const progressPct = Math.round((completedCount / totalLessons) * 100);
  const isComplete = progressPct === 100;

  // busca o progresso real do aluno logado ao carregar
  useEffect(() => {
    async function loadProgress() {
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
          setModules((prev) =>
            prev.map((m) => ({
              ...m,
              lessons: m.lessons.map((l) => ({ ...l, completed: completedIds.includes(l.id) })),
            }))
          );

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
    loadProgress();
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
            {profile.contractUrl && (
              <a href={profile.contractUrl} target="_blank" rel="noreferrer" style={{ ...styles.btnGhostGold, display: "inline-block", marginTop: "1.2rem", textDecoration: "none", textAlign: "center" }}>
                Ver meu contrato
              </a>
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

            <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>AULAS ONLINE — assista quando quiser</div>
            <div style={{ marginBottom: "1.6rem" }}>
              {allLessons.map((lesson, i) => {
                const mod = modules.find((m) => m.lessons.some((l) => l.id === lesson.id));
                return (
                  <div key={lesson.id} style={styles.cronoRow}>
                    <div>
                      <span style={styles.cronoBadgeOnline}>ONLINE</span>
                      <div style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>{lesson.title}</div>
                      <div style={{ fontSize: "0.7rem", color: "#5a5348" }}>{mod?.title} · {lesson.duration}</div>
                    </div>
                    <span style={{ color: lesson.completed ? "#78c88c" : "#5a5348", fontSize: "1rem" }}>{lesson.completed ? "✓" : "○"}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ ...styles.eyebrow, marginBottom: "0.6rem" }}>ENCONTROS PRESENCIAIS — data e horário marcados</div>
            {loadingTurma && <p style={styles.p}>Carregando...</p>}
            {!loadingTurma && !minhaTurma && (
              <p style={styles.p}>
                Você ainda não se matriculou em nenhuma turma presencial.{" "}
                <a href="/aluno/presencial" style={{ color: GOLD }}>Escolher turma →</a>
              </p>
            )}
            {!loadingTurma && minhaTurma && (
              <div>
                {minhaTurma.encontros.map((e, i) => {
                  const confirmado = minhasPresencas[e.data];
                  return (
                    <div key={i} style={styles.cronoRow}>
                      <div>
                        <span style={styles.cronoBadgePresencial}>PRESENCIAL</span>
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
                      <span style={styles.lessonDuration}>{lesson.duration}</span>
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

        <div style={styles.videoFrame}>
          {activeLesson.videoUid ? (
            <iframe
              src={`https://${CLOUDFLARE_STREAM_CUSTOMER}.cloudflarestream.com/${activeLesson.videoUid}/iframe`}
              style={{ width: "100%", height: "100%", border: "none", position: "absolute", inset: 0 }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          ) : (
            <>
              <div style={styles.corner_tl}></div><div style={styles.corner_tr}></div>
              <div style={styles.corner_bl}></div><div style={styles.corner_br}></div>
              <div style={styles.videoPlaceholder}>
                <div style={styles.playRing}>▸</div>
                <span style={styles.eyebrow}>{activeLesson.duration} · VÍDEO AINDA NÃO CADASTRADO</span>
              </div>
            </>
          )}
        </div>

        <div style={styles.lessonHeader}>
          <h1 style={styles.lessonTitle}>{activeLesson.title}</h1>
          {!activeLesson.completed ? (
            <button style={styles.btnPrimary} onClick={() => markComplete(activeLesson.id)}>Marcar como concluída</button>
          ) : (
            <button style={styles.btnGhostGold} onClick={goToNext}>Próxima aula →</button>
          )}
        </div>

        <div style={styles.materialsBox}>
          <div style={styles.eyebrow}>MATERIAIS DE APOIO</div>
          <a href="#" style={styles.materialLink}>📄 Apostila da aula (PDF)</a>
          <a href="#" style={styles.materialLink}>📄 Checklist de prática</a>
        </div>
      </main>
    </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerWrap: { background: "#050505" },
  topbar: { position: "sticky", top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.6rem", background: "rgba(5,5,5,.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(197,138,74,.18)" },
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

  page: { display: "flex", minHeight: "calc(100vh - 53px)", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif" },

  sidebar: { width: 320, flexShrink: 0, borderRight: "1px solid rgba(197,138,74,.18)", padding: "1.8rem 1.4rem", display: "flex", flexDirection: "column", height: "calc(100vh - 53px)", position: "sticky", top: 53, overflowY: "auto" },
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
  lessonDuration: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", color: "#5a5348", flexShrink: 0 },

  certificateBtn: { marginTop: "1.4rem", border: `1px solid ${GOLD}`, background: "transparent", color: GOLD, padding: "0.8rem", borderRadius: 4, fontSize: "0.8rem", fontWeight: 600 },

  main: { flex: 1, padding: "2.4rem 3rem", maxWidth: 980 },
  breadcrumb: { fontSize: "0.75rem", color: "#9d9384", marginBottom: "1rem", fontFamily: "'Space Mono',monospace" },

  videoFrame: { position: "relative", width: "100%", aspectRatio: "16/9", border: "1px solid rgba(197,138,74,.22)", borderRadius: 6, overflow: "hidden", background: "linear-gradient(160deg,#111,#0a0a0a)", marginBottom: "1.6rem" },
  corner_tl: { position: "absolute", top: 12, left: 12, width: 18, height: 18, borderTop: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_tr: { position: "absolute", top: 12, right: 12, width: 18, height: 18, borderTop: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  corner_bl: { position: "absolute", bottom: 12, left: 12, width: 18, height: 18, borderBottom: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_br: { position: "absolute", bottom: 12, right: 12, width: 18, height: 18, borderBottom: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  videoPlaceholder: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" },
  playRing: { width: 60, height: 60, borderRadius: "50%", border: `1px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: "1.2rem" },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: "#9d9384" },

  lessonHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.6rem", gap: "1rem", flexWrap: "wrap" },
  lessonTitle: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem" },
  btnPrimary: { background: GOLD, color: "#050505", border: "none", padding: "0.75rem 1.4rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" },
  btnGhostGold: { background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "0.75rem 1.4rem", borderRadius: 4, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" },

  materialsBox: { border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.6rem" },
  materialLink: { color: "#c9c2b4", fontSize: "0.85rem", textDecoration: "none" },
};
