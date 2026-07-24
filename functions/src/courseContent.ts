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

// A grade abaixo reflete os 6 módulos / 48 aulas PRESENCIAIS reais
// (24 encontros, 2x por semana — segunda e quarta —, 3h por encontro = 2 aulas
// de 1h30 por encontro, ao longo de 3 meses = 72h de carga horária total).
// Não são vídeos, por isso "duration" aqui é a duração típica de cada aula
// dentro do encontro (90min), só pra manter a estimativa de carga horária
// no site público e na Área do Aluno.
// O Módulo 7 (Laboratório Novo Jeito — atendimento supervisionado de modelos)
// é a fase prática que roda em paralelo/depois da grade e não entra aqui como
// aula: será modelado à parte (cadastro de modelos, antes/depois, avaliação).
const DEFAULT_MODULES = [
  {
    id: "m1",
    title: "Fundamentos da Barbearia",
    description: "Base teórica e prática pra começar com segurança, ética e organização.",
    lessons: [
      { id: "l1", title: "História da Barbearia", duration: "90:00", videoUid: "" },
      { id: "l2", title: "Ética Profissional", duration: "90:00", videoUid: "" },
      { id: "l3", title: "Biossegurança", duration: "90:00", videoUid: "" },
      { id: "l4", title: "Ferramentas", duration: "90:00", videoUid: "" },
      { id: "l5", title: "Ergonomia", duration: "90:00", videoUid: "" },
      { id: "l6", title: "Organização da Bancada", duration: "90:00", videoUid: "" },
      { id: "l7", title: "Produtos", duration: "90:00", videoUid: "" },
      { id: "l8", title: "Avaliação Prática", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m2",
    title: "Técnicas de Máquina",
    description: "Numeração de pentes, alavanca e marcação até a prática guiada.",
    lessons: [
      { id: "l9", title: "Numeração dos Pentes", duration: "90:00", videoUid: "" },
      { id: "l10", title: "Uso da Alavanca", duration: "90:00", videoUid: "" },
      { id: "l11", title: "Marcação", duration: "90:00", videoUid: "" },
      { id: "l12", title: "Transições", duration: "90:00", videoUid: "" },
      { id: "l13", title: "Limpeza do Corte", duration: "90:00", videoUid: "" },
      { id: "l14", title: "Correção de Erros", duration: "90:00", videoUid: "" },
      { id: "l15", title: "Exercícios", duration: "90:00", videoUid: "" },
      { id: "l16", title: "Prática", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m3",
    title: "Especialista em Degradê",
    description: "Do fade baixo ao burst fade, cabelo crespo e atendimento supervisionado.",
    lessons: [
      { id: "l17", title: "Fade Baixo", duration: "90:00", videoUid: "" },
      { id: "l18", title: "Fade Médio", duration: "90:00", videoUid: "" },
      { id: "l19", title: "Fade Alto", duration: "90:00", videoUid: "" },
      { id: "l20", title: "Skin Fade", duration: "90:00", videoUid: "" },
      { id: "l21", title: "Burst Fade", duration: "90:00", videoUid: "" },
      { id: "l22", title: "Taper Fade", duration: "90:00", videoUid: "" },
      { id: "l23", title: "Crespos", duration: "90:00", videoUid: "" },
      { id: "l24", title: "Correções", duration: "90:00", videoUid: "" },
      { id: "l25", title: "Atendimento Supervisionado", duration: "90:00", videoUid: "" },
      { id: "l26", title: "Avaliação", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m4",
    title: "Tesoura e Cortes Clássicos",
    description: "Tesoura sobre pente e os cortes clássicos que todo barbeiro precisa dominar.",
    lessons: [
      { id: "l27", title: "Tesoura sobre pente", duration: "90:00", videoUid: "" },
      { id: "l28", title: "Corte Social", duration: "90:00", videoUid: "" },
      { id: "l29", title: "Militar", duration: "90:00", videoUid: "" },
      { id: "l30", title: "Pompadour", duration: "90:00", videoUid: "" },
      { id: "l31", title: "Crop", duration: "90:00", videoUid: "" },
      { id: "l32", title: "Texturização", duration: "90:00", videoUid: "" },
      { id: "l33", title: "Finalização", duration: "90:00", videoUid: "" },
      { id: "l34", title: "Prática", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m5",
    title: "Barba e Visagismo",
    description: "Anatomia, navalha, toalha quente e visagismo aplicado ao atendimento.",
    lessons: [
      { id: "l35", title: "Anatomia", duration: "90:00", videoUid: "" },
      { id: "l36", title: "Navalha", duration: "90:00", videoUid: "" },
      { id: "l37", title: "Toalha Quente", duration: "90:00", videoUid: "" },
      { id: "l38", title: "Visagismo", duration: "90:00", videoUid: "" },
      { id: "l39", title: "Produtos", duration: "90:00", videoUid: "" },
      { id: "l40", title: "Atendimento", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m6",
    title: "Atendimento Profissional",
    description: "Atendimento, precificação, marketing e pós-venda pra viver da profissão.",
    lessons: [
      { id: "l41", title: "Atendimento ao Cliente", duration: "90:00", videoUid: "" },
      { id: "l42", title: "Precificação", duration: "90:00", videoUid: "" },
      { id: "l43", title: "Marketing", duration: "90:00", videoUid: "" },
      { id: "l44", title: "Redes Sociais", duration: "90:00", videoUid: "" },
      { id: "l45", title: "Fotografia", duration: "90:00", videoUid: "" },
      { id: "l46", title: "Organização da Bancada", duration: "90:00", videoUid: "" },
      { id: "l47", title: "Pós-venda", duration: "90:00", videoUid: "" },
      { id: "l48", title: "Avaliação", duration: "90:00", videoUid: "" },
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
