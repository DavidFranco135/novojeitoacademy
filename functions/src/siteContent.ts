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
  statAulas: 38,
  statAvaliacao: 4.9,
  galleryImages: ["", "", "", "", "", ""],
  instrutorNome: "Marcus Vinícius",
  instrutorBio1: "Mais de 12 anos de estrada por trás da cadeira. Fundador da Barbearia Novo Jeito, já formou centenas de profissionais que hoje têm sua própria barbearia — ou trabalham nas melhores da cidade.",
  instrutorBio2: "Sua metodologia une técnica clássica de navalha com as tendências mais atuais de degradê, sempre com foco no que realmente importa: fazer o cliente sair satisfeito da cadeira.",
  instrutorPhotoUrl: "",
  instrutorAnos: 12,
  instrutorAlunosFormados: 400,
  price: 497.0,
  priceInstallments: 12,
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
