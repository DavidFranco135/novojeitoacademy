/**
 * Painel Admin — dados reais (Novo Jeito Academy)
 * Todas as funções aqui exigem estar logado E estar na coleção "admins" do Firestore.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();
const COURSE_PRICE = 497.0;

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
export const listStudents = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const snap = await db.collection("enrollments").where("status", "==", "acesso_liberado").get();

    const students = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data();
        const progressDoc = await db.collection("progress").doc(doc.id).get();
        const percent = progressDoc.exists ? progressDoc.data()!.percent || 0 : 0;
        return {
          id: doc.id,
          nome: data.nome,
          email: data.email,
          pagamento: "Pago",
          progresso: percent,
          matricula: data.paidAt ? data.paidAt.toDate().toLocaleDateString("pt-BR") : "-",
        };
      })
    );

    res.status(200).json({ students });
  } catch (err) {
    console.error("listStudents error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
export const listTransactions = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const snap = await db.collection("enrollments").orderBy("createdAt", "desc").limit(100).get();

    const transactions = snap.docs
      .filter((doc) => doc.data().paymentId || doc.data().status === "contrato_assinado")
      .map((doc) => {
        const data = doc.data();
        const status = data.status === "acesso_liberado" ? "Aprovado" : "Pendente";
        return {
          aluno: data.nome,
          valor: `R$ ${COURSE_PRICE.toFixed(2).replace(".", ",")}`,
          metodo: data.paymentId ? "Mercado Pago" : "-",
          status,
          data: data.paidAt ? data.paidAt.toDate().toLocaleDateString("pt-BR") : data.signedAt ? data.signedAt.toDate().toLocaleDateString("pt-BR") : "-",
        };
      });

    const aprovado = transactions.filter((t) => t.status === "Aprovado").length * COURSE_PRICE;
    const pendente = transactions.filter((t) => t.status === "Pendente").length * COURSE_PRICE;

    res.status(200).json({ transactions, aprovado, pendente });
  } catch (err) {
    console.error("listTransactions error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
export const getOverviewStats = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const [enrollmentsSnap, leadsSnap] = await Promise.all([
      db.collection("enrollments").get(),
      db.collection("leads").get(),
    ]);

    const totalCadastros = enrollmentsSnap.size;
    const totalAlunos = enrollmentsSnap.docs.filter((d) => d.data().status === "acesso_liberado").length;
    const totalLeads = leadsSnap.size;

    const now = new Date();
    const faturamentoMes = enrollmentsSnap.docs
      .filter((d) => {
        const paidAt = d.data().paidAt?.toDate?.();
        return paidAt && paidAt.getMonth() === now.getMonth() && paidAt.getFullYear() === now.getFullYear();
      })
      .length * COURSE_PRICE;

    const conversao = totalCadastros > 0 ? Math.round((totalAlunos / totalCadastros) * 1000) / 10 : 0;

    res.status(200).json({
      leads: totalLeads,
      alunos: totalAlunos,
      faturamento: faturamentoMes,
      conversao,
    });
  } catch (err) {
    console.error("getOverviewStats error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
