/**
 * Assinatura da CONTRATADA — Novo Jeito Academy
 *
 * O dono/instrutor desenha a assinatura uma única vez aqui no Admin. Ela fica
 * salva em Firestore (settings/ownerSignature) e é carimbada automaticamente
 * em todo contrato e certificado gerado dali pra frente — ele não precisa
 * assinar documento por documento.
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

export const getOwnerSignature = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const snap = await db.collection("settings").doc("ownerSignature").get();
    res.status(200).json({ signatureBase64: snap.exists ? snap.data()!.imageBase64 || null : null });
  } catch (err) {
    console.error("getOwnerSignature error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export const saveOwnerSignature = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { signatureBase64 } = req.body;
    if (!signatureBase64) {
      res.status(400).json({ error: "signatureBase64 obrigatório" });
      return;
    }
    await db.collection("settings").doc("ownerSignature").set({
      imageBase64: signatureBase64,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("saveOwnerSignature error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
