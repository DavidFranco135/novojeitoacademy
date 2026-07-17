/**
 * Geração de Certificado — Novo Jeito Academy
 * Firebase Function: dispara automaticamente quando o aluno completa 100% do curso.
 *
 * Sugestão de uso: chamar generateCertificate() dentro da mesma função que marca
 * a última aula como concluída (markLessonComplete), verificando se completedCount === totalLessons.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const db = admin.firestore();
const storage = admin.storage();

const COURSE_TITLE = "Formação Completa de Barbeiro Profissional";
const INSTITUTION_NAME = "Novo Jeito Academy";
const GOLD = rgb(0.773, 0.541, 0.29); // #C58A4A
const DARK = rgb(0.02, 0.02, 0.02);
const CREAM = rgb(0.96, 0.94, 0.91);

export const generateCertificate = onRequest({ cors: true }, async (req, res) => {
  try {
    const { enrollmentId } = req.body;
    if (!enrollmentId) {
      res.status(400).json({ error: "enrollmentId obrigatório" });
      return;
    }

    const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
    if (!enrollmentSnap.exists) {
      res.status(404).json({ error: "Matrícula não encontrada" });
      return;
    }
    const enrollment = enrollmentSnap.data()!;

    // ---- valida que o curso está 100% concluído ----
    const progressSnap = await db.collection("progress").doc(enrollmentId).get();
    const progress = progressSnap.data();
    if (!progress || progress.percent !== 100) {
      res.status(403).json({ error: "Curso ainda não concluído" });
      return;
    }

    // ---- monta o certificado (paisagem, A4) ----
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]);
    const { width, height } = page.getSize();

    const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontSerifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const fontSans = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // fundo escuro
    page.drawRectangle({ x: 0, y: 0, width, height, color: DARK });

    // moldura dourada dupla
    const margin = 28;
    page.drawRectangle({
      x: margin, y: margin, width: width - margin * 2, height: height - margin * 2,
      borderColor: GOLD, borderWidth: 1.4, color: undefined,
    });
    page.drawRectangle({
      x: margin + 8, y: margin + 8, width: width - (margin + 8) * 2, height: height - (margin + 8) * 2,
      borderColor: GOLD, borderWidth: 0.6, color: undefined,
    });

    // cantos decorativos (estilo "scanner" do site)
    const cornerLen = 26;
    const cx1 = margin + 8, cy1 = margin + 8;
    const cx2 = width - margin - 8, cy2 = height - margin - 8;
    drawCorner(page, cx1, cy1, cornerLen, "tl", GOLD);
    drawCorner(page, cx2, cy1, cornerLen, "tr", GOLD);
    drawCorner(page, cx1, cy2, cornerLen, "bl", GOLD);
    drawCorner(page, cx2, cy2, cornerLen, "br", GOLD);

    // cabeçalho / instituição
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

    // "Certificamos que"
    const preText = "Certificamos que";
    page.drawText(preText, {
      x: centerX - fontSerifItalic.widthOfTextAtSize(preText, 14) / 2,
      y: height - 190, size: 14, font: fontSerifItalic, color: CREAM,
    });

    // nome do aluno em destaque
    const studentName = enrollment.nome as string;
    const nameSize = studentName.length > 28 ? 30 : 38;
    page.drawText(studentName, {
      x: centerX - fontSerif.widthOfTextAtSize(studentName, nameSize) / 2,
      y: height - 240, size: nameSize, font: fontSerif, color: GOLD,
    });

    // linha decorativa sob o nome
    page.drawLine({
      start: { x: centerX - 140, y: height - 255 },
      end: { x: centerX + 140, y: height - 255 },
      thickness: 0.8, color: GOLD,
    });

    // texto de conclusão
    const bodyLine1 = `concluiu com êxito o curso "${COURSE_TITLE}",`;
    const bodyLine2 = "com carga horária total de 42 horas, incluindo módulos práticos presenciais,";
    const bodyLine3 = "estando apto(a) ao exercício profissional das técnicas ensinadas.";
    [bodyLine1, bodyLine2, bodyLine3].forEach((line, i) => {
      page.drawText(line, {
        x: centerX - fontSans.widthOfTextAtSize(line, 11) / 2,
        y: height - 290 - i * 18, size: 11, font: fontSans, color: CREAM,
      });
    });

    // rodapé: data, assinatura do instrutor, código de autenticidade
    const issueDate = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    page.drawText(`Emitido em ${issueDate}`, { x: 70, y: 90, size: 9, font: fontSans, color: CREAM });

    const certCode = `NJ-${enrollmentId.slice(0, 8).toUpperCase()}`;
    page.drawText(`Código de autenticidade: ${certCode}`, { x: 70, y: 74, size: 8, font: fontSans, color: rgb(0.6, 0.56, 0.5) });

    // assinatura do instrutor (linha + nome)
    const sigX = width - 260;
    page.drawLine({ start: { x: sigX, y: 100 }, end: { x: sigX + 190, y: 100 }, thickness: 0.7, color: GOLD });
    page.drawText("Marcus Vinicius — Instrutor", {
      x: sigX + 95 - fontSans.widthOfTextAtSize("Marcus Vinicius — Instrutor", 9) / 2,
      y: 86, size: 9, font: fontSans, color: CREAM,
    });

    const pdfBytes = await pdfDoc.save();

    // salva no Storage
    const filePath = `certificates/${enrollmentId}.pdf`;
    const file = storage.bucket().file(filePath);
    await file.save(Buffer.from(pdfBytes), { contentType: "application/pdf" });
    const [certificateUrl] = await file.getSignedUrl({ action: "read", expires: "03-01-2035" });

    await db.collection("enrollments").doc(enrollmentId).update({
      certificateUrl,
      certificateCode: certCode,
      certificateIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ certificateUrl, certCode });
  } catch (err) {
    console.error("generateCertificate error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// desenha um canto tipo "mira" (estilo visual do site) em uma posição
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
