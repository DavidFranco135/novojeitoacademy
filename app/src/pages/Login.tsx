import { useState, useEffect } from "react";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Login sem senha (magic link) — Novo Jeito Academy
 *
 * IMPORTANTE: a opção de autoatendimento (aluno digitar o próprio e-mail e pedir
 * o link sozinho) foi DESATIVADA de propósito — isso disparava um e-mail automático
 * do Firebase com o nome do projeto antigo ("barbearia-do-ico") no remetente, que
 * não tem como ser personalizado nem tirado.
 *
 * O fluxo oficial agora é: o admin gera o link pelo painel (Alunos → "Copiar link
 * de acesso") e manda direto por WhatsApp — isso NÃO passa pelo e-mail do Firebase
 * em nenhum momento, é só um link puro.
 *
 * Essa página ainda precisa existir e continuar processando o clique no link
 * (isSignInWithEmailLink / signInWithEmailLink) — é o que efetivamente loga o
 * aluno quando ele clica no link recebido pelo WhatsApp.
 */

const GOLD = "#C58A4A";

export default function Login() {
  const [error, setError] = useState("");
  const [checkingLink, setCheckingLink] = useState(true);

  useEffect(() => {
    // se o aluno chegou aqui clicando no link (recebido por WhatsApp), completa o login
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let storedEmail = window.localStorage.getItem("emailParaLogin");
      if (!storedEmail) {
        storedEmail = window.prompt("Confirme seu e-mail para concluir o login:");
      }
      if (storedEmail) {
        signInWithEmailLink(auth, storedEmail, window.location.href)
          .then(() => {
            window.localStorage.removeItem("emailParaLogin");
            window.location.href = "/aluno";
          })
          .catch(() => setError("Link inválido ou expirado. Se você abriu esse link direto de dentro do WhatsApp, tente copiar o link e abrir no Safari ou Chrome — às vezes o navegador embutido do WhatsApp não salva o login direito. Se continuar, peça um novo link pra barbearia."))
          .finally(() => setCheckingLink(false));
      } else {
        setCheckingLink(false);
      }
    } else {
      setCheckingLink(false);
    }
  }, []);

  if (checkingLink) {
    return <div style={styles.page}><p style={styles.p}>Verificando login...</p></div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.gridBg}></div>
      <div style={styles.card}>
        <div style={styles.corner_tl}></div><div style={styles.corner_tr}></div>
        <div style={styles.corner_bl}></div><div style={styles.corner_br}></div>
        <div style={styles.logo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>

        <h2 style={styles.h2}>Acesse pelo link do WhatsApp</h2>
        <p style={styles.p}>
          O acesso à sua área do aluno é enviado direto no seu WhatsApp, assim que sua matrícula é confirmada.
        </p>
        <p style={styles.p}>
          Não recebeu ou o link expirou? Chame a barbearia pelo WhatsApp que um novo link é enviado na hora.
        </p>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { position: "relative", minHeight: "100vh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", overflow: "hidden" },
  card: { position: "relative", border: "1px solid rgba(197,138,74,.22)", borderRadius: 6, padding: "2.4rem", maxWidth: 400, width: "100%", background: "linear-gradient(160deg,#0d0d0d,#050505)", zIndex: 1 },
  gridBg: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(197,138,74,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(197,138,74,.05) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse 60% 50% at 50% 40%,black 10%,transparent 75%)", pointerEvents: "none" },
  corner_tl: { position: "absolute", top: 10, left: 10, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_tr: { position: "absolute", top: 10, right: 10, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  corner_bl: { position: "absolute", bottom: 10, left: 10, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_br: { position: "absolute", bottom: 10, right: 10, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  logo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.15rem", marginBottom: "1.8rem", textAlign: "center" },
  h2: { fontFamily: "'Playfair Display',serif", fontSize: "1.35rem", marginBottom: "0.8rem" },
  p: { fontSize: "0.88rem", color: "#9d9384", lineHeight: 1.6, marginBottom: "1rem" },
  error: { color: "#e8746a", fontSize: "0.82rem", marginBottom: "1rem" },
};
