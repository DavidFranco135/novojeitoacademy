/**
 * Conteúdo do Site — Novo Jeito Academy
 * Permite editar fotos, textos, vídeo e preço da landing page sem mexer em código.
 *
 * getSiteContent    -> pública, chamada pela própria landing page ao carregar
 * updateSiteContent -> protegida, só quem está na coleção "admins" do Firestore pode salvar
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

const DEFAULT_CONTENT = {
  heroTitle: "Domine a\nnavalha.\nConstrua seu ofício.",
  heroLead: "Do primeiro degradê ao seu próprio negócio: a formação completa de barbeiro profissional, direto de quem vive a barbearia todos os dias.",
  heroImageUrl: "",
  videoEmbedUrl: "",
  statAlunos: 412,
  statAulas: 24,
  statAvaliacao: 4.9,
  galleryImages: ["", "", "", "", "", ""],
  instrutorNome: "Marcus Vinícius",
  instrutorBio1: "Mais de 12 anos de estrada por trás da cadeira. Fundador da Barbearia Novo Jeito, já formou centenas de profissionais que hoje têm sua própria barbearia — ou trabalham nas melhores da cidade.",
  instrutorBio2: "Sua metodologia une técnica clássica de navalha com as tendências mais atuais de degradê, sempre com foco no que realmente importa: fazer o cliente sair satisfeito da cadeira.",
  instrutorPhotoUrl: "",
  instrutorAnos: 12,
  instrutorAlunosFormados: 400,
  price: 697.0,
  priceParcelaValor: 197.0,
  priceParcelaQtd: 4,
  testimonials: [
    { stars: 5, text: "Entrei sem nunca ter pego numa navalha e saí montando minha própria barbearia seis meses depois. O módulo presencial fez toda diferença.", autor: "Rafael T.", turma: "Turma 2026.1" },
    { stars: 5, text: "Já cortava cabelo há anos, mas o curso me deu técnica de verdade. O certificado abriu portas em barbearia grande da minha cidade.", autor: "Diego M.", turma: "Turma 2025.2" },
    { stars: 5, text: "O suporte direto com o instrutor foi o diferencial. Tirei dúvida até de madrugada e sempre teve resposta rápida.", autor: "Lucas F.", turma: "Turma 2025.2" },
  ],
  faq: [
    { pergunta: "Preciso de experiência prévia?", resposta: "Não. O curso começa do zero absoluto, com fundamentos de segurança e técnica antes de qualquer corte." },
    { pergunta: "Como funcionam os encontros presenciais?", resposta: "Você escolhe uma turma na área do aluno — cada turma já tem uma grade com várias datas, cada uma com um assunto prático diferente. Você usa o mesmo QR Code pessoal em todos os encontros, e o sistema identifica sozinho qual aula é a de cada dia." },
    { pergunta: "O certificado tem validade real?", resposta: "Sim, é emitido em seu nome com código de autenticidade único, liberado automaticamente ao concluir 100% do curso." },
    { pergunta: "Por quanto tempo tenho acesso?", resposta: "O acesso ao conteúdo online é vitalício a partir da confirmação do pagamento." },
    { pergunta: "Quais formas de pagamento vocês aceitam?", resposta: "Cartão de crédito (em até 12x), PIX e boleto, via Mercado Pago." },
  ],
  scholarshipTitle: "Concorra a uma bolsa de 100%.",
  scholarshipText: "A cada turma, oferecemos uma vaga integralmente gratuita pra quem realmente precisa dessa oportunidade. Conte sua história — vamos ler com atenção.",
  whatsappNumero: "",
  maintenanceMode: false,
  maintenanceMessage: "Estamos com o site em manutenção no momento. Voltamos em breve — obrigado pela paciência!",
};

// checa se o token de autenticação enviado pertence a um admin cadastrado
async function verificarAdmin(req: any): Promise<boolean> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return false;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const adminDoc = await db.collection("admins").doc(decoded.uid).get();
    return adminDoc.exists;
  } catch {
    return false;
  }
}

export const getSiteContent = onRequest({ cors: true }, async (req, res) => {
  try {
    const doc = await db.collection("siteContent").doc("main").get();
    res.status(200).json(doc.exists ? doc.data() : DEFAULT_CONTENT);
  } catch (err) {
    console.error("getSiteContent error:", err);
    res.status(200).json(DEFAULT_CONTENT); // site público nunca deve quebrar por erro aqui
  }
});

export const updateSiteContent = onRequest({ cors: true }, async (req, res) => {
  try {
    const isAdmin = await verificarAdmin(req);
    if (!isAdmin) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    await db.collection("siteContent").doc("main").set(req.body, { merge: true });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("updateSiteContent error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
