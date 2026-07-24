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
      modulosAplicaveis: enrollment.data.modulosAplicaveis || null,
      aulasExcluidas: enrollment.data.aulasExcluidas || null,
    });
  } catch (err) {
    console.error("getStudentProgress error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// DESCONTINUADO: o aluno marcava a própria aula como concluída clicando um
// botão, sem nenhuma confirmação real de presença — dava pra "concluir" tudo
// sem nunca ter ido numa aula. A conclusão agora é automática: quando a
// presença é confirmada via QR Code (confirmLessonCheckin, em turmas.ts), a
// aula correspondente do currículo é marcada concluída no mesmo passo (ver
// marcarAulaConcluidaPelaPresenca). Mantido só pra não quebrar o endpoint de
// quem ainda tiver a versão antiga do app aberta — sempre recusa o pedido.
export const markLessonComplete = onRequest({ cors: true }, async (req, res) => {
  res.status(410).json({
    error: "A conclusão de aula agora acontece automaticamente ao confirmar presença pelo QR Code — não é mais possível marcar manualmente.",
  });
});
