/**
 * Comprovante de Adesão — Novo Jeito Academy
 *
 * PDF simples confirmando a matrícula (nome, CPF, curso, data, valor, forma de
 * pagamento) — diferente do contrato (que tem o texto jurídico completo) e do
 * certificado (que só sai ao concluir o curso). Esse aqui serve pra mandar por
 * WhatsApp na hora que a matrícula é confirmada, como recibo/comprovante rápido.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const db = admin.firestore();
const storage = admin.storage();

const GOLD = rgb(0.773, 0.541, 0.29);
const DARK = rgb(0.02, 0.02, 0.02);
const CREAM = rgb(0.96, 0.94, 0.91);

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

export const generateComprovante = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

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

    // reaproveita se já tiver sido gerado antes, não gera de novo à toa
    if (enrollment.comprovanteUrl) {
      res.status(200).json({ comprovanteUrl: enrollment.comprovanteUrl });
      return;
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 420]);
    const { width, height } = page.getSize();

    const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontSans = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawRectangle({ x: 0, y: 0, width, height, color: DARK });

    const margin = 24;
    page.drawRectangle({ x: margin, y: margin, width: width - margin * 2, height: height - margin * 2, borderColor: GOLD, borderWidth: 1.2 });

    const centerX = width / 2;
    page.drawText("NOVO JEITO ACADEMY", {
      x: centerX - fontSansBold.widthOfTextAtSize("NOVO JEITO ACADEMY", 13) / 2,
      y: height - 60, size: 13, font: fontSansBold, color: GOLD,
    });

    const title = "COMPROVANTE DE ADESÃO";
    page.drawText(title, {
      x: centerX - fontSerif.widthOfTextAtSize(title, 20) / 2,
      y: height - 100, size: 20, font: fontSerif, color: CREAM,
    });

    const paymentMethodLabel: Record<string, string> = {
      dinheiro: "Dinheiro (presencial)",
      bolsa: "Bolsa de 100% (gratuito)",
    };
    const metodo = enrollment.isBolsa
      ? paymentMethodLabel.bolsa
      : enrollment.paymentMethod === "dinheiro"
      ? paymentMethodLabel.dinheiro
      : "Mercado Pago (online)";

    const valor = enrollment.isBolsa
      ? "R$ 0,00"
      : enrollment.valorPago
      ? `R$ ${Number(enrollment.valorPago).toFixed(2).replace(".", ",")}`
      : "R$ 697,00";
    const dataMatricula = enrollment.paidAt ? enrollment.paidAt.toDate().toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");

    const rows: [string, string][] = [
      ["Aluno", enrollment.nome],
      ["CPF", enrollment.cpf || "-"],
      ["Curso", "Formação Completa de Barbeiro Profissional"],
      ["Data da matrícula", dataMatricula],
      ["Valor", valor],
      ["Forma de pagamento", metodo],
    ];

    let y = height - 150;
    for (const [label, value] of rows) {
      page.drawText(`${label}:`, { x: 70, y, size: 10.5, font: fontSansBold, color: GOLD });
      page.drawText(value, { x: 230, y, size: 10.5, font: fontSans, color: CREAM });
      y -= 26;
    }

    page.drawLine({ start: { x: 70, y: 60 }, end: { x: width - 70, y: 60 }, thickness: 0.6, color: GOLD });
    page.drawText("Este documento confirma a adesão ao curso. O acesso à área do aluno é liberado automaticamente.", {
      x: 70, y: 42, size: 8.5, font: fontSans, color: rgb(0.6, 0.56, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    const filePath = `comprovantes/${enrollmentId}.pdf`;
    const file = storage.bucket().file(filePath);
    await file.save(Buffer.from(pdfBytes), { contentType: "application/pdf" });
    const [comprovanteUrl] = await file.getSignedUrl({ action: "read", expires: "03-01-2035" });

    await db.collection("enrollments").doc(enrollmentId).update({ comprovanteUrl });

    res.status(200).json({ comprovanteUrl });
  } catch (err) {
    console.error("generateComprovante error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
