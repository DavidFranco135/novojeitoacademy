/**
 * Progresso do Aluno — Novo Jeito Academy
 *
 * getStudentProgress  -> retorna quais aulas o aluno logado já concluiu
 * markLessonComplete  -> marca uma aula como concluída e recalcula o %
 *
 * Como identifica o aluno: pelo token de login (Firebase Auth) enviado no
 * cabeçalho Authorization, casando o e-mail do token com o e-mail salvo na
 * matrícula (coleção "enrollments").
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

// identifica a matrícula do aluno a partir do token de login enviado
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

export const getStudentProgress = onRequest({ cors: true }, async (req, res) => {
  try {
    const enrollment = await getEnrollmentFromRequest(req);
    if (!enrollment) {
      res.status(403).json({ error: "Matrícula não encontrada ou acesso não liberado" });
      return;
    }

    const progressSnap = await db.collection("progress").doc(enrollment.id).get();
    const progress = progressSnap.exists ? progressSnap.data()! : { completedLessons: [], percent: 0 };

    res.status(200).json({
      enrollmentId: enrollment.id,
      nome: enrollment.data.nome,
      email: enrollment.data.email,
      telefone: enrollment.data.telefone,
      cpf: enrollment.data.cpf,
      matricula: enrollment.data.paidAt ? enrollment.data.paidAt.toDate().toLocaleDateString("pt-BR") : null,
      contractUrl: enrollment.data.contractUrl || null,
      completedLessons: progress.completedLessons || [],
      percent: progress.percent || 0,
      certificateUrl: enrollment.data.certificateUrl || null,
    });
  } catch (err) {
    console.error("getStudentProgress error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export const markLessonComplete = onRequest({ cors: true }, async (req, res) => {
  try {
    const enrollment = await getEnrollmentFromRequest(req);
    if (!enrollment) {
      res.status(403).json({ error: "Matrícula não encontrada ou acesso não liberado" });
      return;
    }

    const { lessonId, totalLessons } = req.body;
    if (!lessonId || !totalLessons) {
      res.status(400).json({ error: "lessonId e totalLessons são obrigatórios" });
      return;
    }

    const progressRef = db.collection("progress").doc(enrollment.id);

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(progressRef);
      const current: string[] = doc.exists ? doc.data()!.completedLessons || [] : [];
      const updated = current.includes(lessonId) ? current : [...current, lessonId];
      const percent = Math.round((updated.length / totalLessons) * 100);

      tx.set(progressRef, { completedLessons: updated, percent }, { merge: true });
      return { completedLessons: updated, percent };
    });

    res.status(200).json(result);
  } catch (err) {
    console.error("markLessonComplete error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
