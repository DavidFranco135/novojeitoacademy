import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { auth } from "../firebase";

/**
 * Check-in de presença por encontro — Novo Jeito Academy
 *
 * O aluno chega aqui escaneando, com o PRÓPRIO celular já logado, o QR que o
 * professor exibiu numa tela no fim da aula. O token na URL só identifica o
 * encontro (turma + data) — é o login do aluno que identifica quem está
 * confirmando presença, então cada um só consegue confirmar a própria.
 */

const GOLD = "#C58A4A";
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";

type Status = "loading" | "success" | "already" | "error";

export default function LessonCheckin() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      if (!token) {
        setStatus("error");
        setMessage("QR Code inválido.");
        return;
      }
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch(`${FUNCTIONS_BASE}/confirmLessonCheckin`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Não foi possível confirmar presença.");
          return;
        }
        if (data.jaConfirmado) {
          setStatus("already");
          setMessage(`Sua presença em "${data.topico}" já estava confirmada.`);
        } else {
          setStatus("success");
          setMessage(
            `Presença confirmada em "${data.topico}", ${data.nome}!` +
              (data.certificadoLiberado ? " 🎓 Parabéns, seu certificado foi liberado!" : "")
          );
        }
      } catch {
        setStatus("error");
        setMessage("Não foi possível confirmar presença. Tente novamente.");
      }
    })();
  }, [token]);

  const color = status === "error" ? "#e8746a" : GOLD;
  const icon = status === "loading" ? "…" : status === "error" ? "✕" : "✓";
  const title =
    status === "loading" ? "Confirmando presença..." : status === "error" ? "Não foi possível confirmar" : "Check-in confirmado";

  return (
    <div style={styles.page}>
      <div style={styles.gridBg}></div>
      <div style={{ ...styles.box, borderColor: color, boxShadow: `0 0 40px -12px ${color}55` }}>
        <div style={{ ...styles.corner, ...styles.cTl, borderColor: color }}></div>
        <div style={{ ...styles.corner, ...styles.cTr, borderColor: color }}></div>
        <div style={{ ...styles.corner, ...styles.cBl, borderColor: color }}></div>
        <div style={{ ...styles.corner, ...styles.cBr, borderColor: color }}></div>
        <div style={{ ...styles.icon, borderColor: color, color }}>{icon}</div>
        <h1 style={{ ...styles.h1, color }}>{title}</h1>
        {status !== "loading" && <p style={styles.p}>{message}</p>}
        {status !== "loading" && (
          <a href="/aluno" style={styles.link}>
            ← Voltar pra área do aluno
          </a>
        )}
        <span style={styles.eyebrow}>TURMA PRESENCIAL</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { position: "relative", minHeight: "100dvh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", overflow: "hidden", textAlign: "center" },
  gridBg: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(197,138,74,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(197,138,74,.06) 1px,transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse 60% 55% at 50% 45%,black 10%,transparent 75%)" },
  box: { position: "relative", border: "1px solid", borderRadius: 8, padding: "2.6rem 2.2rem", maxWidth: 380, width: "100%", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  corner: { position: "absolute", width: 16, height: 16 },
  cTl: { top: 10, left: 10, borderTop: "1px solid", borderLeft: "1px solid" },
  cTr: { top: 10, right: 10, borderTop: "1px solid", borderRight: "1px solid" },
  cBl: { bottom: 10, left: 10, borderBottom: "1px solid", borderLeft: "1px solid" },
  cBr: { bottom: 10, right: 10, borderBottom: "1px solid", borderRight: "1px solid" },
  icon: { width: 60, height: 60, lineHeight: "60px", border: "1px solid", borderRadius: "50%", fontSize: "1.8rem", margin: "0 auto 1.2rem" },
  h1: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.4rem", margin: "0 0 0.8rem" },
  p: { color: "#c9c2b4", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 },
  link: { display: "inline-block", marginTop: "1.4rem", color: GOLD, fontSize: "0.82rem", textDecoration: "none" },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.18em", color: "#5a5348", marginTop: "1.6rem", display: "block" },
};
