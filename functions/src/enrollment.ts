/**
 * Backend — Novo Jeito Academy
 * Firebase Functions (Node.js) — cadastro, contrato assinado (PDF) e pagamento via Mercado Pago
 *
 * Dependências a instalar:
 *   npm install firebase-admin firebase-functions mercadopago pdf-lib
 *
 * Secrets necessários (mesmo padrão do sistema da barbearia):
 *   firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

// admin.initializeApp() já é chamado centralmente em index.ts
const db = admin.firestore();
const storage = admin.storage();

const MERCADOPAGO_ACCESS_TOKEN = defineSecret("MERCADOPAGO_ACCESS_TOKEN");

const COURSE_PRICE = 497.0;
const COURSE_TITLE = "Formação Completa de Barbeiro Profissional";

// ============================================================
// 1) Criar matrícula (etapa "Dados")
// ============================================================
export const createEnrollment = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      const { nome, email, telefone, cpf } = req.body;

      if (!nome || !email || !telefone || !cpf) {
        res.status(400).json({ error: "Dados incompletos" });
        return;
      }

      const enrollmentRef = await db.collection("enrollments").add({
        nome,
        email,
        telefone,
        cpf,
        status: "cadastrado", // cadastrado -> contrato_assinado -> pago -> acesso_liberado
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({ enrollmentId: enrollmentRef.id });
    } catch (err) {
      console.error("createEnrollment error:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ============================================================
// 2) Assinar contrato -> gera PDF e salva no Storage
// ============================================================
export const signContract = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      const { enrollmentId, signatureBase64, contractText } = req.body;

      if (!enrollmentId || !signatureBase64 || !contractText) {
        res.status(400).json({ error: "Dados incompletos" });
        return;
      }

      const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
      if (!enrollmentSnap.exists) {
        res.status(404).json({ error: "Matrícula não encontrada" });
        return;
      }
      const enrollment = enrollmentSnap.data()!;

      // ---- gera o PDF do contrato ----
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let y = 800;
      page.drawText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS", {
        x: 50, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1),
      });
      y -= 30;

      // quebra o texto do contrato em linhas simples (largura ~90 chars)
      const lines = wrapText(contractText, 95);
      for (const line of lines) {
        if (y < 160) {
          // nova página se acabar o espaço
          break;
        }
        page.drawText(line, { x: 50, y, size: 9.5, font, color: rgb(0.15, 0.15, 0.15) });
        y -= 14;
      }

      // dados do contratante
      y -= 10;
      page.drawText(`Contratante: ${enrollment.nome}`, { x: 50, y, size: 10, font: fontBold });
      y -= 14;
      page.drawText(`CPF: ${enrollment.cpf}   E-mail: ${enrollment.email}`, { x: 50, y, size: 9.5, font });
      y -= 14;
      page.drawText(`Data/hora da assinatura: ${new Date().toLocaleString("pt-BR")}`, { x: 50, y, size: 9.5, font });
      y -= 14;
      const ip = req.headers["x-forwarded-for"] || req.ip || "não identificado";
      page.drawText(`IP registrado: ${ip}`, { x: 50, y, size: 9.5, font });
      y -= 30;

      // embute a imagem da assinatura (canvas em base64 PNG)
      const pngBytes = Buffer.from(signatureBase64.split(",")[1], "base64");
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const sigDims = pngImage.scale(0.35);
      page.drawText("Assinatura:", { x: 50, y, size: 9.5, font: fontBold });
      y -= sigDims.height;
      page.drawImage(pngImage, { x: 50, y, width: sigDims.width, height: sigDims.height });

      const pdfBytes = await pdfDoc.save();

      // salva no Storage
      const filePath = `contracts/${enrollmentId}.pdf`;
      const file = storage.bucket().file(filePath);
      await file.save(Buffer.from(pdfBytes), { contentType: "application/pdf" });
      const [contractUrl] = await file.getSignedUrl({ action: "read", expires: "03-01-2035" });

      await db.collection("enrollments").doc(enrollmentId).update({
        status: "contrato_assinado",
        contractUrl,
        signedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({ contractUrl });
    } catch (err) {
      console.error("signContract error:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ============================================================
// 3) Criar preferência de pagamento (Mercado Pago)
// ============================================================
export const createPaymentPreference = onRequest(
  { cors: true, secrets: [MERCADOPAGO_ACCESS_TOKEN] },
  async (req, res) => {
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

      const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN.value() });
      const preference = new Preference(client);

      const result = await preference.create({
        body: {
          items: [
            {
              id: enrollmentId,
              title: COURSE_TITLE,
              quantity: 1,
              unit_price: COURSE_PRICE,
              currency_id: "BRL",
            },
          ],
          payer: {
            name: enrollment.nome,
            email: enrollment.email,
          },
          external_reference: enrollmentId, // usado no webhook pra identificar a matrícula
          back_urls: {
            success: "https://SEUSITE.com/matricula/sucesso",
            failure: "https://SEUSITE.com/matricula/erro",
            pending: "https://SEUSITE.com/matricula/pendente",
          },
          auto_return: "approved",
          notification_url: "https://SEUREGIAO-SEUPROJETO.cloudfunctions.net/mercadopagoWebhook",
        },
      });

      res.status(200).json({ init_point: result.init_point });
    } catch (err) {
      console.error("createPaymentPreference error:", err);
      res.status(500).json({ error: "Erro ao criar pagamento" });
    }
  }
);

// ============================================================
// 4) Webhook Mercado Pago -> confirma pagamento e libera acesso
// ============================================================
export const mercadopagoWebhook = onRequest(
  { secrets: [MERCADOPAGO_ACCESS_TOKEN] },
  async (req, res) => {
    try {
      const paymentId = req.query["data.id"] || req.body?.data?.id;
      if (!paymentId) {
        res.status(200).send("ignored"); // Mercado Pago manda outros tipos de evento também
        return;
      }

      const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN.value() });
      const payment = new Payment(client);
      const paymentInfo = await payment.get({ id: paymentId as string });

      if (paymentInfo.status === "approved") {
        const enrollmentId = paymentInfo.external_reference;
        if (enrollmentId) {
          const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
          const enrollment = enrollmentSnap.data();

          await db.collection("enrollments").doc(enrollmentId).update({
            status: "acesso_liberado",
            paymentId,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // cria o login do aluno no Firebase Auth (login sem senha via link mágico)
          if (enrollment?.email) {
            try {
              await admin.auth().createUser({
                email: enrollment.email,
                displayName: enrollment.nome,
              });
            } catch (e: any) {
              // se o usuário já existir (ex: reenvio de webhook), apenas ignora
              if (e.code !== "auth/email-already-exists") throw e;
            }
          }

          // TODO: disparar e-mail de boas-vindas com o link de primeiro acesso (/login)
        }
      }

      res.status(200).send("ok");
    } catch (err) {
      console.error("mercadopagoWebhook error:", err);
      res.status(500).send("erro");
    }
  }
);

// ============================================================
// Utilitário: quebra de texto simples pra desenhar no PDF
// ============================================================
function wrapText(text: string, maxChars: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      result.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(" ")) {
      if ((line + " " + word).trim().length > maxChars) {
        result.push(line.trim());
        line = word;
      } else {
        line += " " + word;
      }
    }
    if (line.trim()) result.push(line.trim());
  }
  return result;
}
