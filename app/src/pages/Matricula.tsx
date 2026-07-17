import { useState, useRef, useEffect } from "react";

/**
 * Fluxo de matrícula — Novo Jeito Academy
 * Etapas: 1) Dados pessoais  2) Contrato + assinatura  3) Pagamento (Mercado Pago)
 *
 * Integração esperada no backend (Firebase Functions):
 *  - POST /createEnrollment      -> salva lead + retorna enrollmentId
 *  - POST /signContract          -> salva assinatura (base64) + gera PDF do contrato
 *  - POST /createPaymentPreference -> cria preferência no Mercado Pago, retorna init_point (link de checkout)
 *  - Webhook /mercadopagoWebhook  -> confirma pagamento e libera acesso (ver enrollmentBackend.ts)
 */

const GOLD = "#C58A4A";
const GOLD2 = "#E8B97A";

// Base real das Firebase Functions (projeto: barbearia-do-ico)
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";

type Step = 1 | 2 | 3;

interface StudentData {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
}

const CONTRACT_TEXT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS

Pelo presente instrumento, de um lado NOVO JEITO ACADEMY ("CONTRATADA") e, de outro lado, o(a) aluno(a) identificado(a) no cadastro ("CONTRATANTE"), têm entre si justo e contratado o seguinte:

1. OBJETO
A CONTRATADA se compromete a fornecer ao CONTRATANTE acesso ao curso online "Formação Completa de Barbeiro Profissional", composto por aulas em vídeo, materiais de apoio e certificado de conclusão.

2. ACESSO E VIGÊNCIA
O acesso ao curso é vitalício a partir da confirmação do pagamento, ficando sujeito às atualizações de conteúdo que a CONTRATADA realizar.

3. PAGAMENTO
O valor e a forma de pagamento são os apresentados na etapa de checkout, sendo o acesso liberado automaticamente após a confirmação do pagamento pelo meio escolhido.

4. CERTIFICAÇÃO
O certificado de conclusão será emitido automaticamente ao CONTRATANTE que completar 100% das aulas do curso.

5. DIREITOS AUTORAIS
Todo o conteúdo do curso é de propriedade da CONTRATADA, sendo vedada sua reprodução, compartilhamento ou revenda sem autorização expressa.

6. CANCELAMENTO
Aplica-se o direito de arrependimento em até 7 (sete) dias corridos após a compra, conforme Código de Defesa do Consumidor, mediante solicitação por e-mail.

Ao assinar abaixo, o(a) CONTRATANTE declara ter lido e concordado com todos os termos deste contrato.`;

export default function EnrollmentFlow() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);

  const [data, setData] = useState<StudentData>({
    nome: "",
    email: "",
    telefone: "",
    cpf: "",
  });

  // ---------- Etapa 1: dados ----------
  function handleDataChange(field: keyof StudentData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function validStep1() {
    return (
      data.nome.trim().length > 3 &&
      /\S+@\S+\.\S+/.test(data.email) &&
      data.telefone.replace(/\D/g, "").length >= 10 &&
      data.cpf.replace(/\D/g, "").length === 11
    );
  }

  async function submitStep1() {
    if (!validStep1()) {
      setError("Preencha todos os campos corretamente.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/createEnrollment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Falha ao salvar cadastro");
      const json = await res.json();
      setEnrollmentId(json.enrollmentId);
      setStep(2);
    } catch (e) {
      setError("Não foi possível salvar seu cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Etapa 2: assinatura ----------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#F5F0E8";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
  }, [step]);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
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

  async function submitContract() {
    if (!hasSignature || !agreed) {
      setError("Assine o contrato e confirme a concordância antes de continuar.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const canvas = canvasRef.current!;
      const signatureBase64 = canvas.toDataURL("image/png");

      const res = await fetch(`${FUNCTIONS_BASE}/signContract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          signatureBase64,
          contractText: CONTRACT_TEXT,
        }),
      });
      if (!res.ok) throw new Error("Falha ao registrar assinatura");
      setStep(3);
    } catch (e) {
      setError("Não foi possível registrar sua assinatura. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Etapa 3: pagamento ----------
  async function goToPayment() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/createPaymentPreference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });
      if (!res.ok) throw new Error("Falha ao iniciar pagamento");
      const json = await res.json();
      window.location.href = json.init_point; // redireciona pro checkout do Mercado Pago
    } catch (e) {
      setError("Não foi possível iniciar o pagamento. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
      `}</style>

      <div style={styles.wrap}>
        <div style={styles.logo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>

        {/* progresso */}
        <div style={styles.progressRow}>
          {(["Dados", "Contrato", "Pagamento"] as const).map((label, i) => {
            const n = (i + 1) as Step;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} style={styles.progressItem}>
                <div style={{ ...styles.progressDot, borderColor: active || done ? GOLD : "rgba(197,138,74,.25)", color: active || done ? GOLD : "#8A8070", background: done ? GOLD : "transparent" }}>
                  {done ? "✓" : n}
                </div>
                <span style={{ ...styles.progressLabel, color: active ? GOLD : "#8A8070" }}>{label}</span>
              </div>
            );
          })}
        </div>

        <div style={styles.card}>
          {step === 1 && (
            <>
              <h2 style={styles.h2}>Seus dados</h2>
              <p style={styles.p}>Usados para emissão do contrato e certificado.</p>

              <label style={styles.label}>Nome completo</label>
              <input style={styles.input} value={data.nome} onChange={(e) => handleDataChange("nome", e.target.value)} placeholder="Seu nome completo" />

              <label style={styles.label}>E-mail</label>
              <input style={styles.input} value={data.email} onChange={(e) => handleDataChange("email", e.target.value)} placeholder="seu@email.com" type="email" />

              <label style={styles.label}>WhatsApp</label>
              <input style={styles.input} value={data.telefone} onChange={(e) => handleDataChange("telefone", e.target.value)} placeholder="(21) 99999-9999" />

              <label style={styles.label}>CPF</label>
              <input style={styles.input} value={data.cpf} onChange={(e) => handleDataChange("cpf", e.target.value)} placeholder="000.000.000-00" />

              {error && <p style={styles.error}>{error}</p>}

              <button style={styles.btnPrimary} onClick={submitStep1} disabled={loading}>
                {loading ? "Salvando..." : "Continuar"}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={styles.h2}>Contrato de matrícula</h2>
              <div style={styles.contractBox}>
                <pre style={styles.contractText}>{CONTRACT_TEXT}</pre>
              </div>

              <label style={styles.label}>Assine no campo abaixo</label>
              <div style={styles.signatureWrap}>
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={160}
                  style={styles.signatureCanvas}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                <button style={styles.clearBtn} onClick={clearSignature}>Limpar</button>
              </div>

              <label style={styles.checkboxRow}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>Li e concordo com os termos do contrato acima.</span>
              </label>

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.btnRow}>
                <button style={styles.btnGhost} onClick={() => setStep(1)}>Voltar</button>
                <button style={styles.btnPrimary} onClick={submitContract} disabled={loading}>
                  {loading ? "Registrando..." : "Assinar e continuar"}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={styles.h2}>Pagamento</h2>
              <p style={styles.p}>Você será redirecionado ao checkout seguro do Mercado Pago (cartão, PIX ou boleto).</p>

              {error && <p style={styles.error}>{error}</p>}

              <button style={styles.btnPrimary} onClick={goToPayment} disabled={loading}>
                {loading ? "Redirecionando..." : "Ir para pagamento"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif", padding: "4rem 1.5rem" },
  wrap: { maxWidth: 560, margin: "0 auto" },
  logo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.3rem", textAlign: "center", marginBottom: "2.4rem" },
  progressRow: { display: "flex", justifyContent: "space-between", marginBottom: "2rem" },
  progressItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", flex: 1 },
  progressDot: { width: 32, height: 32, borderRadius: "50%", border: "1px solid", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono',monospace", fontSize: "0.8rem" },
  progressLabel: { fontSize: "0.7rem", letterSpacing: "0.04em" },
  card: { border: "1px solid rgba(197,138,74,.22)", borderRadius: 6, padding: "2.2rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  h2: { fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", marginBottom: "0.4rem" },
  p: { fontSize: "0.88rem", color: "#8A8070", marginBottom: "1.6rem", lineHeight: 1.6 },
  label: { display: "block", fontSize: "0.75rem", color: GOLD, letterSpacing: "0.04em", marginBottom: "0.4rem", marginTop: "1rem" },
  input: { width: "100%", background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 3, padding: "0.75rem 0.9rem", color: "#F5F0E8", fontSize: "0.9rem", outline: "none" },
  error: { color: "#e8746a", fontSize: "0.82rem", marginTop: "1rem" },
  btnPrimary: { width: "100%", background: GOLD, color: "#050505", border: "none", padding: "0.9rem", borderRadius: 3, fontWeight: 600, fontSize: "0.9rem", marginTop: "1.8rem", cursor: "pointer" },
  btnGhost: { flex: 1, background: "transparent", color: "#F5F0E8", border: "1px solid rgba(197,138,74,.3)", padding: "0.9rem", borderRadius: 3, fontSize: "0.9rem", cursor: "pointer" },
  btnRow: { display: "flex", gap: "0.8rem", marginTop: "1.8rem" },
  contractBox: { maxHeight: 220, overflowY: "auto", border: "1px solid rgba(197,138,74,.2)", borderRadius: 3, padding: "1rem", background: "#0a0a0a", marginBottom: "0.6rem" },
  contractText: { fontFamily: "'Inter',sans-serif", fontSize: "0.78rem", color: "#c9c2b4", whiteSpace: "pre-wrap", lineHeight: 1.6 },
  signatureWrap: { position: "relative" },
  signatureCanvas: { width: "100%", height: 160, background: "#111", border: "1px dashed rgba(197,138,74,.4)", borderRadius: 3, touchAction: "none", cursor: "crosshair" },
  clearBtn: { position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.5)", border: "1px solid rgba(197,138,74,.3)", color: "#F5F0E8", fontSize: "0.72rem", padding: "0.3rem 0.6rem", borderRadius: 3, cursor: "pointer" },
  checkboxRow: { display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.82rem", color: "#c9c2b4", marginTop: "1.2rem" },
};
