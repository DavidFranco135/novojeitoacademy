/**
 * Avisos — Novo Jeito Academy
 *
 * O admin manda um recado (pra todos os alunos ou só um aluno específico) que
 * aparece como banner na Área do Aluno até ele dispensar. Sem push notification
 * nem e-mail — é só um aviso dentro do próprio app, simples e sem custo extra.
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

// mesmo padrão de progress.ts / laboratorio.ts
async function getEnrollmentFromRequest(req: any): Promise<{ id: string; data: any } | null> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await admin.auth().verifyIdToken(token);
  if (!decoded.email) return null;

  const snap = await db
    .collection("enrollments")
    .where("email", "==", decoded.email)
    .where("status", "==", "acesso_liberado")
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() };
}

// ============================================================
// 1) Admin cria um aviso — destinatarios: "todos" ou uma lista de enrollmentIds
// ============================================================
export const createAviso = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { titulo, mensagem, destinatarios } = req.body as { titulo: string; mensagem: string; destinatarios?: "todos" | string[] };
    if (!titulo?.trim() || !mensagem?.trim()) {
      res.status(400).json({ error: "titulo e mensagem são obrigatórios" });
      return;
    }

    const ref = await db.collection("avisos").add({
      titulo,
      mensagem,
      destinatarios: destinatarios && Array.isArray(destinatarios) && destinatarios.length > 0 ? destinatarios : "todos",
      ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ id: ref.id });
  } catch (err) {
    console.error("createAviso error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 2) Admin lista todos os avisos já criados
// ============================================================
export const listAvisosAdmin = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const snap = await db.collection("avisos").get();
    const avisos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
    res.status(200).json({ avisos });
  } catch (err) {
    console.error("listAvisosAdmin error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 3) Admin apaga/desativa um aviso (some da Área do Aluno pra todo mundo)
// ============================================================
export const deleteAviso = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { avisoId } = req.body;
    if (!avisoId) {
      res.status(400).json({ error: "avisoId obrigatório" });
      return;
    }
    await db.collection("avisos").doc(avisoId).delete();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("deleteAviso error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 4) Aluno logado vê os avisos ativos destinados a ele, que ainda não dispensou
// ============================================================
export const getMeusAvisos = onRequest({ cors: true }, async (req, res) => {
  try {
    const enrollment = await getEnrollmentFromRequest(req);
    if (!enrollment) {
      res.status(403).json({ error: "Matrícula não encontrada ou acesso não liberado" });
      return;
    }

    const dispensados: string[] = enrollment.data.avisosDispensados || [];
    const snap = await db.collection("avisos").where("ativo", "==", true).get();

    const avisos = snap.docs
      .filter((d) => {
        const a = d.data();
        const destinatarios = a.destinatarios;
        const paraMim = destinatarios === "todos" || (Array.isArray(destinatarios) && destinatarios.includes(enrollment.id));
        return paraMim && !dispensados.includes(d.id);
      })
      .map((d) => {
        const a = d.data();
        return { id: d.id, titulo: a.titulo, mensagem: a.mensagem };
      })
      .sort((a, b) => (a.id < b.id ? 1 : -1));

    res.status(200).json({ avisos });
  } catch (err) {
    console.error("getMeusAvisos error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 5) Aluno dispensa um aviso — some só pra ele, os outros continuam vendo
// ============================================================
export const dispensarAviso = onRequest({ cors: true }, async (req, res) => {
  try {
    const enrollment = await getEnrollmentFromRequest(req);
    if (!enrollment) {
      res.status(403).json({ error: "Matrícula não encontrada ou acesso não liberado" });
      return;
    }
    const { avisoId } = req.body;
    if (!avisoId) {
      res.status(400).json({ error: "avisoId obrigatório" });
      return;
    }
    await db.collection("enrollments").doc(enrollment.id).update({
      avisosDispensados: admin.firestore.FieldValue.arrayUnion(avisoId),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("dispensarAviso error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
