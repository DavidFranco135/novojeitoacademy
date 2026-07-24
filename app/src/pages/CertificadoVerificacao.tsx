import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

/**
 * Verificação pública de certificado — Novo Jeito Academy
 * Aberta ao escanear o QR Code impresso no certificado (Certificado Inteligente).
 * Não exige login: qualquer pessoa (ex: uma barbearia contratante) pode conferir
 * se um certificado com aquele código é autêntico, sem ver dados sensíveis do aluno.
 */

const GOLD = "#C58A4A";
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";

export default function CertificadoVerificacao() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [resultado, setResultado] = useState<{ valido: boolean; nome?: string; curso?: string; emitidoEm?: string } | null>(null);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    fetch(`${FUNCTIONS_BASE}/verifyCertificate?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => setResultado(data))
      .catch(() => setResultado({ valido: false }))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>

        {loading && <p style={styles.p}>Verificando certificado...</p>}

        {!loading && resultado?.valido && (
          <>
            <div style={styles.badgeOk}>✓ CERTIFICADO VÁLIDO</div>
            <h1 style={styles.nome}>{resultado.nome}</h1>
            <p style={styles.p}>concluiu o curso</p>
            <p style={styles.curso}>{resultado.curso}</p>
            {resultado.emitidoEm && <p style={styles.emitido}>Emitido em {resultado.emitidoEm}</p>}
            <p style={styles.codigo}>Código: {code}</p>
          </>
        )}

        {!loading && resultado && !resultado.valido && (
          <>
            <div style={styles.badgeErro}>✕ CÓDIGO NÃO ENCONTRADO</div>
            <p style={styles.p}>Não encontramos nenhum certificado com o código <strong>{code}</strong>. Confira se o código foi digitado corretamente.</p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "'Inter',sans-serif" },
  card: { maxWidth: 420, width: "100%", border: "1px solid rgba(197,138,74,.3)", borderRadius: 8, padding: "2.2rem 1.8rem", textAlign: "center", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  logo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.1rem", color: "#F5F0E8", marginBottom: "1.6rem" },
  badgeOk: { display: "inline-block", background: "rgba(120,200,140,.12)", color: "#78c88c", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", padding: "0.4rem 0.8rem", borderRadius: 20, marginBottom: "1.2rem" },
  badgeErro: { display: "inline-block", background: "rgba(232,116,106,.12)", color: "#e8746a", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", padding: "0.4rem 0.8rem", borderRadius: 20, marginBottom: "1.2rem" },
  nome: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", color: GOLD, margin: "0 0 0.4rem" },
  p: { fontSize: "0.85rem", color: "#9d9384", lineHeight: 1.6 },
  curso: { fontSize: "0.95rem", color: "#F5F0E8", fontWeight: 600, margin: "0.2rem 0 1rem" },
  emitido: { fontSize: "0.78rem", color: "#9d9384" },
  codigo: { fontFamily: "'Space Mono',monospace", fontSize: "0.7rem", color: "#5a5348", marginTop: "1.2rem" },
};
