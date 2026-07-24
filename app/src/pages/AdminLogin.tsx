import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase";

/**
 * Login interno (e-mail + senha) — Novo Jeito Academy
 *
 * Separado do login do aluno (que é por link mágico, sem senha).
 * Pensado pra quem acessa o painel todo dia (dono da barbearia, equipe) — mais rápido
 * que abrir e-mail toda vez.
 *
 * IMPORTANTE: criar uma conta aqui NÃO dá acesso ao painel admin sozinho — o acesso
 * de verdade só é liberado depois que o UID da pessoa é adicionado na coleção
 * "admins" do Firestore (ver README, seção 7). Ou seja: qualquer pessoa pode criar
 * login, mas só quem foi liberado manualmente consegue entrar em /admin.
 */

const GOLD = "#C58A4A";

export default function AdminLogin() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password.length < 6) {
          setError("A senha precisa ter no mínimo 6 caracteres.");
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      }
      window.location.href = "/admin";
    } catch (err: any) {
      const map: Record<string, string> = {
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/email-already-in-use": "Já existe uma conta com esse e-mail — tente entrar em vez de criar.",
        "auth/weak-password": "Senha muito fraca — use pelo menos 6 caracteres.",
      };
      setError(map[err.code] || "Não foi possível concluir. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.gridBg}></div>
      <div style={styles.card}>
        <div style={styles.corner_tl}></div><div style={styles.corner_tr}></div>
        <div style={styles.corner_bl}></div><div style={styles.corner_br}></div>
        <div style={styles.logo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>
        <div style={styles.eyebrow}>ACESSO INTERNO</div>

        <h2 style={styles.h2}>{mode === "login" ? "Entrar" : "Criar acesso"}</h2>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>E-mail</label>
          <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label style={styles.label}>Senha</label>
          <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar acesso"}
          </button>
        </form>

        <button style={styles.switchBtn} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
          {mode === "login" ? "Primeira vez aqui? Criar acesso" : "Já tenho acesso, entrar"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { position: "relative", minHeight: "100dvh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", overflow: "hidden" },
  gridBg: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(197,138,74,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(197,138,74,.05) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse 60% 50% at 50% 40%,black 10%,transparent 75%)", pointerEvents: "none" },
  card: { position: "relative", border: "1px solid rgba(197,138,74,.22)", borderRadius: 6, padding: "2.4rem", maxWidth: 380, width: "100%", background: "linear-gradient(160deg,#0d0d0d,#050505)", zIndex: 1 },
  corner_tl: { position: "absolute", top: 10, left: 10, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_tr: { position: "absolute", top: 10, right: 10, width: 16, height: 16, borderTop: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  corner_bl: { position: "absolute", bottom: 10, left: 10, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}` },
  corner_br: { position: "absolute", bottom: 10, right: 10, width: 16, height: 16, borderBottom: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}` },
  logo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.1rem", marginBottom: "0.4rem", textAlign: "center" },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.18em", color: GOLD, textAlign: "center", marginBottom: "1.6rem" },
  h2: { fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", marginBottom: "1.4rem", textAlign: "center" },
  label: { display: "block", fontSize: "0.75rem", color: GOLD, letterSpacing: "0.04em", marginBottom: "0.4rem", marginTop: "1rem" },
  input: { width: "100%", background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 3, padding: "0.8rem 0.9rem", color: "#F5F0E8", fontSize: "0.9rem", outline: "none" },
  error: { color: "#e8746a", fontSize: "0.82rem", marginTop: "1rem" },
  btnPrimary: { width: "100%", background: GOLD, color: "#050505", border: "none", padding: "0.9rem", borderRadius: 3, fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", marginTop: "1.6rem" },
  switchBtn: { width: "100%", background: "none", border: "none", color: "#9d9384", fontSize: "0.78rem", marginTop: "1.2rem", cursor: "pointer", textDecoration: "underline" },
};
