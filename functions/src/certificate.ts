/**
 * Geração de Certificado — Novo Jeito Academy
 *
 * O certificado só é gerado quando o aluno atende os DOIS requisitos:
 *  1) 100% das aulas em vídeo concluídas
 *  2) Presença confirmada em TODOS os encontros da turma presencial em que está matriculado
 *
 * generateCertificateForEnrollment() é a função reutilizável, chamada automaticamente:
 *  - de progress.ts, toda vez que uma aula é marcada como concluída
 *  - de turmas.ts, toda vez que uma presença é confirmada via QR Code
 * Nos dois casos, se o outro requisito ainda não foi cumprido, ela não gera nada
 * (silenciosamente) — só emite quando os dois batem.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { DOCS_BUCKET, getOwnerSignatureBase64 } from "./utils";

const db = admin.firestore();
const storage = admin.storage();

const COURSE_TITLE = "Formação Completa de Barbeiro Profissional";
const INSTITUTION_NAME = "Novo Jeito Academy";
const GOLD = rgb(0.773, 0.541, 0.29); // #C58A4A
const DARK = rgb(0.02, 0.02, 0.02);
const CREAM = rgb(0.96, 0.94, 0.91);

// ============================================================
// Checagem de elegibilidade: vídeos 100% E presença completa
// ============================================================
export async function checkCertificateEligibility(
  enrollmentId: string
): Promise<{ eligible: boolean; reason?: string }> {
  const progressSnap = await db.collection("progress").doc(enrollmentId).get();
  const progress = progressSnap.data();
  if (!progress || progress.percent !== 100) {
    return { eligible: false, reason: "Aulas em vídeo ainda não concluídas" };
  }

  const bookingsSnap = await db.collection("turmaBookings").where("enrollmentId", "==", enrollmentId).get();
  if (bookingsSnap.empty) {
    return { eligible: false, reason: "Aluno ainda não se matriculou em nenhuma turma presencial" };
  }

  // considera elegível se a presença estiver completa em QUALQUER turma em que o aluno esteja
  for (const bookingDoc of bookingsSnap.docs) {
    const booking = bookingDoc.data();
    const turmaSnap = await db.collection("turmas").doc(booking.turmaId).get();
    if (!turmaSnap.exists) continue;

    const turma = turmaSnap.data()!;
    const encontros: { data: string }[] = turma.encontros || [];
    const presencas: Record<string, boolean> = booking.presencas || {};

    const todasConfirmadas = encontros.length > 0 && encontros.every((e) => presencas[e.data]);
    if (todasConfirmadas) {
      return { eligible: true };
    }
  }

  return { eligible: false, reason: "Presença pendente em algum encontro da turma presencial" };
}

// ============================================================
// Gera e salva o certificado (só roda se elegível)
// ============================================================
export async function generateCertificateForEnrollment(
  enrollmentId: string
): Promise<{ certificateUrl: string; certCode: string } | { error: string }> {
  const eligibility = await checkCertificateEligibility(enrollmentId);
  if (!eligibility.eligible) {
    return { error: eligibility.reason || "Requisitos não atendidos" };
  }

  const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
  if (!enrollmentSnap.exists) return { error: "Matrícula não encontrada" };
  const enrollment = enrollmentSnap.data()!;

  // se já tinha certificado emitido, não gera de novo — só retorna o existente
  if (enrollment.certificateUrl) {
    return { certificateUrl: enrollment.certificateUrl, certCode: enrollment.certificateCode };
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();

  const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontSerifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontSans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width, height, color: DARK });

  const margin = 28;
  page.drawRectangle({
    x: margin, y: margin, width: width - margin * 2, height: height - margin * 2,
    borderColor: GOLD, borderWidth: 1.4, color: undefined,
  });
  page.drawRectangle({
    x: margin + 8, y: margin + 8, width: width - (margin + 8) * 2, height: height - (margin + 8) * 2,
    borderColor: GOLD, borderWidth: 0.6, color: undefined,
  });

  const cornerLen = 26;
  const cx1 = margin + 8, cy1 = margin + 8;
  const cx2 = width - margin - 8, cy2 = height - margin - 8;
  drawCorner(page, cx1, cy1, cornerLen, "tl", GOLD);
  drawCorner(page, cx2, cy1, cornerLen, "tr", GOLD);
  drawCorner(page, cx1, cy2, cornerLen, "bl", GOLD);
  drawCorner(page, cx2, cy2, cornerLen, "br", GOLD);

  const centerX = width / 2;
  page.drawText(INSTITUTION_NAME.toUpperCase(), {
    x: centerX - fontSansBold.widthOfTextAtSize(INSTITUTION_NAME.toUpperCase(), 13) / 2,
    y: height - 90, size: 13, font: fontSansBold, color: GOLD,
  });

  const eyebrow = "CERTIFICADO DE CONCLUSÃO";
  page.drawText(eyebrow, {
    x: centerX - fontSans.widthOfTextAtSize(eyebrow, 9.5) / 2,
    y: height - 112, size: 9.5, font: fontSans, color: CREAM,
  });

  const preText = "Certificamos que";
  page.drawText(preText, {
    x: centerX - fontSerifItalic.widthOfTextAtSize(preText, 14) / 2,
    y: height - 190, size: 14, font: fontSerifItalic, color: CREAM,
  });

  const studentName = enrollment.nome as string;
  const nameSize = studentName.length > 28 ? 30 : 38;
  page.drawText(studentName, {
    x: centerX - fontSerif.widthOfTextAtSize(studentName, nameSize) / 2,
    y: height - 240, size: nameSize, font: fontSerif, color: GOLD,
  });

  page.drawLine({
    start: { x: centerX - 140, y: height - 255 },
    end: { x: centerX + 140, y: height - 255 },
    thickness: 0.8, color: GOLD,
  });

  const bodyLine1 = `concluiu com êxito o curso "${COURSE_TITLE}",`;
  const bodyLine2 = "incluindo a carga horária online e os encontros práticos presenciais,";
  const bodyLine3 = "estando apto(a) ao exercício profissional das técnicas ensinadas.";
  [bodyLine1, bodyLine2, bodyLine3].forEach((line, i) => {
    page.drawText(line, {
      x: centerX - fontSans.widthOfTextAtSize(line, 11) / 2,
      y: height - 290 - i * 18, size: 11, font: fontSans, color: CREAM,
    });
  });

  const issueDate = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  page.drawText(`Emitido em ${issueDate}`, { x: 70, y: 90, size: 9, font: fontSans, color: CREAM });

  const certCode = `NJ-${enrollmentId.slice(0, 8).toUpperCase()}`;
  page.drawText(`Código de autenticidade: ${certCode}`, { x: 70, y: 74, size: 8, font: fontSans, color: rgb(0.6, 0.56, 0.5) });

  const sigX = width - 260;
  const ownerSignatureBase64 = await getOwnerSignatureBase64();
  if (ownerSignatureBase64) {
    const ownerPngBytes = Buffer.from(ownerSignatureBase64.split(",")[1], "base64");
    const ownerPngImage = await pdfDoc.embedPng(ownerPngBytes);
    const maxW = 180;
    const maxH = 46;
    const scale = Math.min(maxW / ownerPngImage.width, maxH / ownerPngImage.height);
    const ownerDims = ownerPngImage.scale(scale);
    page.drawImage(ownerPngImage, {
      x: sigX + 95 - ownerDims.width / 2,
      y: 104,
      width: ownerDims.width,
      height: ownerDims.height,
    });
  }
  page.drawLine({ start: { x: sigX, y: 100 }, end: { x: sigX + 190, y: 100 }, thickness: 0.7, color: GOLD });
  page.drawText("Marcus Vinicius — Instrutor", {
    x: sigX + 95 - fontSans.widthOfTextAtSize("Marcus Vinicius — Instrutor", 9) / 2,
    y: 86, size: 9, font: fontSans, color: CREAM,
  });

  const pdfBytes = await pdfDoc.save();

  const filePath = `certificates/${enrollmentId}.pdf`;
  const file = storage.bucket(DOCS_BUCKET).file(filePath);
  await file.save(Buffer.from(pdfBytes), { contentType: "application/pdf" });
  const [certificateUrl] = await file.getSignedUrl({ action: "read", expires: "03-01-2035" });

  await db.collection("enrollments").doc(enrollmentId).update({
    certificateUrl,
    certificateCode: certCode,
    certificateIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { certificateUrl, certCode };
}

// ============================================================
// Endpoint HTTP (chamado pelo app do aluno ao terminar a última aula)
// ============================================================
export const generateCertificate = onRequest({ cors: true }, async (req, res) => {
  try {
    const { enrollmentId } = req.body;
    if (!enrollmentId) {
      res.status(400).json({ error: "enrollmentId obrigatório" });
      return;
    }

    const result = await generateCertificateForEnrollment(enrollmentId);
    if ("error" in result) {
      res.status(403).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("generateCertificate error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

function drawCorner(page: any, x: number, y: number, len: number, pos: "tl" | "tr" | "bl" | "br", color: any) {
  const t = 1.2;
  if (pos === "tl") {
    page.drawLine({ start: { x, y }, end: { x: x + len, y }, thickness: t, color });
    page.drawLine({ start: { x, y }, end: { x, y: y - len }, thickness: t, color });
  }
  if (pos === "tr") {
    page.drawLine({ start: { x, y }, end: { x: x - len, y }, thickness: t, color });
    page.drawLine({ start: { x, y }, end: { x, y: y - len }, thickness: t, color });
  }
  if (pos === "bl") {
    page.drawLine({ start: { x, y }, end: { x: x + len, y }, thickness: t, color });
    page.drawLine({ start: { x, y }, end: { x, y: y + len }, thickness: t, color });
  }
  if (pos === "br") {
    page.drawLine({ start: { x, y }, end: { x: x - len, y }, thickness: t, color });
    page.drawLine({ start: { x, y }, end: { x, y: y + len }, thickness: t, color });
  }
}
