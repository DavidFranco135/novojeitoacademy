/**
 * Aulas Presenciais — Novo Jeito Academy
 * Firebase Functions: criação de turmas (admin), agendamento de vaga (aluno) e check-in via QR Code
 *
 * Fluxo:
 *  1) Admin cria uma turma presencial (data, horário, local, nº de vagas)
 *  2) Aluno vê turmas disponíveis e reserva uma vaga
 *  3) Sistema gera um QR Code pessoal (token assinado) pro aluno mostrar no dia
 *  4) No local, alguém escaneia o QR com a câmera do celular -> abre um link -> confirmCheckin
 *     roda automaticamente e marca a presença (sem precisar de app de leitura dedicado)
 *
 * Dependência extra: npm install crypto (nativo do Node, não precisa instalar)
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const db = admin.firestore();

// chave usada só pra assinar o token do QR — configure com:
//   firebase functions:secrets:set CHECKIN_SECRET
const CHECKIN_SECRET = defineSecret("CHECKIN_SECRET");

// ============================================================
// 1) Admin cria uma turma presencial
// ============================================================
export const createPresencialSession = onRequest({ cors: true }, async (req, res) => {
  try {
    const { date, time, location, vagas } = req.body;
    if (!date || !time || !location || !vagas) {
      res.status(400).json({ error: "Dados incompletos" });
      return;
    }

    const sessionRef = await db.collection("presencialSessions").add({
      date,        // ex: "2026-08-15"
      time,        // ex: "09:00"
      location,    // ex: "Barbearia Novo Jeito - Rua X, 123"
      vagasTotal: vagas,
      vagasOcupadas: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ sessionId: sessionRef.id });
  } catch (err) {
    console.error("createPresencialSession error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 2) Lista turmas disponíveis (com vaga)
// ============================================================
export const listPresencialSessions = onRequest({ cors: true }, async (req, res) => {
  try {
    const snap = await db.collection("presencialSessions").orderBy("date").get();
    const sessions = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s: any) => s.vagasOcupadas < s.vagasTotal);

    res.status(200).json({ sessions });
  } catch (err) {
    console.error("listPresencialSessions error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// 3) Aluno reserva vaga na turma
// ============================================================
export const bookPresencialSession = onRequest({ cors: true, secrets: [CHECKIN_SECRET] }, async (req, res) => {
  try {
    const { enrollmentId, sessionId } = req.body;
    if (!enrollmentId || !sessionId) {
      res.status(400).json({ error: "Dados incompletos" });
      return;
    }

    const sessionRef = db.collection("presencialSessions").doc(sessionId);

    // transação: garante que não estoura o nº de vagas em reservas simultâneas
    await db.runTransaction(async (tx) => {
      const sessionDoc = await tx.get(sessionRef);
      if (!sessionDoc.exists) throw new Error("Turma não encontrada");
      const session = sessionDoc.data()!;

      if (session.vagasOcupadas >= session.vagasTotal) {
        throw new Error("Turma sem vagas disponíveis");
      }

      tx.update(sessionRef, { vagasOcupadas: session.vagasOcupadas + 1 });

      tx.set(db.collection("presencialBookings").doc(`${enrollmentId}_${sessionId}`), {
        enrollmentId,
        sessionId,
        status: "reservado", // reservado -> presente | faltou
        bookedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // gera o token assinado pro QR code pessoal
    const token = generateToken(enrollmentId, sessionId);
    const checkinUrl = `https://SEUSITE.com/checkin/${token}`;

    res.status(200).json({ checkinUrl });
  } catch (err: any) {
    console.error("bookPresencialSession error:", err);
    res.status(400).json({ error: err.message || "Erro ao reservar vaga" });
  }
});

// ============================================================
// 4) Check-in via QR Code (aberto ao escanear no local)
// ============================================================
export const confirmCheckin = onRequest({ cors: true, secrets: [CHECKIN_SECRET] }, async (req, res) => {
  const token = req.path.split("/").pop() || (req.query.token as string);

  try {
    const decoded = verifyToken(token || "");
    if (!decoded) {
      res.status(400).send(renderCheckinPage(false, "QR Code inválido ou expirado."));
      return;
    }

    const { enrollmentId, sessionId } = decoded;
    const bookingRef = db.collection("presencialBookings").doc(`${enrollmentId}_${sessionId}`);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      res.status(404).send(renderCheckinPage(false, "Reserva não encontrada."));
      return;
    }

    const booking = bookingDoc.data()!;
    if (booking.status === "presente") {
      res.status(200).send(renderCheckinPage(true, "Presença já confirmada anteriormente."));
      return;
    }

    await bookingRef.update({
      status: "presente",
      checkinAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
    const nome = enrollmentSnap.exists ? enrollmentSnap.data()!.nome : "Aluno";

    res.status(200).send(renderCheckinPage(true, `Presença confirmada — bem-vindo(a), ${nome}!`));
  } catch (err) {
    console.error("confirmCheckin error:", err);
    res.status(500).send(renderCheckinPage(false, "Erro ao confirmar presença."));
  }
});

// ============================================================
// Utilitários: token assinado (sem dependência externa)
// ============================================================
function generateToken(enrollmentId: string, sessionId: string): string {
  const payload = `${enrollmentId}:${sessionId}`;
  const signature = crypto.createHmac("sha256", CHECKIN_SECRET.value()).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

function verifyToken(token: string): { enrollmentId: string; sessionId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [enrollmentId, sessionId, signature] = decoded.split(":");
    const expected = crypto.createHmac("sha256", CHECKIN_SECRET.value()).update(`${enrollmentId}:${sessionId}`).digest("hex").slice(0, 16);
    if (signature !== expected) return null;
    return { enrollmentId, sessionId };
  } catch {
    return null;
  }
}

// página simples de confirmação exibida no navegador ao escanear o QR
function renderCheckinPage(success: boolean, message: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Check-in — Novo Jeito Academy</title>
<style>
  body{margin:0;background:#050505;color:#F5F0E8;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}
  .box{border:1px solid ${success ? "#C58A4A" : "#e8746a"};border-radius:8px;padding:2.4rem;max-width:380px}
  .icon{font-size:2.6rem;margin-bottom:1rem}
  h1{font-family:Georgia,serif;font-size:1.3rem;margin-bottom:.6rem;color:${success ? "#C58A4A" : "#e8746a"}}
  p{color:#c9c2b4;font-size:.9rem}
</style></head>
<body><div class="box">
  <div class="icon">${success ? "✓" : "✕"}</div>
  <h1>${success ? "Check-in confirmado" : "Não foi possível confirmar"}</h1>
  <p>${message}</p>
</div></body></html>`;
}
