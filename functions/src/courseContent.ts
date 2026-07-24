/**
 * Currículo do Curso — Novo Jeito Academy
 * Módulos e aulas editáveis pelo painel Admin — usados tanto na Área do Aluno
 * quanto na grade curricular do site público.
 *
 * IMPORTANTE sobre os IDs das aulas: cada aula tem um ID único e estável
 * (gerado uma vez, na criação). O progresso de cada aluno é salvo referenciando
 * esses IDs — por isso, ao editar título/duração/vídeo de uma aula existente,
 * o progresso de quem já assistiu continua valendo. Só apagar uma aula é que
 * "perde" a referência de quem já tinha marcado ela como concluída (não quebra
 * nada, só deixa de contar pro total).
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

// A grade abaixo reflete os 7 módulos / 24 aulas PRESENCIAIS reais — 1 aula
// por encontro agora (não mais 2), 2x por semana — segunda e quarta —, 3h por
// encontro/aula, ao longo de ~3 meses = 72h de carga horária total.
// Não são vídeos, por isso "duration" aqui é a duração real de cada encontro
// (180min = 3h), só pra manter a estimativa de carga horária no site público
// e na Área do Aluno.
// O Laboratório Novo Jeito (m6) agora É um módulo normal aqui — 2 aulas de
// introdução ao atendimento supervisionado — mas o registro detalhado de cada
// atendimento (modelo, fotos antes/depois, avaliação por categoria) continua
// modelado à parte, em laboratorio.ts, acessível pela Área do Aluno.
const DEFAULT_MODULES = [
  {
    id: "m1",
    title: "Fundamentos da Barbearia",
    description: "Construir a base técnica antes dos primeiros cortes.",
    lessons: [
      { id: "l1", title: "Boas-vindas e Introdução", duration: "180:00", videoUid: "" },
      { id: "l2", title: "Biossegurança", duration: "180:00", videoUid: "" },
      { id: "l3", title: "Anatomia da Cabeça", duration: "180:00", videoUid: "" },
      { id: "l4", title: "Introdução ao Corte Masculino", duration: "180:00", videoUid: "" },
      { id: "l5", title: "Fundamentos da Tesoura", duration: "180:00", videoUid: "" },
      { id: "l6", title: "Introdução à Máquina", duration: "180:00", videoUid: "" },
      { id: "l7", title: "Exercícios Técnicos", duration: "180:00", videoUid: "" },
      { id: "l8", title: "Avaliação do Módulo", duration: "180:00", videoUid: "" },
    ],
  },
  {
    id: "m2",
    title: "Técnicas de Degradê",
    description: "Do fundamento do fade ao skin fade, com aperfeiçoamento e correção de erros.",
    lessons: [
      { id: "l9", title: "Fundamentos do Fade", duration: "180:00", videoUid: "" },
      { id: "l10", title: "Mid Fade e High Fade", duration: "180:00", videoUid: "" },
      { id: "l11", title: "Skin Fade", duration: "180:00", videoUid: "" },
      { id: "l12", title: "Aperfeiçoamento do Fade", duration: "180:00", videoUid: "" },
    ],
  },
  {
    id: "m3",
    title: "Especialização em Tesoura",
    description: "O diferencial da escola: corte social, side part, pompadour e domínio avançado da tesoura.",
    lessons: [
      { id: "l13", title: "Corte Social", duration: "180:00", videoUid: "" },
      { id: "l14", title: "Side Part e Pompadour", duration: "180:00", videoUid: "" },
      { id: "l15", title: "Corte Clássico e Corte Longo Masculino", duration: "180:00", videoUid: "" },
      { id: "l16", title: "Domínio da Tesoura", duration: "180:00", videoUid: "" },
    ],
  },
  {
    id: "m4",
    title: "Barba e Barboterapia",
    description: "Design de barba e barboterapia até a finalização profissional.",
    lessons: [
      { id: "l17", title: "Design de Barba", duration: "180:00", videoUid: "" },
      { id: "l18", title: "Barboterapia", duration: "180:00", videoUid: "" },
    ],
  },
  {
    id: "m5",
    title: "Atendimento e Marketing",
    description: "Atendimento de excelência, fidelização e marketing pra atrair e reter clientes.",
    lessons: [
      { id: "l19", title: "Atendimento Profissional", duration: "180:00", videoUid: "" },
      { id: "l20", title: "Marketing para Barbeiros", duration: "180:00", videoUid: "" },
    ],
  },
  {
    id: "m6",
    title: "Laboratório Novo Jeito",
    description: "Atendimento supervisionado em modelos reais — o maior diferencial da Novo Jeito Academy.",
    lessons: [
      { id: "l21", title: "Atendimento Supervisionado I", duration: "180:00", videoUid: "" },
      { id: "l22", title: "Atendimento Supervisionado II", duration: "180:00", videoUid: "" },
    ],
  },
  {
    id: "m7",
    title: "Gestão da Barbearia",
    description: "Planejamento financeiro, precificação e gestão pra abrir e crescer o próprio negócio.",
    lessons: [
      { id: "l23", title: "Gestão e Empreendedorismo", duration: "180:00", videoUid: "" },
      { id: "l24", title: "Crescimento Profissional e Encerramento", duration: "180:00", videoUid: "" },
    ],
  },
];

export const getCourseContent = onRequest({ cors: true }, async (req, res) => {
  try {
    const doc = await db.collection("courseContent").doc("main").get();
    res.status(200).json({ modules: doc.exists ? doc.data()!.modules : DEFAULT_MODULES });
  } catch (err) {
    console.error("getCourseContent error:", err);
    res.status(200).json({ modules: DEFAULT_MODULES }); // nunca quebra a página do aluno/site por erro aqui
  }
});

export const updateCourseContent = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { modules } = req.body;
    if (!Array.isArray(modules)) {
      res.status(400).json({ error: "modules deve ser uma lista" });
      return;
    }

    await db.collection("courseContent").doc("main").set({ modules }, { merge: false });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("updateCourseContent error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
