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
      status: "novo", // novo -> contatado -> aprovado -> selecionado | não selecionado
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
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const snap = await db.collection("scholarshipApplications").orderBy("createdAt", "desc").get();
    const applications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.status(200).json({ applications });
  } catch (err) {
    console.error("listScholarshipApplications error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Aprovar a bolsa: NÃO cria mais a conta direto. Gera um link de /matricula em
// modo bolsa pro aluno preencher os dados, assinar o contrato de verdade e ter
// o acesso liberado automaticamente (signContract cuida disso quando isBolsa).
// ============================================================
export const grantScholarship = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { applicationId } = req.body;
    if (!applicationId) {
      res.status(400).json({ error: "applicationId obrigatório" });
      return;
    }

    const appSnap = await db.collection("scholarshipApplications").doc(applicationId).get();
    if (!appSnap.exists) {
      res.status(404).json({ error: "Candidatura não encontrada" });
      return;
    }
    const application = appSnap.data()!;

    await db.collection("scholarshipApplications").doc(applicationId).update({ status: "aprovado" });

    const params = new URLSearchParams({
      bolsa: "1",
      scholarshipApplicationId: applicationId,
      nome: application.nome || "",
      telefone: application.whatsapp || "",
    });
    const matriculaLink = `https://portal.novojeitobarbearia.com.br/matricula?${params.toString()}`;

    res.status(200).json({ matriculaLink });
  } catch (err) {
    console.error("grantScholarship error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export const rejectScholarship = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { applicationId } = req.body;
    if (!applicationId) {
      res.status(400).json({ error: "applicationId obrigatório" });
      return;
    }

    const appSnap = await db.collection("scholarshipApplications").doc(applicationId).get();
    if (!appSnap.exists) {
      res.status(404).json({ error: "Candidatura não encontrada" });
      return;
    }

    await db.collection("scholarshipApplications").doc(applicationId).update({ status: "não selecionado" });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("rejectScholarship error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export const deleteScholarship = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { applicationId } = req.body;
    if (!applicationId) {
      res.status(400).json({ error: "applicationId obrigatório" });
      return;
    }

    await db.collection("scholarshipApplications").doc(applicationId).delete();

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("deleteScholarship error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
