/**
 * Turmas Presenciais — Novo Jeito Academy
 *
 * Um curso híbrido, com VÁRIOS encontros presenciais ao longo do tempo
 * (assuntos diferentes em cada um), não um único módulo prático avulso.
 *
 * Modelo:
 *  - Uma "Turma" é uma coorte com nome (ex: "Turma Julho/2026") e uma grade
 *    de encontros (cada um com tópico, data, horário e local).
 *  - O aluno se matricula na turma UMA VEZ e passa a ter acesso a todos os
 *    encontros dela.
 *  - Check-in por encontro (não por aluno): o professor gera, pelo Admin, um
 *    QR DIFERENTE PRA CADA ENCONTRO (getLessonCheckinLink) e exibe numa tela
 *    no fim da aula. Cada aluno escaneia com o PRÓPRIO celular, já logado —
 *    é a autenticação do aluno que identifica quem está confirmando presença,
 *    não o QR (que só identifica QUAL encontro é). Isso evita repasse de QR
 *    entre alunos (cada um só confirma a própria presença, e só estando
 *    logado) e permite reposição: o QR de um encontro passado continua
 *    válido, então um aluno que faltou pode escanear depois, no dia em que
 *    repuser a aula com o professor.
 *
 * Dependência: nativo do Node (crypto), sem instalar nada extra.
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { generateCertificateForEnrollment } from "./certificate";

const db = admin.firestore();
const CHECKIN_SECRET = defineSecret("CHECKIN_SECRET");

interface Encontro {
  topico: string;
  data: string; // "2026-08-15"
  horario: string; // "09:00"
  local: string;
  moduloRelacionado?: string; // ex: "m2" — depois de qual módulo online esse encontro aparece na trilha do aluno
}

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

// ============================================================
// 1) Admin cria uma turma com a grade completa de encontros
// ============================================================
export const createTurma = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { nome, vagasTotal, encontros, preco, somentePresencial, descricao } = req.body as {
      nome: string;
      vagasTotal: number;
      encontros: Encontro[];
      preco?: number;
      somentePresencial?: boolean;
      descricao?: string;
    };
    if (!nome || !vagasTotal || !Array.isArray(encontros) || encontros.length === 0) {
      res.status(400).json({ error: "nome, vagasTotal e ao menos 1 encontro são obrigatórios" });
      return;
    }

    const turmaRef = await db.collection("turmas").add({
      nome,
      vagasTotal,
      vagasOcupadas: 0,
      encontros: encontros.sort((a, b) => a.data.localeCompare(b.data)),
      preco: preco || null, // se não preencher, usa o preço padrão do curso (configurado em Conteúdo do Site)
      somentePresencial: somentePresencial || false, // true = workshop avulso, sem pacote de aulas online
      descricao: descricao || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ turmaId: turmaRef.id });
  } catch (err) {
    console.error("createTurma error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 2) Lista turmas (aluno vê só as com vaga; admin vê todas com ?all=1)
// ============================================================
export const listTurmas = onRequest({ cors: true }, async (req, res) => {
  try {
    const snap = await db.collection("turmas").orderBy("createdAt", "desc").get();
    let turmas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const wantsAll = req.query.all === "1" && (await verificarAdmin(req));
    if (!wantsAll) {
      turmas = turmas.filter((t: any) => t.vagasOcupadas < t.vagasTotal);
    }

    res.status(200).json({ turmas });
  } catch (err) {
    console.error("listTurmas error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 3) Aluno se matricula na turma (uma vez, vale pra todos os encontros)
// ============================================================
export const joinTurma = onRequest({ cors: true }, async (req, res) => {
  try {
    const { enrollmentId, turmaId } = req.body;
    if (!enrollmentId || !turmaId) {
      res.status(400).json({ error: "Dados incompletos" });
      return;
    }

    const turmaRef = db.collection("turmas").doc(turmaId);
    const bookingRef = db.collection("turmaBookings").doc(`${enrollmentId}_${turmaId}`);

    await db.runTransaction(async (tx) => {
      const [turmaDoc, bookingDoc] = await Promise.all([tx.get(turmaRef), tx.get(bookingRef)]);
      if (!turmaDoc.exists) throw new Error("Turma não encontrada");

      // já estava matriculado nessa turma — não conta vaga de novo
      if (bookingDoc.exists) return;

      const turma = turmaDoc.data()!;
      if (turma.vagasOcupadas >= turma.vagasTotal) throw new Error("Turma sem vagas disponíveis");

      tx.update(turmaRef, { vagasOcupadas: turma.vagasOcupadas + 1 });

      tx.set(bookingRef, {
        enrollmentId,
        turmaId,
        presencas: {}, // preenchido conforme os check-ins acontecem: { "2026-08-15": true }
        bookedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("joinTurma error:", err);
    res.status(400).json({ error: err.message || "Erro ao matricular na turma" });
  }
});

// ============================================================
// Busca a turma em que o ALUNO LOGADO já está matriculado (se houver),
// com a grade completa e a presença de cada encontro — pra ele ver isso a
// qualquer momento, sem precisar se matricular de novo.
// ============================================================
export const getMyTurma = onRequest({ cors: true }, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      res.status(403).json({ error: "Não autenticado" });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email) {
      res.status(403).json({ error: "Não autenticado" });
      return;
    }

    const enrollmentSnap = await db
      .collection("enrollments")
      .where("email", "==", decoded.email)
      .where("status", "==", "acesso_liberado")
      .limit(1)
      .get();

    if (enrollmentSnap.empty) {
      res.status(200).json({ turma: null });
      return;
    }
    const enrollmentId = enrollmentSnap.docs[0].id;

    const bookingsSnap = await db.collection("turmaBookings").where("enrollmentId", "==", enrollmentId).limit(1).get();
    if (bookingsSnap.empty) {
      res.status(200).json({ turma: null, enrollmentId });
      return;
    }

    const booking = bookingsSnap.docs[0].data();
    const turmaSnap = await db.collection("turmas").doc(booking.turmaId).get();
    if (!turmaSnap.exists) {
      res.status(200).json({ turma: null, enrollmentId });
      return;
    }

    res.status(200).json({
      enrollmentId,
      turma: { id: turmaSnap.id, ...turmaSnap.data() },
      presencas: booking.presencas || {},
    });
  } catch (err) {
    console.error("getMyTurma error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 4a) Admin/professor gera o QR de UM encontro específico (exibido numa tela
// no fim da aula). O token só identifica o encontro (turma + data), não o
// aluno — quem confirma presença é sempre o aluno logado que escaneou.
// ============================================================
export const getLessonCheckinLink = onRequest({ cors: true, secrets: [CHECKIN_SECRET] }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { turmaId, data } = req.body;
    if (!turmaId || !data) {
      res.status(400).json({ error: "turmaId e data são obrigatórios" });
      return;
    }

    const turmaSnap = await db.collection("turmas").doc(turmaId).get();
    if (!turmaSnap.exists) {
      res.status(404).json({ error: "Turma não encontrada" });
      return;
    }
    const encontro = ((turmaSnap.data()!.encontros as Encontro[]) || []).find((e) => e.data === data);
    if (!encontro) {
      res.status(404).json({ error: "Não existe encontro dessa turma nessa data" });
      return;
    }

    const token = generateLessonToken(turmaId, data);
    const checkinUrl = `https://portal.novojeitobarbearia.com.br/aluno/checkin/${token}`;

    res.status(200).json({ checkinUrl, topico: encontro.topico });
  } catch (err) {
    console.error("getLessonCheckinLink error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 4b) Aluno logado escaneia o QR do encontro pra confirmar a própria
// presença. Não expira por data — um encontro passado continua com QR
// válido, pra dar pra registrar reposição escaneando depois.
// ============================================================
export const confirmLessonCheckin = onRequest({ cors: true, secrets: [CHECKIN_SECRET] }, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(403).json({ error: "Você precisa estar logado pra confirmar presença." });
      return;
    }
    const decodedUser = await admin.auth().verifyIdToken(idToken);
    if (!decodedUser.email) {
      res.status(403).json({ error: "Não autenticado" });
      return;
    }

    const { token } = req.body;
    const decoded = verifyLessonToken(token || "");
    if (!decoded) {
      res.status(400).json({ error: "QR Code inválido ou expirado." });
      return;
    }
    const { turmaId, data } = decoded;

    const enrollmentSnap = await db
      .collection("enrollments")
      .where("email", "==", decodedUser.email)
      .where("status", "==", "acesso_liberado")
      .limit(1)
      .get();
    if (enrollmentSnap.empty) {
      res.status(404).json({ error: "Matrícula não encontrada pra esse login." });
      return;
    }
    const enrollmentId = enrollmentSnap.docs[0].id;
    const nome = enrollmentSnap.docs[0].data().nome || "Aluno";

    const bookingRef = db.collection("turmaBookings").doc(`${enrollmentId}_${turmaId}`);
    const [bookingDoc, turmaDoc] = await Promise.all([bookingRef.get(), db.collection("turmas").doc(turmaId).get()]);

    if (!bookingDoc.exists || !turmaDoc.exists) {
      res.status(404).json({ error: "Você não está matriculado nessa turma." });
      return;
    }

    const turma = turmaDoc.data()!;
    const encontro = (turma.encontros as Encontro[]).find((e) => e.data === data);
    if (!encontro) {
      res.status(404).json({ error: "Esse encontro não existe mais nessa turma." });
      return;
    }

    const booking = bookingDoc.data()!;
    if (booking.presencas?.[data]) {
      res.status(200).json({ ok: true, topico: encontro.topico, jaConfirmado: true, nome });
      return;
    }

    await bookingRef.update({ [`presencas.${data}`]: true });

    // tenta gerar o certificado — só emite de verdade se os vídeos também já estiverem 100%
    const certResult = await generateCertificateForEnrollment(enrollmentId);
    const certificadoLiberado = !("error" in certResult);

    res.status(200).json({ ok: true, topico: encontro.topico, jaConfirmado: false, certificadoLiberado, nome });
  } catch (err) {
    console.error("confirmLessonCheckin error:", err);
    res.status(500).json({ error: "Erro ao confirmar presença." });
  }
});

// ============================================================
// 5) Admin vê a lista de matriculados numa turma + presença por encontro
// ============================================================
export const listTurmaAttendance = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const turmaId = req.query.turmaId as string;
    if (!turmaId) {
      res.status(400).json({ error: "turmaId obrigatório" });
      return;
    }

    const bookingsSnap = await db.collection("turmaBookings").where("turmaId", "==", turmaId).get();

    const alunos = await Promise.all(
      bookingsSnap.docs.map(async (doc) => {
        const booking = doc.data();
        const enrollmentSnap = await db.collection("enrollments").doc(booking.enrollmentId).get();
        return {
          nome: enrollmentSnap.exists ? enrollmentSnap.data()!.nome : "Aluno não encontrado",
          presencas: booking.presencas || {},
        };
      })
    );

    res.status(200).json({ alunos });
  } catch (err) {
    console.error("listTurmaAttendance error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Admin atribui manualmente um aluno a uma turma (ou troca de turma)
// ============================================================
export const adminAssignTurma = onRequest({ cors: true, secrets: [CHECKIN_SECRET] }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { enrollmentId, turmaId } = req.body;
    if (!enrollmentId || !turmaId) {
      res.status(400).json({ error: "Dados incompletos" });
      return;
    }

    const newTurmaRef = db.collection("turmas").doc(turmaId);
    const newBookingRef = db.collection("turmaBookings").doc(`${enrollmentId}_${turmaId}`);

    // se o aluno já estava em outra turma, remove de lá primeiro (libera a vaga antiga)
    const existingBookingsSnap = await db.collection("turmaBookings").where("enrollmentId", "==", enrollmentId).get();
    const oldBookingsToRemove = existingBookingsSnap.docs.filter((d) => d.id !== newBookingRef.id);

    await db.runTransaction(async (tx) => {
      // Firestore exige todas as leituras antes de qualquer escrita na transação —
      // por isso lê tudo primeiro (turmas antigas + turma/booking novos) e só
      // depois começa a escrever.
      const oldTurmaRefs = oldBookingsToRemove.map((d) => db.collection("turmas").doc(d.data().turmaId));
      const [oldTurmaDocs, newBookingDoc, newTurmaDoc] = await Promise.all([
        Promise.all(oldTurmaRefs.map((ref) => tx.get(ref))),
        tx.get(newBookingRef),
        tx.get(newTurmaRef),
      ]);

      if (newBookingDoc.exists) return; // já está matriculado nessa turma exata, nada a fazer

      if (!newTurmaDoc.exists) throw new Error("Turma não encontrada");
      const newTurma = newTurmaDoc.data()!;
      if (newTurma.vagasOcupadas >= newTurma.vagasTotal) throw new Error("Turma sem vagas disponíveis");

      // agora só escritas: remove de qualquer turma anterior...
      oldBookingsToRemove.forEach((oldBookingDoc, i) => {
        const oldTurmaDoc = oldTurmaDocs[i];
        if (oldTurmaDoc.exists) {
          tx.update(oldTurmaRefs[i], { vagasOcupadas: Math.max(0, oldTurmaDoc.data()!.vagasOcupadas - 1) });
        }
        tx.delete(db.collection("turmaBookings").doc(oldBookingDoc.id));
      });

      // ...e matricula na nova
      tx.update(newTurmaRef, { vagasOcupadas: newTurma.vagasOcupadas + 1 });
      tx.set(newBookingRef, {
        enrollmentId,
        turmaId,
        presencas: {},
        bookedAt: admin.firestore.FieldValue.serverTimestamp(),
        atribuidoPeloAdmin: true,
      });
    });

    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("adminAssignTurma error:", err);
    res.status(400).json({ error: err.message || "Erro ao atribuir turma" });
  }
});

// ============================================================
// Token identifica só o ENCONTRO (turma + data) — não o aluno. É por isso
// que continua válido pra sempre (não tem data de expiração): serve tanto
// pro check-in no dia quanto pra reposição depois.
function generateLessonToken(turmaId: string, data: string): string {
  const payload = `${turmaId}:${data}`;
  const signature = crypto.createHmac("sha256", CHECKIN_SECRET.value()).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

function verifyLessonToken(token: string): { turmaId: string; data: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [turmaId, data, signature] = decoded.split(":");
    const expected = crypto.createHmac("sha256", CHECKIN_SECRET.value()).update(`${turmaId}:${data}`).digest("hex").slice(0, 16);
    if (signature !== expected) return null;
    return { turmaId, data };
  } catch {
    return null;
  }
}

// ============================================================
// Busca os dados de UMA turma específica — usado pela página de matrícula
// avulsa, pra mostrar nome/preço/descrição antes do pagamento
// ============================================================
export const getTurmaAvulsa = onRequest({ cors: true }, async (req, res) => {
  try {
    const turmaId = (req.query.turmaId as string) || req.path.split("/").pop();
    if (!turmaId) {
      res.status(400).json({ error: "turmaId obrigatório" });
      return;
    }

    const turmaSnap = await db.collection("turmas").doc(turmaId).get();
    if (!turmaSnap.exists) {
      res.status(404).json({ error: "Turma não encontrada" });
      return;
    }
    const turma = turmaSnap.data()!;

    if (!turma.somentePresencial) {
      res.status(400).json({ error: "Essa turma não é vendida separadamente" });
      return;
    }

    const vagasRestantes = turma.vagasTotal - turma.vagasOcupadas;
    res.status(200).json({
      id: turmaSnap.id,
      nome: turma.nome,
      descricao: turma.descricao || "",
      preco: turma.preco,
      encontros: turma.encontros,
      vagasRestantes,
    });
  } catch (err) {
    console.error("getTurmaAvulsa error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
