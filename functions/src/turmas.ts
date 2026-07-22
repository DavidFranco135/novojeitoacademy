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
 *  - No dia de cada encontro, o aluno mostra o MESMO QR Code pessoal — o
 *    sistema identifica sozinho qual encontro é "hoje" e marca a presença
 *    daquele dia específico.
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
export const joinTurma = onRequest({ cors: true, secrets: [CHECKIN_SECRET] }, async (req, res) => {
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

    const token = generateToken(enrollmentId, turmaId);
    const checkinUrl = `https://us-central1-barbearia-do-ico.cloudfunctions.net/confirmCheckinTurma/${token}`;

    res.status(200).json({ checkinUrl });
  } catch (err: any) {
    console.error("joinTurma error:", err);
    res.status(400).json({ error: err.message || "Erro ao matricular na turma" });
  }
});

// ============================================================
// Busca a turma em que o ALUNO LOGADO já está matriculado (se houver),
// com a grade completa + o QR reconstruído — pra ele ver isso a qualquer
// momento, sem precisar se matricular de novo.
// ============================================================
export const getMyTurma = onRequest({ cors: true, secrets: [CHECKIN_SECRET] }, async (req, res) => {
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

    const checkinUrl = `https://us-central1-barbearia-do-ico.cloudfunctions.net/confirmCheckinTurma/${generateToken(enrollmentId, booking.turmaId)}`;

    res.status(200).json({
      enrollmentId,
      turma: { id: turmaSnap.id, ...turmaSnap.data() },
      presencas: booking.presencas || {},
      checkinUrl,
    });
  } catch (err) {
    console.error("getMyTurma error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 4) Check-in via QR Code — identifica sozinho qual encontro é "hoje"
// ============================================================
export const confirmCheckinTurma = onRequest({ cors: true, secrets: [CHECKIN_SECRET] }, async (req, res) => {
  const token = req.path.split("/").pop() || (req.query.token as string);

  try {
    const decoded = verifyToken(token || "");
    if (!decoded) {
      res.status(400).send(renderCheckinPage(false, "QR Code inválido ou expirado."));
      return;
    }

    const { enrollmentId, turmaId } = decoded;
    const bookingRef = db.collection("turmaBookings").doc(`${enrollmentId}_${turmaId}`);
    const [bookingDoc, turmaDoc] = await Promise.all([bookingRef.get(), db.collection("turmas").doc(turmaId).get()]);

    if (!bookingDoc.exists || !turmaDoc.exists) {
      res.status(404).send(renderCheckinPage(false, "Matrícula na turma não encontrada."));
      return;
    }

    const turma = turmaDoc.data()!;
    const hoje = new Date().toISOString().split("T")[0];
    const encontroHoje = (turma.encontros as Encontro[]).find((e) => e.data === hoje);

    if (!encontroHoje) {
      res.status(200).send(renderCheckinPage(false, "Não há nenhum encontro dessa turma marcado para hoje."));
      return;
    }

    const booking = bookingDoc.data()!;
    if (booking.presencas?.[hoje]) {
      res.status(200).send(renderCheckinPage(true, `Presença de hoje (${encontroHoje.topico}) já estava confirmada.`));
      return;
    }

    await bookingRef.update({ [`presencas.${hoje}`]: true });

    const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
    const nome = enrollmentSnap.exists ? enrollmentSnap.data()!.nome : "Aluno";

    // tenta gerar o certificado — só emite de verdade se os vídeos também já estiverem 100%
    const certResult = await generateCertificateForEnrollment(enrollmentId);
    const certificadoLiberado = !("error" in certResult);

    const mensagemExtra = certificadoLiberado
      ? " 🎓 Parabéns, seu certificado foi liberado!"
      : "";

    res.status(200).send(renderCheckinPage(true, `Presença confirmada em "${encontroHoje.topico}" — bem-vindo(a), ${nome}!${mensagemExtra}`));
  } catch (err) {
    console.error("confirmCheckinTurma error:", err);
    res.status(500).send(renderCheckinPage(false, "Erro ao confirmar presença."));
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

    await db.runTransaction(async (tx) => {
      // remove de qualquer turma anterior
      for (const oldBookingDoc of existingBookingsSnap.docs) {
        if (oldBookingDoc.id === newBookingRef.id) continue; // já está nessa mesma turma
        const oldBooking = oldBookingDoc.data();
        const oldTurmaRef = db.collection("turmas").doc(oldBooking.turmaId);
        const oldTurmaDoc = await tx.get(oldTurmaRef);
        if (oldTurmaDoc.exists) {
          tx.update(oldTurmaRef, { vagasOcupadas: Math.max(0, oldTurmaDoc.data()!.vagasOcupadas - 1) });
        }
        tx.delete(db.collection("turmaBookings").doc(oldBookingDoc.id));
      }

      const newBookingDoc = await tx.get(newBookingRef);
      if (newBookingDoc.exists) return; // já está matriculado nessa turma exata, nada a fazer

      const newTurmaDoc = await tx.get(newTurmaRef);
      if (!newTurmaDoc.exists) throw new Error("Turma não encontrada");
      const newTurma = newTurmaDoc.data()!;
      if (newTurma.vagasOcupadas >= newTurma.vagasTotal) throw new Error("Turma sem vagas disponíveis");

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
function generateToken(enrollmentId: string, turmaId: string): string {
  const payload = `${enrollmentId}:${turmaId}`;
  const signature = crypto.createHmac("sha256", CHECKIN_SECRET.value()).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

function verifyToken(token: string): { enrollmentId: string; turmaId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [enrollmentId, turmaId, signature] = decoded.split(":");
    const expected = crypto.createHmac("sha256", CHECKIN_SECRET.value()).update(`${enrollmentId}:${turmaId}`).digest("hex").slice(0, 16);
    if (signature !== expected) return null;
    return { enrollmentId, turmaId };
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

function renderCheckinPage(success: boolean, message: string): string {
  const color = success ? "#C58A4A" : "#e8746a";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Check-in — Novo Jeito Academy</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#050505;color:#F5F0E8;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem;position:relative;overflow:hidden}
  .grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(197,138,74,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(197,138,74,.06) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse 60% 55% at 50% 45%,black 10%,transparent 75%)}
  .logo{position:absolute;top:2rem;left:0;right:0;text-align:center;font-family:'Playfair Display',serif;font-weight:900;font-size:1rem;color:#F5F0E8;letter-spacing:.01em}
  .logo em{color:#C58A4A;font-style:italic}
  .box{position:relative;border:1px solid ${color};border-radius:8px;padding:2.6rem 2.2rem;max-width:380px;width:100%;background:linear-gradient(160deg,#0d0d0d,#050505);box-shadow:0 0 40px -12px ${color}55}
  .corner{position:absolute;width:16px;height:16px;border-color:${color}}
  .c-tl{top:10px;left:10px;border-top:1px solid;border-left:1px solid}
  .c-tr{top:10px;right:10px;border-top:1px solid;border-right:1px solid}
  .c-bl{bottom:10px;left:10px;border-bottom:1px solid;border-left:1px solid}
  .c-br{bottom:10px;right:10px;border-bottom:1px solid;border-right:1px solid}
  .icon{width:60px;height:60px;line-height:60px;border:1px solid ${color};border-radius:50%;font-size:1.8rem;margin:0 auto 1.2rem;color:${color}}
  h1{font-family:'Playfair Display',serif;font-weight:900;font-size:1.4rem;margin:0 0 .8rem;color:${color}}
  p{color:#c9c2b4;font-size:.9rem;line-height:1.6;margin:0}
  .eyebrow{font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.18em;color:#5a5348;margin-top:1.6rem;display:block}
</style></head>
<body>
  <div class="grid-bg"></div>
  <div class="logo">Novo Jeito <em>Academy</em></div>
  <div class="box">
    <div class="corner c-tl"></div><div class="corner c-tr"></div>
    <div class="corner c-bl"></div><div class="corner c-br"></div>
    <div class="icon">${success ? "✓" : "✕"}</div>
    <h1>${success ? "Check-in confirmado" : "Não foi possível confirmar"}</h1>
    <p>${message}</p>
    <span class="eyebrow">TURMA PRESENCIAL</span>
  </div>
</body></html>`;
}
