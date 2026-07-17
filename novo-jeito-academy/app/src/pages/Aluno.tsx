import { useState, useMemo } from "react";

/**
 * Área do Aluno — Novo Jeito Academy
 * Dashboard estilo plataforma premium (Hotmart/Kajabi-like): sidebar de trilha,
 * player central, anel de progresso, certificado liberado ao concluir 100%.
 *
 * Integração esperada:
 *  - GET  /api/getStudentProgress?enrollmentId=...   -> módulos, aulas, % assistido por aula
 *  - POST /api/markLessonComplete                    -> marca aula como concluída
 *  - GET  /api/getCertificate?enrollmentId=...        -> retorna URL do PDF do certificado (gerado quando 100%)
 *
 * Vídeo: player embutido via Cloudflare Stream (iframe nativo), progresso reportado
 * pelo player através dos eventos do Stream Player SDK (stream.cloudflare.com/embed/sdk.js).
 * Cada aula tem um "videoUid" do Cloudflare Stream, e o embed fica:
 *   <iframe src={`https://customer-XXXX.cloudflarestream.com/${videoUid}/iframe`} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen />
 */

const GOLD = "#C58A4A";
const GOLD2 = "#E8B97A";

interface Lesson {
  id: string;
  title: string;
  duration: string;
  videoUid: string; // UID do vídeo no Cloudflare Stream
  completed: boolean;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

// dado de exemplo — substituir pela resposta real de /api/getStudentProgress
const MOCK_MODULES: Module[] = [
  {
    id: "m1",
    title: "Fundamentos da Navalha",
    lessons: [
      { id: "l1", title: "Afiação e cuidado das lâminas", duration: "14:20", videoUid: "", completed: true },
      { id: "l2", title: "Postura e ergonomia", duration: "11:05", videoUid: "", completed: true },
      { id: "l3", title: "Segurança de trabalho", duration: "09:40", videoUid: "", completed: false },
    ],
  },
  {
    id: "m2",
    title: "Cortes Clássicos e Degradês",
    lessons: [
      { id: "l4", title: "Social clássico passo a passo", duration: "22:10", videoUid: "", completed: false },
      { id: "l5", title: "Skin fade do zero", duration: "26:45", videoUid: "", completed: false },
    ],
  },
  {
    id: "m3",
    title: "Barba e Acabamento",
    lessons: [
      { id: "l6", title: "Desenho de barba", duration: "16:30", videoUid: "", completed: false },
      { id: "l7", title: "Toalha quente e finalização", duration: "13:15", videoUid: "", completed: false },
    ],
  },
];

export default function StudentDashboard() {
  const [modules, setModules] = useState<Module[]>(MOCK_MODULES);
  const allLessons = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const [activeLessonId, setActiveLessonId] = useState(allLessons[0].id);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId)!;
  const activeModule = modules.find((m) => m.lessons.some((l) => l.id === activeLessonId))!;

  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => l.completed).length;
  const progressPct = Math.round((completedCount / totalLessons) * 100);
  const isComplete = progressPct === 100;

  function markComplete(lessonId: string) {
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, completed: true } : l)),
      }))
    );
    // fetch("/api/markLessonComplete", { method: "POST", body: JSON.stringify({ lessonId }) });
  }

  function goToNext() {
    const idx = allLessons.findIndex((l) => l.id === activeLessonId);
    if (idx < allLessons.length - 1) setActiveLessonId(allLessons[idx + 1].id);
  }

  const circumference = 2 * Math.PI * 26;
  const dashOffset = circumference - (progressPct / 100) * circumference;

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-thumb{background:rgba(197,138,74,.35);border-radius:4px}
      `}</style>

      {/* ===== SIDEBAR ===== */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>

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
          {modules.map((mod, mi) => (
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
            </div>
          ))}
        </nav>

        <button style={{ ...styles.certificateBtn, opacity: isComplete ? 1 : 0.4, cursor: isComplete ? "pointer" : "default" }} disabled={!isComplete}>
          {isComplete ? "🎓 Baixar certificado" : "🔒 Certificado (conclua o curso)"}
        </button>
      </aside>

      {/* ===== MAIN ===== */}
      <main style={styles.main}>
        <div style={styles.breadcrumb}>
          <span style={{ color: GOLD }}>{activeModule.title}</span>
          <span style={{ margin: "0 .5rem", color: "#5a5348" }}>/</span>
          <span>{activeLesson.title}</span>
        </div>

        <div style={styles.videoFrame}>
          <div style={styles.corner_tl}></div><div style={styles.corner_tr}></div>
          <div style={styles.corner_bl}></div><div style={styles.corner_br}></div>
          <div style={styles.videoPlaceholder}>
            <div style={styles.playRing}>▸</div>
            <span style={styles.eyebrow}>{activeLesson.duration} · REPRODUZIR AULA</span>
          </div>
          {/*
            Embed real do Panda Video, por exemplo:
            <iframe
              src={`https://customer-XXXX.cloudflarestream.com/${activeLesson.videoUid}/iframe`}
              style={{width:'100%',height:'100%',border:'none'}}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          */}
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
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100vh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif" },

  sidebar: { width: 320, flexShrink: 0, borderRight: "1px solid rgba(197,138,74,.18)", padding: "1.8rem 1.4rem", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, overflowY: "auto" },
  sidebarLogo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.05rem", marginBottom: "1.6rem" },

  progressCard: { display: "flex", alignItems: "center", gap: "0.9rem", border: "1px solid rgba(197,138,74,.18)", borderRadius: 6, padding: "0.9rem", marginBottom: "1.8rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  progressCardLabel: { fontFamily: "'Space Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.1em", color: GOLD },
  progressCardSub: { fontSize: "0.78rem", color: "#9d9384", marginTop: "0.15rem" },

  moduleNav: { flex: 1 },
  moduleTitle: { display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "#9d9384", marginBottom: "0.6rem", fontWeight: 600 },
  moduleNum: { fontFamily: "'Space Mono',monospace", color: GOLD },

  lessonItem: { display: "flex", alignItems: "center", gap: "0.7rem", width: "100%", padding: "0.55rem 0.6rem", border: "none", borderRadius: 3, cursor: "pointer", marginBottom: "0.15rem" },
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
