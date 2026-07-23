import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

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
  rg: string;
  dataNascimento: string;
  endereco: string;
  cidade: string;
}

// CPF do responsável legal pela Novo Jeito Academy — preencha uma vez com o dado real
const CONTRATADA_CPF = "___.___.___-__"; // TODO: trocar pelo CPF real de Marcus Vinícius da Silva Narciso

function buildContractText(data: StudentData) {
  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS
CURSO DE BARBEIRO PROFISSIONAL – NOVO JEITO ACADEMY

1. DAS PARTES

CONTRATADA:
Novo Jeito Academy, representada por Marcus Vinícius da Silva Narciso, barbeiro profissional, CPF nº ${CONTRATADA_CPF}, com sede em São Gonçalo – RJ.

CONTRATANTE (ALUNO):
Nome: ${data.nome || "-"}
CPF: ${data.cpf || "-"}
RG: ${data.rg || "-"}
Data de nascimento: ${data.dataNascimento || "-"}
Endereço: ${data.endereco || "-"}
Cidade: ${data.cidade || "-"}
Telefone: ${data.telefone || "-"}
E-mail: ${data.email || "-"}

2. DO OBJETO
O presente contrato tem por objeto a prestação de serviços educacionais referentes ao Curso de Barbeiro Profissional Novo Jeito Academy, composto por: conteúdo online; aulas presenciais; materiais complementares; avaliações; certificação.

3. DA CARGA HORÁRIA
O curso será composto por aulas online gravadas, encontros presenciais, atividades práticas supervisionadas e exercícios de fixação. A carga horária total será informada no ato da matrícula.

4. DAS AULAS PRESENCIAIS
As aulas presenciais serão realizadas na sede da Novo Jeito Academy, em São Gonçalo – RJ. As datas serão previamente informadas ao aluno. Caso o aluno não compareça, não haverá obrigação de reposição, salvo disponibilidade da escola.

5. DO ACESSO À PLATAFORMA
Após confirmação do pagamento, o aluno receberá acesso exclusivo à plataforma. O acesso é individual, intransferível e protegido. É proibido compartilhar login, compartilhar senha, vender acesso ou reproduzir as aulas. Caso seja detectado uso simultâneo em dispositivos diferentes ou qualquer tentativa de fraude, o acesso poderá ser cancelado sem direito a reembolso.

6. DOS DIREITOS AUTORAIS
Todo o conteúdo do curso pertence à Novo Jeito Academy. É proibido gravar aulas, copiar apostilas, distribuir materiais ou comercializar o conteúdo. O descumprimento poderá gerar responsabilização civil e criminal.

7. DA CERTIFICAÇÃO
Receberá certificado o aluno que concluir os módulos obrigatórios, participar das atividades presenciais e cumprir os critérios mínimos de aproveitamento definidos pela escola.

8. DO INVESTIMENTO
O valor do curso e a forma de pagamento são os apresentados na etapa de checkout desta matrícula. A matrícula somente será confirmada após a aprovação do pagamento.

9. DO CANCELAMENTO
O aluno poderá desistir da compra no prazo legal de 7 (sete) dias, contado da confirmação da contratação, conforme o Código de Defesa do Consumidor, quando aplicável às contratações realizadas pela internet. Após esse prazo, não haverá devolução de valores referentes ao conteúdo já disponibilizado; pedidos excepcionais serão analisados individualmente pela escola.

10. DAS OBRIGAÇÕES DO ALUNO
O aluno compromete-se a respeitar professores e colegas, preservar equipamentos e comparecer às aulas presenciais em condições adequadas. É proibido qualquer comportamento que coloque em risco a integridade física ou moral dos participantes.

11. DAS OBRIGAÇÕES DA ESCOLA
A Novo Jeito Academy compromete-se a fornecer acesso à plataforma, disponibilizar os conteúdos contratados, realizar os encontros presenciais, emitir certificado aos alunos aprovados e prestar suporte dentro dos canais oficiais.

12. DA LGPD
Os dados pessoais serão utilizados exclusivamente para matrícula, emissão de certificado, comunicação acadêmica e obrigações legais. A escola compromete-se a proteger as informações do aluno conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

13. DO USO DE IMAGEM
O aluno autoriza, de forma gratuita, a utilização de fotografias e vídeos realizados durante as aulas para divulgação institucional da Novo Jeito Academy, em redes sociais, site e materiais publicitários. Caso não autorize, deverá comunicar por escrito antes do início das aulas.

14. DISPOSIÇÕES GERAIS
A aquisição do curso não garante emprego, renda mínima ou abertura de negócio próprio. O desempenho dependerá do comprometimento individual do aluno.

15. DO FORO
Fica eleito o foro da Comarca de São Gonçalo – RJ para dirimir quaisquer controvérsias decorrentes deste contrato.

Ao marcar "Li e aceito os termos do contrato" e assinar abaixo, o(a) CONTRATANTE declara ter lido integralmente este Contrato de Prestação de Serviços Educacionais, compreendido suas cláusulas e concordado com todos os seus termos — manifestando sua concordância eletrônica, que produz os mesmos efeitos jurídicos da assinatura física, nos termos da legislação brasileira aplicável.`;
}

export default function EnrollmentFlow() {
  const [searchParams] = useSearchParams();
  const isBolsaMode = searchParams.get("bolsa") === "1";
  const isDinheiroMode = searchParams.get("dinheiro") === "1";
  const scholarshipApplicationId = searchParams.get("scholarshipApplicationId") || null;
  const valorCombinado = searchParams.get("valor") || null;

  // Modo "assinar": reabre a etapa de assinatura pra uma matrícula que já existe
  // (ex: bolsa/dinheiro cadastrados antes da assinatura ser obrigatória, que nunca
  // tiveram contrato gerado) — pulando a etapa de dados, já preenchida com o que
  // já está salvo.
  const assinarId = searchParams.get("assinar");
  const [assinarState, setAssinarState] = useState<"idle" | "loading" | "ready" | "already_signed" | "error">(
    assinarId ? "loading" : "idle"
  );
  const [assinarErrorMsg, setAssinarErrorMsg] = useState("");
  const [assinarContractUrl, setAssinarContractUrl] = useState<string | null>(null);
  const [modoRetroativo, setModoRetroativo] = useState<"pago" | "bolsa" | "dinheiro" | null>(null);

  const modo: "pago" | "bolsa" | "dinheiro" = modoRetroativo || (isBolsaMode ? "bolsa" : isDinheiroMode ? "dinheiro" : "pago");

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);

  const [data, setData] = useState<StudentData>({
    nome: searchParams.get("nome") || "",
    email: "",
    telefone: searchParams.get("telefone") || "",
    cpf: "",
    rg: "",
    dataNascimento: "",
    endereco: "",
    cidade: "",
  });

  useEffect(() => {
    if (!assinarId) return;
    (async () => {
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/getEnrollmentForSigning`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId: assinarId }),
        });
        const json = await res.json();
        if (!res.ok) {
          setAssinarErrorMsg(json.error || "Não foi possível carregar seus dados.");
          setAssinarState("error");
          return;
        }
        if (json.contractUrl) {
          setAssinarContractUrl(json.contractUrl);
          setAssinarState("already_signed");
          return;
        }
        setData({
          nome: json.nome || "",
          email: json.email || "",
          telefone: json.telefone || "",
          cpf: json.cpf || "",
          rg: json.rg || "",
          dataNascimento: json.dataNascimento || "",
          endereco: json.endereco || "",
          cidade: json.cidade || "",
        });
        setEnrollmentId(assinarId);
        setModoRetroativo(json.isBolsa ? "bolsa" : json.paymentMethod === "dinheiro" ? "dinheiro" : "pago");
        setStep(2);
        setAssinarState("ready");
      } catch {
        setAssinarErrorMsg("Não foi possível carregar seus dados. Tente novamente.");
        setAssinarState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinarId]);

  // ---------- Etapa 1: dados ----------
  function handleDataChange(field: keyof StudentData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function validStep1() {
    return (
      data.nome.trim().length > 3 &&
      /\S+@\S+\.\S+/.test(data.email) &&
      data.telefone.replace(/\D/g, "").length >= 10 &&
      data.cpf.replace(/\D/g, "").length === 11 &&
      data.rg.trim().length >= 5 &&
      data.dataNascimento.trim().length > 0 &&
      data.endereco.trim().length > 5 &&
      data.cidade.trim().length > 1
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
        body: JSON.stringify({
          ...data,
          scholarshipApplicationId: modo === "bolsa" ? scholarshipApplicationId : undefined,
          paymentMethod: modo === "dinheiro" ? "dinheiro" : undefined,
          valorCombinado: modo === "dinheiro" ? valorCombinado : undefined,
        }),
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
          contractText: buildContractText(data),
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
          {(modo === "pago" ? (["Dados", "Contrato", "Pagamento"] as const) : (["Dados", "Contrato", "Acesso"] as const)).map((label, i) => {
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

        {assinarId && assinarState === "loading" && (
          <div style={styles.card}>
            <p style={styles.p}>Carregando seus dados...</p>
          </div>
        )}

        {assinarId && assinarState === "error" && (
          <div style={styles.card}>
            <h2 style={styles.h2}>Não foi possível abrir seu contrato</h2>
            <p style={styles.p}>{assinarErrorMsg}</p>
          </div>
        )}

        {assinarId && assinarState === "already_signed" && (
          <div style={styles.card}>
            <h2 style={styles.h2}>Contrato já assinado</h2>
            <p style={styles.p}>Seu contrato já foi assinado anteriormente. Você pode abrir ou baixar o PDF abaixo.</p>
            <a
              href={assinarContractUrl!}
              target="_blank"
              rel="noreferrer"
              style={{ ...styles.btnPrimary, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}
            >
              Ver meu contrato
            </a>
          </div>
        )}

        {(!assinarId || assinarState === "ready") && (
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

              <label style={styles.label}>RG</label>
              <input style={styles.input} value={data.rg} onChange={(e) => handleDataChange("rg", e.target.value)} placeholder="00.000.000-0" />

              <label style={styles.label}>Data de nascimento</label>
              <input style={styles.input} type="date" value={data.dataNascimento} onChange={(e) => handleDataChange("dataNascimento", e.target.value)} />

              <label style={styles.label}>Endereço</label>
              <input style={styles.input} value={data.endereco} onChange={(e) => handleDataChange("endereco", e.target.value)} placeholder="Rua, número, bairro" />

              <label style={styles.label}>Cidade</label>
              <input style={styles.input} value={data.cidade} onChange={(e) => handleDataChange("cidade", e.target.value)} placeholder="Sua cidade" />

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
                <pre style={styles.contractText}>{buildContractText(data)}</pre>
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
                <span>Declaro que li integralmente este Contrato de Prestação de Serviços Educacionais, compreendi suas cláusulas e concordo com todos os seus termos.</span>
              </label>

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.btnRow}>
                {!assinarId && <button style={styles.btnGhost} onClick={() => setStep(1)}>Voltar</button>}
                <button style={styles.btnPrimary} onClick={submitContract} disabled={loading}>
                  {loading ? "Registrando..." : "Assinar e continuar"}
                </button>
              </div>
            </>
          )}

          {step === 3 && modo === "pago" && (
            <>
              <h2 style={styles.h2}>Pagamento</h2>
              <p style={styles.p}>Você será redirecionado ao checkout seguro do Mercado Pago (cartão, PIX ou boleto).</p>

              {error && <p style={styles.error}>{error}</p>}

              <button style={styles.btnPrimary} onClick={goToPayment} disabled={loading}>
                {loading ? "Redirecionando..." : "Ir para pagamento"}
              </button>
            </>
          )}

          {step === 3 && modo !== "pago" && (
            <>
              <h2 style={styles.h2}>Matrícula concluída!</h2>
              <p style={styles.p}>
                {modo === "bolsa"
                  ? "Seu contrato foi assinado e sua bolsa de 100% já está confirmada — seu acesso à área do aluno já está liberado, sem nenhuma cobrança."
                  : "Seu contrato foi assinado e seu pagamento em dinheiro já está confirmado — seu acesso à área do aluno já está liberado."}
              </p>

              {error && <p style={styles.error}>{error}</p>}

              <a href="/login" style={{ ...styles.btnPrimary, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
                Acessar minha área do aluno →
              </a>
            </>
          )}
        </div>
        )}
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
