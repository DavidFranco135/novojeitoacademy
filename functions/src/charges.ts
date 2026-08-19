/**
 * Cobrança avulsa — Novo Jeito Academy
 *
 * Gera um link de cobrança por um valor específico (adiantamento, entrada, valor
 * cheio, etc.) de duas formas:
 *
 *  - tipo "existente": pra um aluno que JÁ tem matrícula (enrollment) — gera direto
 *    uma preferência de pagamento no Mercado Pago (external_reference "charge_<id>"),
 *    sem mexer no status/valorPago da matrícula original, pra não corromper o
 *    histórico financeiro dela. Serve pra cobrar um valor extra à parte.
 *
 *  - tipo "novo_cadastro" (padrão): pra alguém que AINDA NÃO se cadastrou no site —
 *    gera um link pro fluxo normal de matrícula (/matricula) com o valor já fixado
 *    no Firestore (a pessoa preenche os dados, assina o contrato e paga esse valor
 *    específico pelo Mercado Pago — tudo pelo fluxo já existente). Ver createEnrollment
 *    e createPaymentPreference em enrollment.ts, que leem esse valor pelo chargeId.
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { MercadoPagoConfig, Preference } from "mercadopago";

const db = admin.firestore();
const COURSE_PRICE = 697.0;
const SITE_BASE = "https://portal.novojeitobarbearia.com.br";

const MERCADOPAGO_ACCESS_TOKEN = defineSecret("MERCADOPAGO_ACCESS_TOKEN");

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
// Cria a cobrança avulsa (existente -> Mercado Pago direto / novo_cadastro -> link de matrícula)
// ============================================================
export const createCharge = onRequest(
  { cors: true, secrets: [MERCADOPAGO_ACCESS_TOKEN] },
  async (req, res) => {
    try {
      if (!(await verificarAdmin(req))) {
        res.status(403).json({ error: "Acesso negado" });
        return;
      }

      const { enrollmentId, nome, telefone, descricao, valor } = req.body;
      const valorNumerico = Number(valor);
      if (!valorNumerico || valorNumerico <= 0) {
        res.status(400).json({ error: "Informe um valor válido" });
        return;
      }

      // ---- tipo "existente": aluno já cadastrado, escolhido pelo admin ----
      if (enrollmentId) {
        const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
        if (!enrollmentSnap.exists) {
          res.status(404).json({ error: "Aluno não encontrado" });
          return;
        }
        const enrollment = enrollmentSnap.data()!;

        const chargeRef = await db.collection("charges").add({
          tipo: "existente",
          enrollmentId,
          nome: enrollment.nome,
          telefone: enrollment.telefone || null,
          descricao: descricao || null,
          valor: valorNumerico,
          status: "pendente",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN.value() });
        const preference = new Preference(client);
        const result = await preference.create({
          body: {
            items: [
              {
                id: chargeRef.id,
                title: descricao || "Novo Jeito Academy",
                quantity: 1,
                unit_price: valorNumerico,
                currency_id: "BRL",
              },
            ],
            payer: { name: enrollment.nome, email: enrollment.email || undefined },
            external_reference: `charge_${chargeRef.id}`,
            back_urls: {
              success: `${SITE_BASE}/cobranca/sucesso`,
              failure: `${SITE_BASE}/cobranca/erro`,
              pending: `${SITE_BASE}/cobranca/pendente`,
            },
            auto_return: "approved",
            notification_url: "https://us-central1-barbearia-do-ico.cloudfunctions.net/mercadopagoWebhook",
          },
        });

        await chargeRef.update({ preferenceId: result.id || null, checkoutUrl: result.init_point || null });
        res.status(200).json({ chargeId: chargeRef.id, checkoutUrl: result.init_point });
        return;
      }

      // ---- tipo "novo_cadastro": ainda não é aluno — vai fazer o cadastro completo ----
      const chargeRef = await db.collection("charges").add({
        tipo: "novo_cadastro",
        enrollmentId: null,
        nome: nome || null,
        telefone: telefone || null,
        descricao: descricao || null,
        valor: valorNumerico,
        status: "pendente",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const params = new URLSearchParams({ chargeId: chargeRef.id });
      if (nome) params.set("nome", nome);
      if (telefone) params.set("telefone", telefone);
      const checkoutUrl = `${SITE_BASE}/matricula?${params.toString()}`;

      await chargeRef.update({ checkoutUrl });
      res.status(200).json({ chargeId: chargeRef.id, checkoutUrl });
    } catch (err) {
      console.error("createCharge error:", err);
      res.status(500).json({ error: "Erro ao gerar link de cobrança" });
    }
  }
);

// ============================================================
// Lista as cobranças avulsas mais recentes, pro admin acompanhar
// ============================================================
export const listCharges = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const snap = await db.collection("charges").orderBy("createdAt", "desc").limit(100).get();

    const charges = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data();
        let nome = data.nome || "-";
        let status = data.status === "pago" ? "Pago" : data.status === "cancelado" ? "Cancelado" : "Pendente";
        let valorPago = data.valorPago || null;

        // pra cobrança do tipo "novo_cadastro" já vinculada a uma matrícula, o status
        // de verdade é o da matrícula (ela pode estar só cadastrada, com contrato
        // assinado aguardando pagamento, ou já paga) — não o "pendente" fixo da cobrança
        let enrollmentId: string | null = data.enrollmentId || null;
        if (data.tipo === "novo_cadastro" && !enrollmentId) {
          // fallback de segurança: se por algum motivo o vínculo direto na cobrança
          // não foi gravado (ex: falha de rede num passo que não bloqueia a matrícula
          // em si), busca pela matrícula que aponta pra essa cobrança mesmo assim —
          // assim o status nunca fica "preso" em "aguardando cadastro" por engano.
          const fallbackSnap = await db.collection("enrollments").where("chargeId", "==", doc.id).limit(1).get();
          if (!fallbackSnap.empty) enrollmentId = fallbackSnap.docs[0].id;
        }
        if (data.tipo === "novo_cadastro" && enrollmentId) {
          const enrollmentSnap = await db.collection("enrollments").doc(enrollmentId).get();
          if (enrollmentSnap.exists) {
            const enrollment = enrollmentSnap.data()!;
            nome = enrollment.nome || nome;
            if (enrollment.status === "acesso_liberado") {
              status = "Pago";
              valorPago = enrollment.valorPago || data.valor;
            } else if (enrollment.status === "contrato_assinado") {
              status = "Aguardando pagamento";
            } else if (enrollment.status === "cadastrado") {
              status = "Cadastro iniciado";
            } else if (enrollment.status === "bloqueado") {
              status = "Bloqueado";
            }
          }
        } else if (data.tipo === "novo_cadastro" && !enrollmentId && data.status === "pendente") {
          status = "Aguardando cadastro";
        }

        return {
          id: doc.id,
          tipo: data.tipo === "existente" ? "Aluno cadastrado" : "Novo cadastro",
          nome,
          telefone: data.telefone || "-",
          descricao: data.descricao || "-",
          valor: data.valor || 0,
          valorPago,
          status,
          statusBruto: data.status,
          enrollmentId,
          checkoutUrl: data.checkoutUrl || null,
          criadaEm: data.createdAt ? data.createdAt.toDate().toLocaleDateString("pt-BR") : "-",
        };
      })
    );

    res.status(200).json({ charges, valorPadrao: COURSE_PRICE });
  } catch (err) {
    console.error("listCharges error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Cancela uma cobrança pendente (só remove da lista de acompanhamento —
// não afeta o link já gerado, que expira sozinho no Mercado Pago)
// ============================================================
export const cancelCharge = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { chargeId } = req.body;
    if (!chargeId) {
      res.status(400).json({ error: "chargeId obrigatório" });
      return;
    }

    const chargeSnap = await db.collection("charges").doc(chargeId).get();
    if (!chargeSnap.exists) {
      res.status(404).json({ error: "Cobrança não encontrada" });
      return;
    }
    const charge = chargeSnap.data()!;
    if (charge.status === "pago") {
      res.status(400).json({ error: "Essa cobrança já foi paga — não é possível cancelar." });
      return;
    }
    if (charge.tipo === "novo_cadastro" && charge.enrollmentId) {
      res.status(400).json({ error: "Essa pessoa já começou o cadastro — não é possível cancelar mais." });
      return;
    }

    await chargeSnap.ref.update({ status: "cancelado" });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("cancelCharge error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
