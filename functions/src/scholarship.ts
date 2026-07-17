/**
 * Bolsa de 100% — Novo Jeito Academy
 * Candidatura simples (nome, WhatsApp, idade, profissão, motivo) salva no Firestore
 * e listada no painel Admin para contato manual.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

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

export const applyScholarship = onRequest({ cors: true }, async (req, res) => {
  try {
    const { nome, whatsapp, idade, profissao, motivo } = req.body;

    if (!nome || !whatsapp || !motivo) {
      res.status(400).json({ error: "Nome, WhatsApp e motivo são obrigatórios" });
      return;
    }

    const ref = await db.collection("scholarshipApplications").add({
      nome,
      whatsapp,
      idade: idade || null,
      profissao: profissao || null,
      motivo,
      status: "novo", // novo -> contatado -> selecionado | não selecionado
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ id: ref.id });
  } catch (err) {
    console.error("applyScholarship error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export const listScholarshipApplications = onRequest({ cors: true }, async (req, res) => {
  try {
    const snap = await db.collection("scholarshipApplications").orderBy("createdAt", "desc").get();
    const applications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.status(200).json({ applications });
  } catch (err) {
    console.error("listScholarshipApplications error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Conceder a bolsa: cria a matrícula já com acesso liberado, sem pagamento.
// Precisa de e-mail e CPF (a candidatura só coletou nome/whatsapp) — o admin
// pede esses dois dados direto com a pessoa antes de conceder.
// ============================================================
export const grantScholarship = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { applicationId, email, cpf } = req.body;
    if (!applicationId || !email || !cpf) {
      res.status(400).json({ error: "applicationId, email e cpf são obrigatórios" });
      return;
    }

    const appSnap = await db.collection("scholarshipApplications").doc(applicationId).get();
    if (!appSnap.exists) {
      res.status(404).json({ error: "Candidatura não encontrada" });
      return;
    }
    const application = appSnap.data()!;

    // cria a matrícula já com acesso liberado (sem cobrança — é a bolsa)
    const enrollmentRef = await db.collection("enrollments").add({
      nome: application.nome,
      email,
      telefone: application.whatsapp,
      cpf,
      status: "acesso_liberado",
      isBolsa: true,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // cria o login do aluno (mesmo padrão usado após pagamento aprovado)
    try {
      await admin.auth().createUser({ email, displayName: application.nome });
    } catch (e: any) {
      if (e.code !== "auth/email-already-exists") throw e;
    }
    // Aviso ao aluno é feito manualmente pelo admin via WhatsApp

    await db.collection("scholarshipApplications").doc(applicationId).update({ status: "selecionado" });

    const loginLink = await admin.auth().generateSignInWithEmailLink(email, {
      url: "https://novojeitoapp.pages.dev/login",
      handleCodeInApp: true,
    });

    res.status(200).json({ enrollmentId: enrollmentRef.id, loginLink });
  } catch (err) {
    console.error("grantScholarship error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
