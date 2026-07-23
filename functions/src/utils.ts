/**
 * Utilitário compartilhado — Novo Jeito Academy
 */

// Bucket próprio (fora do bucket padrão "barbearia-do-ico...") pra que os links
// assinados de contrato/comprovante/certificado mostrem "novojeitoacademy" em vez
// de "barbearia-do-ico" na URL.
export const DOCS_BUCKET = "novojeitoacademy-docs";

/**
 * Reescreve o link de login gerado pelo Firebase (que aponta primeiro pro domínio
 * genérico "SEU-PROJETO.firebaseapp.com/__/auth/action") pra apontar DIRETO pro
 * nosso próprio domínio, mantendo os mesmos parâmetros (apiKey, oobCode, mode, etc).
 *
 * O Firebase SDK client-side (isSignInWithEmailLink / signInWithEmailLink) não
 * exige que o link esteja hospedado em nenhum domínio específico — ele só lê os
 * parâmetros da URL atual. Então é seguro trocar só o domínio, sem perder nada.
 */
export function toBrandedLoginLink(firebaseLink: string): string {
  try {
    const url = new URL(firebaseLink);
    return `https://novojeitoapp.pages.dev/login${url.search}`;
  } catch {
    return firebaseLink; // se algo der errado, devolve o link original (nunca quebra o fluxo)
  }
}
