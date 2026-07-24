import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

/**
 * AuthGuard — protege rotas que exigem login (/aluno) ou admin (/admin)
 *
 * Para /admin: verifica se existe um documento na coleção "admins" do Firestore
 * com ID igual ao UID do usuário logado. SEM PRECISAR DE TERMINAL — dá pra
 * liberar um admin direto pelo Console do Firebase:
 *
 *   1) Firebase Console → Authentication → Users → copie o UID da pessoa
 *      (ela precisa ter feito login pelo menos uma vez antes de ter um UID)
 *   2) Firebase Console → Firestore Database → "Iniciar coleção"
 *   3) ID da coleção: admins
 *   4) ID do documento: cole o UID copiado no passo 1
 *   5) Adicione um campo qualquer, ex: role (string) = admin
 *   6) Salvar — pronto, essa pessoa já pode acessar /admin
 */

const GOLD = "#C58A4A";

export default function AuthGuard({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = carregando
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && requireAdmin) {
        const adminDoc = await getDoc(doc(db, "admins", u.uid));
        setIsAdmin(adminDoc.exists());
      } else {
        setIsAdmin(true); // rota não exige admin
      }
    });
    return unsub;
  }, [requireAdmin]);

  if (user === undefined || (requireAdmin && isAdmin === undefined)) {
    return (
      <div style={styles.page}>
        <p style={styles.p}>Carregando...</p>
      </div>
    );
  }

  if (user === null) {
    window.location.href = requireAdmin ? "/admin-login" : "/login";
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={styles.h2}>Acesso restrito</h2>
          <p style={styles.p}>Sua conta ainda não foi liberada como administrador.</p>
          <p style={{ ...styles.p, fontSize: "0.78rem", color: "#5a5348", marginTop: "1rem" }}>Seu UID: {user.uid}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050505", color: "#F5F0E8", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" },
  card: { border: "1px solid rgba(197,138,74,.22)", borderRadius: 6, padding: "2.4rem", maxWidth: 420, textAlign: "center" },
  h2: { fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", marginBottom: "0.6rem", color: GOLD },
  p: { fontSize: "0.88rem", color: "#9d9384" },
};
