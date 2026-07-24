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

// A grade abaixo reflete os 6 módulos / 50 aulas PRESENCIAIS reais
// (25 encontros, 2x por semana — segunda e quarta —, 3h por encontro = 2 aulas
// de 1h30 por encontro, ao longo de ~3 meses = 75h de carga horária total).
// Não são vídeos, por isso "duration" aqui é a duração típica de cada aula
// dentro do encontro (90min), só pra manter a estimativa de carga horária
// no site público e na Área do Aluno.
// O Laboratório Novo Jeito (atendimento supervisionado de modelos, exibido
// como "Módulo 6" na numeração pedagógica, entre este currículo e a "Gestão
// da Barbearia") não é um bloco de aulas com carga horária fixa: é modelado
// à parte (cadastro de modelos, antes/depois, avaliação) — ver laboratorio.ts.
const DEFAULT_MODULES = [
  {
    id: "m1",
    title: "Fundamentos da Barbearia",
    description: "Construir a base técnica antes dos primeiros cortes.",
    lessons: [
      { id: "l1", title: "Boas-vindas e Introdução", duration: "90:00", videoUid: "" },
      { id: "l2", title: "Biossegurança", duration: "90:00", videoUid: "" },
      { id: "l3", title: "Anatomia da Cabeça", duration: "90:00", videoUid: "" },
      { id: "l4", title: "Introdução ao Corte Masculino", duration: "90:00", videoUid: "" },
      { id: "l5", title: "Fundamentos da Tesoura", duration: "90:00", videoUid: "" },
      { id: "l6", title: "Introdução à Máquina", duration: "90:00", videoUid: "" },
      { id: "l7", title: "Exercícios Técnicos", duration: "90:00", videoUid: "" },
      { id: "l8", title: "Avaliação do Módulo", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m2",
    title: "Técnicas de Degradê (Fade)",
    description: "Do degradê baixo ao skin fade, com transições e correção de erros.",
    lessons: [
      { id: "l9", title: "Degradê Baixo", duration: "90:00", videoUid: "" },
      { id: "l10", title: "Degradê Médio", duration: "90:00", videoUid: "" },
      { id: "l11", title: "Degradê Alto", duration: "90:00", videoUid: "" },
      { id: "l12", title: "Skin Fade", duration: "90:00", videoUid: "" },
      { id: "l13", title: "Técnicas de Transição", duration: "90:00", videoUid: "" },
      { id: "l14", title: "Correção de Erros", duration: "90:00", videoUid: "" },
      { id: "l15", title: "Acabamentos", duration: "90:00", videoUid: "" },
      { id: "l16", title: "Avaliação Prática", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m3",
    title: "Especialização em Tesoura",
    description: "O diferencial da escola: do corte social clássico às técnicas avançadas de tesoura.",
    lessons: [
      { id: "l17", title: "Corte Social", duration: "90:00", videoUid: "" },
      { id: "l18", title: "Side Part", duration: "90:00", videoUid: "" },
      { id: "l19", title: "Pompadour", duration: "90:00", videoUid: "" },
      { id: "l20", title: "Corte Masculino Clássico", duration: "90:00", videoUid: "" },
      { id: "l21", title: "Corte Longo Masculino", duration: "90:00", videoUid: "" },
      { id: "l22", title: "Conexão entre Laterais e Topo", duration: "90:00", videoUid: "" },
      { id: "l23", title: "Controle de Peso", duration: "90:00", videoUid: "" },
      { id: "l24", title: "Texturização", duration: "90:00", videoUid: "" },
      { id: "l25", title: "Técnicas Avançadas de Tesoura", duration: "90:00", videoUid: "" },
      { id: "l26", title: "Acabamentos", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m4",
    title: "Barba e Barboterapia",
    description: "Anatomia, desenho, navalhete e barboterapia até a finalização profissional.",
    lessons: [
      { id: "l27", title: "Anatomia da Barba", duration: "90:00", videoUid: "" },
      { id: "l28", title: "Simetria", duration: "90:00", videoUid: "" },
      { id: "l29", title: "Desenho", duration: "90:00", videoUid: "" },
      { id: "l30", title: "Alinhamento", duration: "90:00", videoUid: "" },
      { id: "l31", title: "Navalhete", duration: "90:00", videoUid: "" },
      { id: "l32", title: "Toalha Quente", duration: "90:00", videoUid: "" },
      { id: "l33", title: "Barboterapia", duration: "90:00", videoUid: "" },
      { id: "l34", title: "Finalização Profissional", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m5",
    title: "Atendimento e Marketing",
    description: "Comunicação, fidelização, redes sociais e marca pessoal.",
    lessons: [
      { id: "l35", title: "Atendimento ao Cliente", duration: "90:00", videoUid: "" },
      { id: "l36", title: "Comunicação", duration: "90:00", videoUid: "" },
      { id: "l37", title: "Fidelização", duration: "90:00", videoUid: "" },
      { id: "l38", title: "Pós-venda", duration: "90:00", videoUid: "" },
      { id: "l39", title: "Redes Sociais", duration: "90:00", videoUid: "" },
      { id: "l40", title: "Fotografia dos Cortes", duration: "90:00", videoUid: "" },
      { id: "l41", title: "Construção da Marca Pessoal", duration: "90:00", videoUid: "" },
      { id: "l42", title: "Ética Profissional", duration: "90:00", videoUid: "" },
    ],
  },
  {
    id: "m6",
    title: "Gestão da Barbearia",
    description: "Planejamento financeiro, precificação e gestão pra abrir e crescer o próprio negócio.",
    lessons: [
      { id: "l43", title: "Como Abrir uma Barbearia", duration: "90:00", videoUid: "" },
      { id: "l44", title: "Planejamento Financeiro", duration: "90:00", videoUid: "" },
      { id: "l45", title: "Precificação", duration: "90:00", videoUid: "" },
      { id: "l46", title: "Controle de Caixa", duration: "90:00", videoUid: "" },
      { id: "l47", title: "Organização da Agenda", duration: "90:00", videoUid: "" },
      { id: "l48", title: "Gestão da Equipe", duration: "90:00", videoUid: "" },
      { id: "l49", title: "Marketing", duration: "90:00", videoUid: "" },
      { id: "l50", title: "Crescimento Profissional", duration: "90:00", videoUid: "" },
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
