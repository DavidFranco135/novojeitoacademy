/**
 * Leads — Novo Jeito Academy
 * Pessoas que demonstraram interesse mas ainda não fecharam matrícula.
 * Capturado por um mini-formulário no site público ("Ainda com dúvidas?").
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

export const registerLead = onRequest({ cors: true }, async (req, res) => {
  try {
    const { nome, whatsapp } = req.body;
    if (!nome || !whatsapp) {
      res.status(400).json({ error: "Nome e WhatsApp são obrigatórios" });
      return;
    }

    await db.collection("leads").add({
      nome,
      whatsapp,
      status: "novo", // novo -> contatado -> convertido | perdido
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("registerLead error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export const listLeads = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const snap = await db.collection("leads").orderBy("createdAt", "desc").limit(200).get();
    const leads = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        nome: data.nome,
        contato: data.whatsapp,
        status: data.status,
        data: data.createdAt ? data.createdAt.toDate().toLocaleDateString("pt-BR") : "-",
      };
    });

    res.status(200).json({ leads });
  } catch (err) {
    console.error("listLeads error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
