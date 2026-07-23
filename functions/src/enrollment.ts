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
import { toBrandedLoginLink } from "./utils";

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
      const { nome, email, telefone, cpf, rg, dataNascimento, endereco, cidade, turmaAvulsaId, scholarshipApplicationId, paymentMethod, valorCombinado } = req.body;

      if (!nome || !email || !telefone || !cpf) {
        res.status(400).json({ error: "Dados incompletos" });
        return;
      }

      // Se veio turmaAvulsaId, é uma matrícula avulsa (só naquela turma presencial,
      // com preço próprio) — não dá acesso ao curso online completo.
      let turmaAvulsaNome: string | null = null;
      if (turmaAvulsaId) {
        const turmaSnap = await db.collection("turmas").doc(turmaAvulsaId).get();
        if (!turmaSnap.exists || !turmaSnap.data()!.somentePresencial) {
          res.status(400).json({ error: "Turma avulsa inválida" });
          return;
        }
        turmaAvulsaNome = turmaSnap.data()!.nome;
      }

      // Se veio scholarshipApplicationId, é uma matrícula de bolsa (100% grátis) —
      // valida que a candidatura existe e ainda não foi usada antes de marcar isBolsa.
      let isBolsa = false;
      if (scholarshipApplicationId) {
        const appSnap = await db.collection("scholarshipApplications").doc(scholarshipApplicationId).get();
        if (!appSnap.exists) {
          res.status(400).json({ error: "Candidatura de bolsa inválida" });
          return;
        }
        if (appSnap.data()!.status === "selecionado") {
          res.status(400).json({ error: "Essa bolsa já foi utilizada" });
          return;
        }
        isBolsa = true;
      }

      // Pagamento em dinheiro combinado com o admin — libera acesso ao assinar,
      // sem precisar passar pelo Mercado Pago.
      const isDinheiro = paymentMethod === "dinheiro";

      const enrollmentRef = await db.collection("enrollments").add({
        nome,
        email,
        telefone,
        cpf,
        rg: rg || null,
        dataNascimento: dataNascimento || null,
        endereco: endereco || null,
        cidade: cidade || null,
        status: "cadastrado", // cadastrado -> contrato_assinado -> pago -> acesso_liberado
        tipo: turmaAvulsaId ? "turma_avulsa" : "curso_completo",
        turmaAvulsaId: turmaAvulsaId || null,
        turmaAvulsaNome,
        isBolsa,
        scholarshipApplicationId: scholarshipApplicationId || null,
        paymentMethod: isDinheiro ? "dinheiro" : null,
        valorPago: isDinheiro ? (Number(valorCombinado) || COURSE_PRICE) : null,
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

      // ---- gera o PDF do contrato (múltiplas páginas, conforme o tamanho do texto) ----
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const PAGE_WIDTH = 595;
      const PAGE_HEIGHT = 842;
      const MARGIN_TOP = 800;
      const MARGIN_BOTTOM = 50;

      let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let y = MARGIN_TOP;

      function newPageIfNeeded(minSpaceNeeded = 14) {
        if (y < MARGIN_BOTTOM + minSpaceNeeded) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          y = MARGIN_TOP;
        }
      }

      page.drawText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS", {
        x: 50, y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1),
      });
      y -= 26;

      // quebra o texto do contrato em linhas simples, criando página nova sempre que precisar
      const lines = wrapText(contractText, 95);
      for (const line of lines) {
        newPageIfNeeded();
        // linhas de título de seção (ex: "1. DAS PARTES") ficam em negrito
        const isSectionTitle = /^\d+\.\s[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ]/.test(line);
        page.drawText(line, { x: 50, y, size: 9.5, font: isSectionTitle ? fontBold : font, color: rgb(0.15, 0.15, 0.15) });
        y -= 13;
      }

      // dados de assinatura eletrônica (data/hora, IP) — sempre numa página com espaço garantido
      newPageIfNeeded(140);
      y -= 16;
      page.drawText(`Data/hora da assinatura: ${new Date().toLocaleString("pt-BR")}`, { x: 50, y, size: 9.5, font });
      y -= 14;
      const ip = req.headers["x-forwarded-for"] || req.ip || "não identificado";
      page.drawText(`IP registrado: ${ip}`, { x: 50, y, size: 9.5, font });
      y -= 30;

      // embute a imagem da assinatura (canvas em base64 PNG)
      const pngBytes = Buffer.from(signatureBase64.split(",")[1], "base64");
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const sigDims = pngImage.scale(0.35);
      newPageIfNeeded(sigDims.height + 20);
      page.drawText("Assinatura:", { x: 50, y, size: 9.5, font: fontBold });
      y -= sigDims.height;
      page.drawImage(pngImage, { x: 50, y, width: sigDims.width, height: sigDims.height });

      const pdfBytes = await pdfDoc.save();

      // salva no Storage
      const filePath = `contracts/${enrollmentId}.pdf`;
      const file = storage.bucket().file(filePath);
      await file.save(Buffer.from(pdfBytes), { contentType: "application/pdf" });
      const [contractUrl] = await file.getSignedUrl({ action: "read", expires: "03-01-2035" });

      // Bolsa e dinheiro combinado não passam pelo Mercado Pago — o acesso é liberado
      // direto assim que o contrato é assinado (igual ao que o webhook do MP faz após
      // um pagamento aprovado).
      const liberaAcessoDireto = enrollment.isBolsa || enrollment.paymentMethod === "dinheiro";

      if (liberaAcessoDireto) {
        await db.collection("enrollments").doc(enrollmentId).update({
          status: "acesso_liberado",
          contractUrl,
          signedAt: admin.firestore.FieldValue.serverTimestamp(),
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          valorPago: enrollment.isBolsa ? 0 : (enrollment.valorPago || COURSE_PRICE),
        });

        try {
          await admin.auth().createUser({ email: enrollment.email, displayName: enrollment.nome });
        } catch (e: any) {
          if (e.code !== "auth/email-already-exists") throw e;
        }

        let loginLink: string | null = null;
        try {
          const rawLink = await admin.auth().generateSignInWithEmailLink(enrollment.email, {
            url: "https://novojeitoapp.pages.dev/login",
            handleCodeInApp: true,
          });
          loginLink = toBrandedLoginLink(rawLink);
        } catch (e) {
          console.error("signContract: falha ao gerar link de login", e);
        }

        if (enrollment.scholarshipApplicationId) {
          await db.collection("scholarshipApplications").doc(enrollment.scholarshipApplicationId)
            .update({ status: "selecionado" })
            .catch(() => {});
        }

        res.status(200).json({
          contractUrl,
          loginLink,
          isBolsa: !!enrollment.isBolsa,
          isDinheiro: enrollment.paymentMethod === "dinheiro",
        });
        return;
      }

      // fluxo pago normal (Mercado Pago) — inalterado
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

      // se for matrícula avulsa (só naquela turma presencial), usa o preço da turma;
      // senão, usa o preço padrão do curso completo
      let precoFinal = COURSE_PRICE;
      let tituloFinal = COURSE_TITLE;
      if (enrollment.turmaAvulsaId) {
        const turmaSnap = await db.collection("turmas").doc(enrollment.turmaAvulsaId).get();
        if (turmaSnap.exists && turmaSnap.data()!.preco) {
          precoFinal = turmaSnap.data()!.preco;
          tituloFinal = `Turma: ${turmaSnap.data()!.nome}`;
        }
      }

      const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN.value() });
      const preference = new Preference(client);

      const result = await preference.create({
        body: {
          items: [
            {
              id: enrollmentId,
              title: tituloFinal,
              quantity: 1,
              unit_price: precoFinal,
              currency_id: "BRL",
            },
          ],
          payer: {
            name: enrollment.nome,
            email: enrollment.email,
          },
          external_reference: enrollmentId, // usado no webhook pra identificar a matrícula
          back_urls: {
            success: "https://novojeitoapp.pages.dev/matricula/sucesso",
            failure: "https://novojeitoapp.pages.dev/matricula/erro",
            pending: "https://novojeitoapp.pages.dev/matricula/pendente",
          },
          auto_return: "approved",
          notification_url: "https://us-central1-barbearia-do-ico.cloudfunctions.net/mercadopagoWebhook",
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

          const valorPago = paymentInfo.transaction_amount || COURSE_PRICE;

          await db.collection("enrollments").doc(enrollmentId).update({
            status: "acesso_liberado",
            paymentId,
            valorPago,
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

          // matrícula avulsa (só naquela turma presencial) — já reserva a vaga automaticamente,
          // sem o aluno precisar escolher de novo depois de pagar
          if (enrollment?.turmaAvulsaId) {
            const turmaId = enrollment.turmaAvulsaId;
            const bookingRef = db.collection("turmaBookings").doc(`${enrollmentId}_${turmaId}`);
            const turmaRef = db.collection("turmas").doc(turmaId);
            try {
              await db.runTransaction(async (tx) => {
                const [turmaDoc, bookingDoc] = await Promise.all([tx.get(turmaRef), tx.get(bookingRef)]);
                if (!turmaDoc.exists || bookingDoc.exists) return;
                const turma = turmaDoc.data()!;
                if (turma.vagasOcupadas >= turma.vagasTotal) return; // esgotou entre o clique e o pagamento — caso raro
                tx.update(turmaRef, { vagasOcupadas: turma.vagasOcupadas + 1 });
                tx.set(bookingRef, {
                  enrollmentId,
                  turmaId,
                  presencas: {},
                  bookedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              });
            } catch (e) {
              console.error("Falha ao matricular automaticamente na turma avulsa:", e);
            }
          }
          // Aviso ao aluno é feito manualmente pelo admin via WhatsApp
          // (painel Admin → Alunos → "Copiar link de acesso")
        }
      }

      // Reembolso, estorno ou contestação (chargeback) — revoga o acesso automaticamente
      if (["refunded", "charged_back", "cancelled"].includes(paymentInfo.status || "")) {
        const enrollmentId = paymentInfo.external_reference;
        if (enrollmentId) {
          const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
          if (enrollmentSnap.exists && enrollmentSnap.data()!.status === "acesso_liberado") {
            await db.collection("enrollments").doc(enrollmentId).update({
              status: "bloqueado",
              bloqueioMotivo: `Pagamento ${paymentInfo.status} (revogado automaticamente)`,
              bloqueadoEm: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Acesso revogado automaticamente — matrícula ${enrollmentId}, motivo: ${paymentInfo.status}`);
          }
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
