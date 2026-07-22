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

const DEFAULT_MODULES = [
  {
    id: "m1",
    title: "Fundamentos da Navalha",
    description: "Afiação, ergonomia, posturas e segurança de trabalho.",
    lessons: [
      { id: "l1", title: "Afiação e cuidado das lâminas", duration: "14:20", videoUid: "" },
      { id: "l2", title: "Postura e ergonomia", duration: "11:05", videoUid: "" },
      { id: "l3", title: "Segurança de trabalho", duration: "09:40", videoUid: "" },
      { id: "l15", title: "Tipos de navalha e escolha do equipamento", duration: "20:00", videoUid: "" },
      { id: "l16", title: "Manutenção e conservação das ferramentas", duration: "18:00", videoUid: "" },
      { id: "l17", title: "Preparação do cliente e do ambiente de trabalho", duration: "26:55", videoUid: "" },
    ],
  },
  {
    id: "m2",
    title: "Cortes Clássicos e Degradês",
    description: "Do social ao skin fade, técnica passo a passo.",
    lessons: [
      { id: "l4", title: "Social clássico passo a passo", duration: "22:10", videoUid: "" },
      { id: "l5", title: "Skin fade do zero", duration: "26:45", videoUid: "" },
      { id: "l18", title: "Degradê baixo (low fade)", duration: "16:00", videoUid: "" },
      { id: "l19", title: "Degradê médio (mid fade)", duration: "16:00", videoUid: "" },
      { id: "l20", title: "Degradê alto (high fade)", duration: "15:00", videoUid: "" },
      { id: "l21", title: "Corte social moderno", duration: "14:00", videoUid: "" },
      { id: "l22", title: "Corte navalhado", duration: "15:00", videoUid: "" },
      { id: "l23", title: "Risco e desenhos (line up)", duration: "12:00", videoUid: "" },
      { id: "l24", title: "Textura e finalização com tesoura", duration: "15:00", videoUid: "" },
      { id: "l25", title: "Corte infantil", duration: "13:00", videoUid: "" },
      { id: "l26", title: "Adaptando o corte ao formato do rosto", duration: "17:00", videoUid: "" },
      { id: "l27", title: "Acabamento com máquina zero", duration: "18:05", videoUid: "" },
    ],
  },
  {
    id: "m3",
    title: "Barba e Acabamento",
    description: "Desenho, toalha quente, produtos e finalização.",
    lessons: [
      { id: "l6", title: "Desenho de barba", duration: "16:30", videoUid: "" },
      { id: "l7", title: "Toalha quente e finalização", duration: "13:15", videoUid: "" },
      { id: "l28", title: "Produtos para barba: óleos e balms", duration: "14:00", videoUid: "" },
      { id: "l29", title: "Barba estilo degradê (fade de barba)", duration: "16:00", videoUid: "" },
      { id: "l30", title: "Contorno e alinhamento", duration: "15:00", videoUid: "" },
      { id: "l31", title: "Barboterapia", duration: "18:00", videoUid: "" },
      { id: "l32", title: "Bigode: técnicas de aparo", duration: "13:00", videoUid: "" },
      { id: "l33", title: "Cuidados pós-atendimento", duration: "24:15", videoUid: "" },
    ],
  },
  {
    id: "m4",
    title: "Gestão da Própria Barbearia",
    description: "Precificação, atendimento e fidelização de clientes.",
    lessons: [
      { id: "l8", title: "Precificação de serviços", duration: "14:00", videoUid: "" },
      { id: "l9", title: "Como montar seu portfólio", duration: "15:00", videoUid: "" },
      { id: "l10", title: "Atendimento e experiência do cliente", duration: "16:00", videoUid: "" },
      { id: "l11", title: "Fidelização e programa de indicação", duration: "14:00", videoUid: "" },
      { id: "l12", title: "Redes sociais para barbeiros", duration: "17:00", videoUid: "" },
      { id: "l13", title: "Gestão financeira básica", duration: "15:00", videoUid: "" },
      { id: "l14", title: "Como abrir sua própria barbearia", duration: "19:00", videoUid: "" },
    ],
  },
  {
    id: "m5",
    title: "Tendências 2026: Nevou e Coloração Masculina",
    description: "Fades modernos, textured crop, mullet e descoloração masculina — o que está bombando agora.",
    lessons: [
      { id: "l34", title: "Fades modernos: low, mid, high e taper fade", duration: "18:00", videoUid: "" },
      { id: "l35", title: "Textured crop e mullet moderno na prática", duration: "20:00", videoUid: "" },
      { id: "l36", title: "Nevou: teste de mecha e preparação segura", duration: "16:00", videoUid: "" },
      { id: "l37", title: "Descoloração masculina passo a passo", duration: "24:00", videoUid: "" },
      { id: "l38", title: "Matização e cuidados pós-coloração", duration: "14:00", videoUid: "" },
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
