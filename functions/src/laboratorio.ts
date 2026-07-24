/**
 * Laboratório Novo Jeito — Novo Jeito Academy
 *
 * O "Módulo 7" da grade (ver courseContent.ts) não é um bloco de aulas: é a fase
 * prática em que o aluno atende MODELOS reais (bonecos → convidados → clientes
 * voluntários), supervisionado pelo professor. Esse arquivo cobre:
 *
 *  - Cadastro de Modelos (roster reaproveitável entre atendimentos)
 *  - Agenda dos Modelos (admin agenda um horário; tela pública de recepção lê o dia)
 *  - Atendimento (aluno registra o que fez, com foto antes/depois)
 *  - Avaliação do Professor (notas de 1 a 5 em 6 categorias + comentário)
 *  - Estatísticas do Aluno / Carteira Profissional (computeCarteira, reaproveitado
 *    também pelo Certificado Inteligente em certificate.ts)
 *
 * Ciclo de vida de um "atendimento": agendado -> realizado -> avaliado
 *  - "agendado": só existe hora marcada (criado pelo admin em agendarAtendimento)
 *  - "realizado": o aluno já preencheu serviços + fotos (registrarAtendimento)
 *  - "avaliado": o professor já deu nota (avaliarAtendimento)
 * Atendimentos avulsos (sem agendamento prévio, ex: aluno atendeu um familiar em
 * casa) pulam direto pra "realizado" — registrarAtendimento sem atendimentoId.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

interface Avaliacao {
  tecnica: number;
  degrade: number;
  tesoura: number;
  barba: number;
  atendimento: number;
  higiene: number;
}

const CATEGORIAS_AVALIACAO: (keyof Avaliacao)[] = ["tecnica", "degrade", "tesoura", "barba", "atendimento", "higiene"];

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

// mesmo padrão de progress.ts: identifica a matrícula do aluno logado pelo token
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

async function criarOuReaproveitarModelo(
  modeloId: string | undefined,
  modeloNovo: { nome: string; telefone?: string; idade?: number; tipoCabelo?: string; servico?: string; observacoes?: string } | undefined,
  cadastradoPorAluno?: string
): Promise<{ id: string; nome: string; telefone: string } | { error: string }> {
  if (modeloId) {
    const snap = await db.collection("models").doc(modeloId).get();
    if (!snap.exists) return { error: "Modelo não encontrado" };
    const data = snap.data()!;
    return { id: modeloId, nome: data.nome, telefone: data.telefone || "" };
  }
  if (!modeloNovo?.nome) return { error: "Informe modeloId ou os dados de um modelo novo" };

  const ref = await db.collection("models").add({
    nome: modeloNovo.nome,
    telefone: modeloNovo.telefone || "",
    idade: modeloNovo.idade || null,
    tipoCabelo: modeloNovo.tipoCabelo || "",
    servico: modeloNovo.servico || "",
    observacoes: modeloNovo.observacoes || "",
    fotos: [],
    cadastradoPorAluno: cadastradoPorAluno || null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id: ref.id, nome: modeloNovo.nome, telefone: modeloNovo.telefone || "" };
}

// ============================================================
// 1) Admin cadastra um modelo no roster (avulso, sem agendar nada ainda)
// ============================================================
export const createModelo = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { nome, telefone, idade, tipoCabelo, servico, observacoes, fotos } = req.body;
    if (!nome) {
      res.status(400).json({ error: "nome é obrigatório" });
      return;
    }
    const ref = await db.collection("models").add({
      nome,
      telefone: telefone || "",
      idade: idade || null,
      tipoCabelo: tipoCabelo || "",
      servico: servico || "",
      observacoes: observacoes || "",
      fotos: fotos || [],
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(200).json({ id: ref.id });
  } catch (err) {
    console.error("createModelo error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 2) Admin lista todos os modelos cadastrados (Área do Laboratório: Modelo 01..N)
// ============================================================
export const listModelos = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const snap = await db.collection("models").orderBy("criadoEm", "desc").get();
    res.status(200).json({ modelos: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error("listModelos error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 3) Aluno logado vê os modelos que ELE já atendeu antes (pra reaproveitar
// dados num retorno, em vez de recadastrar do zero)
// ============================================================
export const listMeusModelos = onRequest({ cors: true }, async (req, res) => {
  try {
    const enrollment = await getEnrollmentFromRequest(req);
    if (!enrollment) {
      res.status(403).json({ error: "Matrícula não encontrada ou acesso não liberado" });
      return;
    }
    const snap = await db.collection("atendimentos").where("enrollmentId", "==", enrollment.id).get();
    const vistos = new Map<string, { id: string; nome: string; telefone: string }>();
    snap.docs.forEach((d) => {
      const a = d.data();
      if (a.modeloId && !vistos.has(a.modeloId)) {
        vistos.set(a.modeloId, { id: a.modeloId, nome: a.modeloNome, telefone: a.modeloTelefone || "" });
      }
    });
    res.status(200).json({ modelos: Array.from(vistos.values()) });
  } catch (err) {
    console.error("listMeusModelos error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 4) Admin agenda um horário futuro pra Área dos Modelos (a recepção/o modelo
// já sabe o horário, o aluno responsável já fica atribuído)
// ============================================================
export const agendarAtendimento = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { modeloId, modeloNovo, enrollmentId, dataAgendada, horarioAgendado, moduloId } = req.body;
    if (!dataAgendada || !horarioAgendado || !enrollmentId) {
      res.status(400).json({ error: "dataAgendada, horarioAgendado e enrollmentId são obrigatórios" });
      return;
    }

    const modelo = await criarOuReaproveitarModelo(modeloId, modeloNovo);
    if ("error" in modelo) {
      res.status(400).json(modelo);
      return;
    }

    const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
    if (!enrollmentSnap.exists) {
      res.status(404).json({ error: "Aluno não encontrado" });
      return;
    }

    const ref = await db.collection("atendimentos").add({
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      modeloTelefone: modelo.telefone,
      enrollmentId,
      alunoNome: enrollmentSnap.data()!.nome,
      moduloId: moduloId || null,
      servicos: [],
      fotoAntes: null,
      fotoDepois: null,
      duracaoMinutos: null,
      dataAgendada,
      horarioAgendado,
      status: "agendado",
      avaliacao: null,
      comentarioProfessor: "",
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ id: ref.id });
  } catch (err) {
    console.error("agendarAtendimento error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 5) Agenda pública do dia — Área dos Modelos / tela de recepção.
// Não exige login: o modelo (cliente voluntário) não tem conta no sistema.
// Só devolve o essencial (nome, horário, aluno responsável) — nada sensível.
// ============================================================
export const getAgendaDoDia = onRequest({ cors: true }, async (req, res) => {
  try {
    const data = (req.query.data as string) || new Date().toISOString().slice(0, 10);
    const snap = await db.collection("atendimentos").where("dataAgendada", "==", data).get();
    const agenda = snap.docs
      .map((d) => {
        const a = d.data();
        return { horario: a.horarioAgendado, modeloNome: a.modeloNome, alunoNome: a.alunoNome, status: a.status };
      })
      .sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
    res.status(200).json({ data, agenda });
  } catch (err) {
    console.error("getAgendaDoDia error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 6) Aluno registra o resultado de um atendimento — completando um agendamento
// existente (passando atendimentoId) OU criando um avulso na hora (sem
// agendamento prévio, típico das Fases 1/2 do Laboratório: bonecos, colegas,
// família e amigos).
// ============================================================
export const registrarAtendimento = onRequest({ cors: true }, async (req, res) => {
  try {
    const enrollment = await getEnrollmentFromRequest(req);
    if (!enrollment) {
      res.status(403).json({ error: "Matrícula não encontrada ou acesso não liberado" });
      return;
    }

    const { atendimentoId, modeloId, modeloNovo, moduloId, servicos, fotoAntes, fotoDepois, duracaoMinutos } = req.body;
    if (!Array.isArray(servicos) || servicos.length === 0) {
      res.status(400).json({ error: "Selecione ao menos um serviço realizado" });
      return;
    }
    if (!fotoAntes || !fotoDepois) {
      res.status(400).json({ error: "Foto antes e depois são obrigatórias" });
      return;
    }

    if (atendimentoId) {
      const ref = db.collection("atendimentos").doc(atendimentoId);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "Atendimento não encontrado" });
        return;
      }
      if (snap.data()!.enrollmentId !== enrollment.id) {
        res.status(403).json({ error: "Esse atendimento não é seu" });
        return;
      }
      if (snap.data()!.status === "avaliado") {
        res.status(400).json({ error: "Esse atendimento já foi avaliado pelo professor e não pode mais ser alterado." });
        return;
      }
      await ref.update({
        servicos,
        fotoAntes,
        fotoDepois,
        duracaoMinutos: duracaoMinutos || null,
        moduloId: moduloId || snap.data()!.moduloId || null,
        status: "realizado",
        realizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(200).json({ id: atendimentoId });
      return;
    }

    const modelo = await criarOuReaproveitarModelo(modeloId, modeloNovo, enrollment.id);
    if ("error" in modelo) {
      res.status(400).json(modelo);
      return;
    }

    const agora = new Date();
    const ref = await db.collection("atendimentos").add({
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      modeloTelefone: modelo.telefone,
      enrollmentId: enrollment.id,
      alunoNome: enrollment.data.nome,
      moduloId: moduloId || null,
      servicos,
      fotoAntes,
      fotoDepois,
      duracaoMinutos: duracaoMinutos || null,
      dataAgendada: agora.toISOString().slice(0, 10),
      horarioAgendado: agora.toTimeString().slice(0, 5),
      status: "realizado",
      avaliacao: null,
      comentarioProfessor: "",
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      realizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ id: ref.id });
  } catch (err) {
    console.error("registrarAtendimento error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 7) Admin/professor avalia um atendimento já realizado — 6 categorias de
// 1 a 5 estrelas + comentário livre.
// ============================================================
export const avaliarAtendimento = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const { atendimentoId, avaliacao, comentarioProfessor } = req.body as {
      atendimentoId: string;
      avaliacao: Avaliacao;
      comentarioProfessor?: string;
    };
    if (!atendimentoId || !avaliacao) {
      res.status(400).json({ error: "atendimentoId e avaliacao são obrigatórios" });
      return;
    }

    for (const categoria of CATEGORIAS_AVALIACAO) {
      const nota = avaliacao[categoria];
      if (typeof nota !== "number" || nota < 1 || nota > 5) {
        res.status(400).json({ error: `Nota de "${categoria}" precisa ser um número de 1 a 5` });
        return;
      }
    }

    const ref = db.collection("atendimentos").doc(atendimentoId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: "Atendimento não encontrado" });
      return;
    }
    if (snap.data()!.status === "agendado") {
      res.status(400).json({ error: "Esse atendimento ainda não foi realizado (sem fotos) — não dá pra avaliar ainda." });
      return;
    }

    await ref.update({
      avaliacao,
      comentarioProfessor: comentarioProfessor || "",
      status: "avaliado",
      avaliadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("avaliarAtendimento error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 8) Admin lista atendimentos — usado tanto pra fila de avaliação
// (?status=realizado) quanto pra visão geral do Laboratório
// ============================================================
export const listAtendimentosAdmin = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    const statusFiltro = req.query.status as string | undefined;

    let query: FirebaseFirestore.Query = db.collection("atendimentos");
    if (statusFiltro) query = query.where("status", "==", statusFiltro);
    const snap = await query.get();

    const atendimentos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));

    res.status(200).json({ atendimentos });
  } catch (err) {
    console.error("listAtendimentosAdmin error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 9) Aluno vê seu próprio histórico de atendimentos no Laboratório
// ============================================================
export const listMeusAtendimentos = onRequest({ cors: true }, async (req, res) => {
  try {
    const enrollment = await getEnrollmentFromRequest(req);
    if (!enrollment) {
      res.status(403).json({ error: "Matrícula não encontrada ou acesso não liberado" });
      return;
    }

    const snap = await db.collection("atendimentos").where("enrollmentId", "==", enrollment.id).get();
    const atendimentos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));

    res.status(200).json({ atendimentos });
  } catch (err) {
    console.error("listMeusAtendimentos error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 10) Estatísticas + Carteira Profissional — combina Laboratório (atendimentos
// avaliados) com progresso do curso e certificado. Reaproveitado pelo
// Certificado Inteligente (certificate.ts) e pela tela "Carteira Profissional"
// da Área do Aluno.
// ============================================================
export async function computeCarteira(enrollmentId: string) {
  const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
  const enrollment = enrollmentSnap.exists ? enrollmentSnap.data()! : ({} as any);

  const progressSnap = await db.collection("progress").doc(enrollmentId).get();
  const progress = progressSnap.exists ? progressSnap.data()! : { completedLessons: [], percent: 0 };

  const atendimentosSnap = await db.collection("atendimentos").where("enrollmentId", "==", enrollmentId).get();
  const todos = atendimentosSnap.docs.map((d) => d.data());
  const realizados = todos.filter((a) => a.status === "realizado" || a.status === "avaliado");
  const avaliados = todos.filter((a) => a.status === "avaliado");

  const contemServico = (a: any, termos: string[]) =>
    (a.servicos || []).some((s: string) => termos.some((t) => s.toLowerCase().includes(t)));

  const modelosAtendidos = new Set(realizados.map((a) => a.modeloId)).size;
  const cortesRealizados = realizados.filter((a) => contemServico(a, ["corte"])).length;
  const barbasRealizadas = realizados.filter((a) => contemServico(a, ["barba"])).length;
  const degradesRealizados = realizados.filter((a) => contemServico(a, ["degrad", "fade"])).length;

  const duracoes = realizados.map((a) => a.duracaoMinutos).filter((d): d is number => typeof d === "number");
  const tempoMedioMinutos = duracoes.length ? Math.round(duracoes.reduce((s, d) => s + d, 0) / duracoes.length) : 0;
  const horasPraticas = Math.round((duracoes.reduce((s, d) => s + d, 0) / 60) * 10) / 10;

  const mediasPorCategoria: Record<string, number> = {};
  CATEGORIAS_AVALIACAO.forEach((c) => {
    const notas = avaliados.map((a) => a.avaliacao?.[c]).filter((n): n is number => typeof n === "number");
    mediasPorCategoria[c] = notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : 0;
  });
  const todasNotas = avaliados.flatMap((a) =>
    CATEGORIAS_AVALIACAO.map((c) => a.avaliacao?.[c]).filter((n): n is number => typeof n === "number")
  );
  const notaMedia = todasNotas.length ? Math.round((todasNotas.reduce((s, n) => s + n, 0) / todasNotas.length) * 10) / 10 : 0;

  const melhoresTrabalhos = avaliados
    .filter((a) => a.fotoDepois)
    .map((a) => {
      const notas = CATEGORIAS_AVALIACAO.map((c) => a.avaliacao?.[c]).filter((n): n is number => typeof n === "number");
      const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 0;
      return { fotoAntes: a.fotoAntes, fotoDepois: a.fotoDepois, modeloNome: a.modeloNome, media, servicos: a.servicos, data: a.dataAgendada };
    })
    .sort((a, b) => b.media - a.media)
    .slice(0, 6);

  const horasEstudo = Math.round((progress.completedLessons || []).length * 1.5 * 10) / 10; // 90min por aula

  return {
    nome: enrollment.nome || "",
    horasEstudo,
    horasPraticas,
    tempoMedioMinutos,
    modelosAtendidos,
    cortesRealizados,
    barbasRealizadas,
    degradesRealizados,
    notaMedia,
    mediasPorCategoria,
    melhoresTrabalhos,
    avaliacoesRecebidas: avaliados.length,
    percentCurso: progress.percent || 0,
    certificateUrl: enrollment.certificateUrl || null,
    certificateCode: enrollment.certificateCode || null,
    certificateIssuedAt: enrollment.certificateIssuedAt ? enrollment.certificateIssuedAt.toDate().toLocaleDateString("pt-BR") : null,
  };
}

export const getMinhaCarteira = onRequest({ cors: true }, async (req, res) => {
  try {
    const enrollment = await getEnrollmentFromRequest(req);
    if (!enrollment) {
      res.status(403).json({ error: "Matrícula não encontrada ou acesso não liberado" });
      return;
    }
    const carteira = await computeCarteira(enrollment.id);
    res.status(200).json(carteira);
  } catch (err) {
    console.error("getMinhaCarteira error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
