import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Configuração do Firebase — preencha com os dados do SEU projeto
 * (Console Firebase → Configurações do projeto → Seus apps → SDK setup)
 */
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEUPROJETO.firebaseapp.com",
  projectId: "SEUPROJETO",
  storageBucket: "SEUPROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
