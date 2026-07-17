import { useState, useEffect } from "react";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendSignInLinkToEmail,
} from "firebase/auth";
import { auth } from "../firebase";

/**
 * Login sem senha (magic link) — Novo Jeito Academy
 *
 * Fluxo:
 *  1) Aluno digita o e-mail usado na matrícula
 *  2) Recebe um link por e-mail (via Firebase Auth, sem custo extra de servidor de e-mail)
 *  3) Ao clicar, é autenticado automaticamente e redirecionado pra área do aluno
 *
 * Configuração necessária no Firebase Console:
 *  Authentication → Sign-in method → ativar "E-mail link (sem senha)"
 *  Authentication → Settings → Domínios autorizados → adicionar seu domínio real
 */

const GOLD = "#C58A4A";
const ACTION_URL = "https://novojeitoapp.pages.dev/login";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingLink, setCheckingLink] = useState(true);

  useEffect(() => {
    // se o usuário chegou aqui clicando no link do e-mail, completa o login automaticamente
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
          .catch(() => setError("Link inválido ou expirado. Solicite um novo."))
          .finally(() => setCheckingLink(false));
      } else {
        setCheckingLink(false);
      }
    } else {
      setCheckingLink(false);
    }
  }, []);

  async function handleSendLink() {
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Digite um e-mail válido.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: ACTION_URL,
        handleCodeInApp: true,
      });
      window.localStorage.setItem("emailParaLogin", email);
      setSent(true);
    } catch (e) {
      setError("Não foi possível enviar o link. Verifique o e-mail e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

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

        {!sent ? (
          <>
            <h2 style={styles.h2}>Acessar minha área</h2>
            <p style={styles.p}>Digite o e-mail usado na matrícula. Você vai receber um link de acesso — sem senha para lembrar.</p>
            <input
              style={styles.input}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btnPrimary} onClick={handleSendLink} disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de acesso"}
            </button>
          </>
        ) : (
          <>
            <h2 style={styles.h2}>Verifique seu e-mail</h2>
            <p style={styles.p}>Enviamos um link de acesso para <b style={{ color: GOLD }}>{email}</b>. Clique nele para entrar automaticamente.</p>
          </>
        )}
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
  h2: { fontFamily: "'Playfair Display',serif", fontSize: "1.35rem", marginBottom: "0.6rem" },
  p: { fontSize: "0.88rem", color: "#9d9384", lineHeight: 1.6, marginBottom: "1.4rem" },
  input: { width: "100%", background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 3, padding: "0.8rem 0.9rem", color: "#F5F0E8", fontSize: "0.9rem", outline: "none", marginBottom: "1rem" },
  error: { color: "#e8746a", fontSize: "0.82rem", marginBottom: "1rem" },
  btnPrimary: { width: "100%", background: GOLD, color: "#050505", border: "none", padding: "0.9rem", borderRadius: 3, fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" },
};
