/**
 * Bolsa de 100% — Novo Jeito Academy
 * Candidatura simples (nome, WhatsApp, idade, profissão, motivo) salva no Firestore
 * e listada no painel Admin para contato manual.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

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
