/**
 * Painel Admin — dados reais (Novo Jeito Academy)
 * Todas as funções aqui exigem estar logado E estar na coleção "admins" do Firestore.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { generateCertificateForEnrollment } from "./certificate";
import { toBrandedLoginLink } from "./utils";

const db = admin.firestore();
const COURSE_PRICE = 697.0;

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

    // mostra os com acesso liberado, os bloqueados (pra poder desbloquear) e também
    // os cadastrados que ainda não assinaram o contrato (pra não "perder" o cadastro
    // criado pelo admin ou pelo aluno até ele terminar de assinar)
    const snap = await db
      .collection("enrollments")
      .where("status", "in", ["acesso_liberado", "bloqueado", "cadastrado", "contrato_assinado"])
      .get();

    const students = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data();
        const pendente = data.status === "cadastrado" || data.status === "contrato_assinado";
        const progressDoc = await db.collection("progress").doc(doc.id).get();
        const percent = progressDoc.exists ? progressDoc.data()!.percent || 0 : 0;
        const dataMatricula = data.paidAt || data.createdAt;
        return {
          id: doc.id,
          nome: data.nome,
          email: data.email,
          telefone: data.telefone || "",
          cpf: data.cpf || "",
          rg: data.rg || "",
          dataNascimento: data.dataNascimento || "",
          endereco: data.endereco || "",
          cidade: data.cidade || "",
          pagamento: data.status === "bloqueado" ? "Bloqueado" : pendente ? "Pendente" : "Pago",
          bloqueado: data.status === "bloqueado",
          pendente,
          aguardandoPagamento: data.status === "contrato_assinado",
          preferePagamentoDinheiro: data.preferePagamentoDinheiro || false,
          bloqueioMotivo: data.bloqueioMotivo || null,
          progresso: percent,
          matricula: dataMatricula ? dataMatricula.toDate().toLocaleDateString("pt-BR") : "-",
          contractUrl: data.contractUrl || null,
          certificateUrl: data.certificateUrl || null,
          certificateCode: data.certificateCode || null,
          certificateIssuedAt: data.certificateIssuedAt ? data.certificateIssuedAt.toDate().toLocaleDateString("pt-BR") : null,
          modulosAplicaveis: data.modulosAplicaveis || null,
          comprovanteUrl: data.comprovanteUrl || null,
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
// Detalhe de UM aluno pro admin: quais aulas em vídeo já concluiu + a turma
// presencial em que está matriculado (se houver) com a presença por encontro.
// ============================================================
export const getStudentDetail = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const enrollmentId = (req.query.enrollmentId as string) || req.body?.enrollmentId;
    if (!enrollmentId) {
      res.status(400).json({ error: "enrollmentId obrigatório" });
      return;
    }

    const [progressSnap, bookingsSnap] = await Promise.all([
      db.collection("progress").doc(enrollmentId).get(),
      db.collection("turmaBookings").where("enrollmentId", "==", enrollmentId).get(),
    ]);

    const progress = progressSnap.exists ? progressSnap.data()! : { completedLessons: [], percent: 0 };

    let turma: any = null;
    let presencas: Record<string, boolean> = {};
    if (!bookingsSnap.empty) {
      const booking = bookingsSnap.docs[0].data();
      presencas = booking.presencas || {};
      const turmaSnap = await db.collection("turmas").doc(booking.turmaId).get();
      if (turmaSnap.exists) {
        turma = { id: turmaSnap.id, nome: turmaSnap.data()!.nome, encontros: turmaSnap.data()!.encontros || [] };
      }
    }

    res.status(200).json({
      completedLessons: progress.completedLessons || [],
      percent: progress.percent || 0,
      turma,
      presencas,
    });
  } catch (err) {
    console.error("getStudentDetail error:", err);
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
      .filter((doc) => doc.data().paymentId || doc.data().paymentMethod === "dinheiro" || doc.data().status === "contrato_assinado")
      .map((doc) => {
        const data = doc.data();
        const valorPago = data.valorPago || COURSE_PRICE;
        const status = data.status === "acesso_liberado" ? "Aprovado" : "Pendente";
        const metodo = data.paymentMethod === "dinheiro" ? "Dinheiro" : data.paymentId ? "Mercado Pago" : "-";
        return {
          aluno: data.nome,
          valor: `R$ ${valorPago.toFixed(2).replace(".", ",")}`,
          valorNumerico: valorPago,
          metodo,
          status,
          data: data.paidAt ? data.paidAt.toDate().toLocaleDateString("pt-BR") : data.signedAt ? data.signedAt.toDate().toLocaleDateString("pt-BR") : "-",
        };
      });

    const aprovado = transactions.filter((t) => t.status === "Aprovado").reduce((sum, t) => sum + t.valorNumerico, 0);
    const pendente = transactions.filter((t) => t.status === "Pendente").reduce((sum, t) => sum + t.valorNumerico, 0);

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
        if (d.data().isBolsa) return false; // bolsa é gratuita, não entra no faturamento
        const paidAt = d.data().paidAt?.toDate?.();
        return paidAt && paidAt.getMonth() === now.getMonth() && paidAt.getFullYear() === now.getFullYear();
      })
      .reduce((sum, d) => sum + (d.data().valorPago || COURSE_PRICE), 0);

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

// ============================================================
// Bloquear / desbloquear o acesso de um aluno específico
// ============================================================
export const toggleStudentAccess = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { enrollmentId, blocked } = req.body;
    if (!enrollmentId || typeof blocked !== "boolean") {
      res.status(400).json({ error: "enrollmentId e blocked são obrigatórios" });
      return;
    }

    await db.collection("enrollments").doc(enrollmentId).update({
      status: blocked ? "bloqueado" : "acesso_liberado",
      bloqueioMotivo: blocked ? "Bloqueado manualmente pelo admin" : admin.firestore.FieldValue.delete(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("toggleStudentAccess error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Gera (se precisar) e retorna o link do certificado, pra admin copiar e mandar por WhatsApp
// ============================================================
export const resendCertificate = onRequest({ cors: true }, async (req, res) => {
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

    let certificateUrl = enrollment.certificateUrl;
    if (!certificateUrl) {
      const result = await generateCertificateForEnrollment(enrollmentId);
      if ("error" in result) {
        res.status(403).json({ error: `Certificado ainda não pode ser emitido: ${result.error}` });
        return;
      }
      certificateUrl = result.certificateUrl;
    }

    res.status(200).json({ ok: true, certificateUrl });
  } catch (err) {
    console.error("resendCertificate error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Retorna o link do contrato assinado, pra admin copiar e mandar por WhatsApp
// ============================================================
export const resendContract = onRequest({ cors: true }, async (req, res) => {
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

    if (!enrollment.contractUrl) {
      res.status(404).json({ error: "Esse aluno ainda não tem contrato assinado" });
      return;
    }

    res.status(200).json({ ok: true, contractUrl: enrollment.contractUrl });
  } catch (err) {
    console.error("resendContract error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Gera o link mágico de login, pra admin copiar e mandar por WhatsApp
// ============================================================
export const resendAccessEmail = onRequest({ cors: true }, async (req, res) => {
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

    const rawLink = await admin.auth().generateSignInWithEmailLink(enrollment.email, {
      url: "https://portal.novojeitobarbearia.com.br/login",
      handleCodeInApp: true,
    });
    const loginLink = toBrandedLoginLink(rawLink);
    console.log("DIAGNOSTICO resendAccessEmail — rawLink:", rawLink);
    console.log("DIAGNOSTICO resendAccessEmail — loginLink:", loginLink);

    res.status(200).json({ ok: true, loginLink });
  } catch (err) {
    console.error("resendAccessEmail error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Registrar matrícula paga em dinheiro (fora do Mercado Pago) — NÃO cria mais a
// conta direto. Gera um link de /matricula em modo dinheiro pro aluno preencher
// os dados e assinar o contrato de verdade; o acesso só é liberado depois disso
// (signContract cuida disso quando paymentMethod === "dinheiro").
// ============================================================
export const registerCashPayment = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { nome, telefone, valor } = req.body;
    if (!nome || !telefone) {
      res.status(400).json({ error: "nome e telefone são obrigatórios" });
      return;
    }

    const params = new URLSearchParams({
      dinheiro: "1",
      nome,
      telefone,
      valor: String(valor || COURSE_PRICE),
    });
    const matriculaLink = `https://portal.novojeitobarbearia.com.br/matricula?${params.toString()}`;

    res.status(200).json({ matriculaLink });
  } catch (err) {
    console.error("registerCashPayment error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Confirma manualmente o pagamento de um aluno que JÁ assinou o contrato pelo
// fluxo normal (modo "pago") e estava esperando o Mercado Pago — usado quando
// ele decide pagar em dinheiro depois de já ter chegado na tela de pagamento.
// Faz o mesmo que o webhook do Mercado Pago faz num pagamento aprovado: libera
// o acesso, cria o login e gera o link mágico — só que sem passar pelo MP.
// ============================================================
export const confirmPendingPayment = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { enrollmentId, valorPago } = req.body;
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

    if (enrollment.status === "acesso_liberado") {
      res.status(400).json({ error: "Esse aluno já está com o acesso liberado." });
      return;
    }
    if (enrollment.status !== "contrato_assinado") {
      res.status(400).json({ error: "Esse aluno ainda não assinou o contrato — envie o link de assinatura antes." });
      return;
    }

    await db.collection("enrollments").doc(enrollmentId).update({
      status: "acesso_liberado",
      paymentMethod: "dinheiro",
      valorPago: Number(valorPago) || COURSE_PRICE,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      await admin.auth().createUser({ email: enrollment.email, displayName: enrollment.nome });
    } catch (e: any) {
      if (e.code !== "auth/email-already-exists") throw e;
    }

    let loginLink: string | null = null;
    try {
      const rawLink = await admin.auth().generateSignInWithEmailLink(enrollment.email, {
        url: "https://portal.novojeitobarbearia.com.br/login",
        handleCodeInApp: true,
      });
      loginLink = toBrandedLoginLink(rawLink);
    } catch (e) {
      console.error("confirmPendingPayment: falha ao gerar link de login", e);
    }

    res.status(200).json({ ok: true, loginLink });
  } catch (err) {
    console.error("confirmPendingPayment error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Editar os dados de um aluno (nome, e-mail, telefone, CPF)
// ============================================================
export const updateStudent = onRequest({ cors: true }, async (req, res) => {
  try {
    if (!(await verificarAdmin(req))) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const { enrollmentId, nome, email, telefone, cpf, rg, dataNascimento, endereco, cidade, modulosAplicaveis } = req.body;
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

    const updates: Record<string, any> = {};
    if (nome) updates.nome = nome;
    if (telefone) updates.telefone = telefone;
    if (cpf) updates.cpf = cpf;
    if (rg) updates.rg = rg;
    if (dataNascimento) updates.dataNascimento = dataNascimento;
    if (endereco) updates.endereco = endereco;
    if (cidade) updates.cidade = cidade;
    // lista vazia/ausente = todos os módulos se aplicam (sem restrição)
    if (Array.isArray(modulosAplicaveis)) {
      updates.modulosAplicaveis = modulosAplicaveis.length > 0 ? modulosAplicaveis : admin.firestore.FieldValue.delete();
    }

    // se o e-mail mudou, atualiza também no Firebase Auth (é ele quem faz o login)
    if (email && email !== enrollment.email) {
      try {
        const userRecord = await admin.auth().getUserByEmail(enrollment.email);
        await admin.auth().updateUser(userRecord.uid, { email, displayName: nome || enrollment.nome });
      } catch (e: any) {
        if (e.code !== "auth/user-not-found") throw e; // se o aluno ainda não tinha login criado, só ignora
      }
      updates.email = email;
    }

    await db.collection("enrollments").doc(enrollmentId).update(updates);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("updateStudent error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================
// Excluir um aluno por completo (matrícula, progresso, turmas, login)
// ============================================================
export const deleteStudent = onRequest({ cors: true }, async (req, res) => {
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

    // libera as vagas de qualquer turma em que esse aluno estivesse matriculado
    const bookingsSnap = await db.collection("turmaBookings").where("enrollmentId", "==", enrollmentId).get();
    for (const bookingDoc of bookingsSnap.docs) {
      const booking = bookingDoc.data();
      const turmaRef = db.collection("turmas").doc(booking.turmaId);
      const turmaDoc = await turmaRef.get();
      if (turmaDoc.exists) {
        await turmaRef.update({ vagasOcupadas: Math.max(0, turmaDoc.data()!.vagasOcupadas - 1) });
      }
      await bookingDoc.ref.delete();
    }

    // remove o progresso salvo
    await db.collection("progress").doc(enrollmentId).delete().catch(() => {});

    // remove o login do Firebase Auth, se existir
    if (enrollment.email) {
      try {
        const userRecord = await admin.auth().getUserByEmail(enrollment.email);
        await admin.auth().deleteUser(userRecord.uid);
      } catch (e: any) {
        if (e.code !== "auth/user-not-found") throw e;
      }
    }

    // por fim, remove a matrícula
    await db.collection("enrollments").doc(enrollmentId).delete();

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("deleteStudent error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});
