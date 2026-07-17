import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Configuração do Firebase — projeto: barbearia-do-ico
 */
const firebaseConfig = {
  apiKey: "AIzaSyCSr9NKZBjPCCmfHjFSRE8BUlVgy0uWlOg",
  authDomain: "barbearia-do-ico.firebaseapp.com",
  projectId: "barbearia-do-ico",
  storageBucket: "barbearia-do-ico.firebasestorage.app",
  messagingSenderId: "29235892183",
  appId: "1:29235892183:web:598faa7d82b688ee8d0592",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
