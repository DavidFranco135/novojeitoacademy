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

// A grade abaixo reflete as 24 aulas PRESENCIAIS reais (2x por semana, 3 meses)
// — não são vídeos, por isso "duration" aqui é a duração típica do encontro
// presencial (2h), só pra manter a estimativa de carga horária no site público.
const DEFAULT_MODULES = [
  {
    id: "m1",
    title: "Fundamentos da Navalha",
    description: "Afiação, ergonomia, posturas e segurança de trabalho.",
    lessons: [
      { id: "l1", title: "Ambientação, biossegurança, ergonomia e postura de trabalho", duration: "120:00", videoUid: "" },
      { id: "l2", title: "Afiação e manutenção de lâminas/navalhas na prática", duration: "120:00", videoUid: "" },
      { id: "l3", title: "Preparação do cliente e primeiro contato com a navalha", duration: "120:00", videoUid: "" },
    ],
  },
  {
    id: "m2",
    title: "Cortes Clássicos e Degradês",
    description: "Do social ao skin fade, técnica passo a passo.",
    lessons: [
      { id: "l4", title: "Corte social clássico — passo a passo completo", duration: "120:00", videoUid: "" },
      { id: "l5", title: "Degradê baixo (low fade)", duration: "120:00", videoUid: "" },
      { id: "l6", title: "Degradê médio (mid fade)", duration: "120:00", videoUid: "" },
      { id: "l7", title: "Degradê alto (high fade) e skin fade", duration: "120:00", videoUid: "" },
      { id: "l8", title: "Risco e desenhos (line up) na prática", duration: "120:00", videoUid: "" },
      { id: "l9", title: "Corte navalhado", duration: "120:00", videoUid: "" },
      { id: "l10", title: "Corte social moderno + textura com tesoura", duration: "120:00", videoUid: "" },
      { id: "l11", title: "Corte infantil — adaptações técnicas", duration: "120:00", videoUid: "" },
      { id: "l12", title: "Avaliação prática — atendimento supervisionado", duration: "120:00", videoUid: "" },
    ],
  },
  {
    id: "m3",
    title: "Barba e Acabamento",
    description: "Desenho, toalha quente, produtos e finalização.",
    lessons: [
      { id: "l13", title: "Desenho e contorno de barba", duration: "120:00", videoUid: "" },
      { id: "l14", title: "Toalha quente e produtos (óleos, balms)", duration: "120:00", videoUid: "" },
      { id: "l15", title: "Barba estilo degradê (fade de barba)", duration: "120:00", videoUid: "" },
      { id: "l16", title: "Bigode — técnicas de aparo e finalização", duration: "120:00", videoUid: "" },
      { id: "l17", title: "Atendimento completo (corte + barba) — avaliação prática", duration: "120:00", videoUid: "" },
    ],
  },
  {
    id: "m5",
    title: "Tendências 2026: Nevou e Coloração Masculina",
    description: "Fades modernos, textured crop, mullet e descoloração masculina — o que está bombando agora.",
    lessons: [
      { id: "l21", title: "Fades modernos avançados (taper fade, textured crop)", duration: "120:00", videoUid: "" },
      { id: "l22", title: "Mullet moderno na prática", duration: "120:00", videoUid: "" },
      { id: "l23", title: "Nevou — teste de mecha e preparação segura", duration: "120:00", videoUid: "" },
      { id: "l24", title: "Descoloração masculina e matização — passo a passo", duration: "120:00", videoUid: "" },
    ],
  },
  {
    id: "m4",
    title: "Gestão da Própria Barbearia",
    description: "Precificação, atendimento e fidelização de clientes.",
    lessons: [
      { id: "l18", title: "Precificação, portfólio e redes sociais (oficina prática)", duration: "120:00", videoUid: "" },
      { id: "l19", title: "Atendimento, experiência do cliente e fidelização (simulação)", duration: "120:00", videoUid: "" },
      { id: "l20", title: "Encerramento — avaliação final, certificados, planejamento de carreira", duration: "120:00", videoUid: "" },
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
