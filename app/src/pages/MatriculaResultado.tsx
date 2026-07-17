import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

/**
 * Tela de retorno após o checkout do Mercado Pago.
 * Rotas: /matricula/sucesso, /matricula/erro, /matricula/pendente
 */

const GOLD = "#C58A4A";

const CONTENT: Record<string, { icon: string; title: string; text: string }> = {
  sucesso: {
    icon: "✓",
    title: "Matrícula confirmada!",
    text: "Seu pagamento foi aprovado. Em instantes você recebe um e-mail com o link de acesso à sua área do aluno.",
  },
  erro: {
    icon: "✕",
    title: "Pagamento não aprovado",
    text: "Não conseguimos confirmar seu pagamento. Você pode tentar novamente ou usar outro método de pagamento.",
  },
  pendente: {
    icon: "⏳",
    title: "Pagamento em análise",
    text: "Recebemos seu pagamento e ele está sendo processado (comum em boleto e alguns cartões). Assim que for aprovado, seu acesso é liberado automaticamente.",
  },
};

export default function MatriculaResultado() {
  const { status } = useParams<{ status: string }>();
  const [searchParams] = useSearchParams();
  const [info, setInfo] = useState(CONTENT.pendente);

  useEffect(() => {
    setInfo(CONTENT[status || "pendente"] || CONTENT.pendente);
  }, [status]);

  const isSuccess = status === "sucesso";
  const isError = status === "erro";

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ ...styles.icon, color: isSuccess ? "#78c88c" : isError ? "#e8746a" : GOLD, borderColor: isSuccess ? "#78c88c" : isError ? "#e8746a" : GOLD }}>
          {info.icon}
        </div>
        <h1 style={styles.title}>{info.title}</h1>
        <p style={styles.text}>{info.text}</p>

        {isSuccess && (
          <a href="/login" style={styles.btnPrimary}>
            Acessar minha área do aluno
          </a>
        )}
        {isError && (
          <a href="/matricula" style={styles.btnPrimary}>
            Tentar novamente
          </a>
        )}
        {!isSuccess && !isError && (
          <a href="/" style={styles.btnGhost}>
            Voltar ao site
          </a>
        )}

        {searchParams.get("payment_id") && (
          <p style={styles.paymentId}>ID do pagamento: {searchParams.get("payment_id")}</p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" },
  card: { border: "1px solid rgba(197,138,74,.22)", borderRadius: 8, padding: "3rem 2.4rem", maxWidth: 440, width: "100%", textAlign: "center", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  icon: { width: 64, height: 64, borderRadius: "50%", border: "1px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", margin: "0 auto 1.6rem" },
  title: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", marginBottom: "0.8rem" },
  text: { fontSize: "0.9rem", color: "#9d9384", lineHeight: 1.7, marginBottom: "2rem" },
  btnPrimary: { display: "inline-block", background: GOLD, color: "#050505", padding: "0.9rem 2rem", borderRadius: 3, fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" },
  btnGhost: { display: "inline-block", border: "1px solid rgba(197,138,74,.3)", color: "#F5F0E8", padding: "0.9rem 2rem", borderRadius: 3, fontSize: "0.9rem", textDecoration: "none" },
  paymentId: { fontSize: "0.72rem", color: "#5a5348", marginTop: "1.6rem", fontFamily: "'Space Mono',monospace" },
};
