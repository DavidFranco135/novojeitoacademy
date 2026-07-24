import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Matricula from "./pages/Matricula";
import Aluno from "./pages/Aluno";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import PresencialBooking from "./pages/PresencialBooking";
import MatriculaResultado from "./pages/MatriculaResultado";
import LessonCheckin from "./pages/LessonCheckin";
import Laboratorio from "./pages/Laboratorio";
import CertificadoVerificacao from "./pages/CertificadoVerificacao";
import AgendaModelos from "./pages/AgendaModelos";
import AuthGuard from "./components/AuthGuard";

/**
 * Rotas do app — Novo Jeito Academy
 *
 * /matricula                 -> fluxo de cadastro + contrato + pagamento (público)
 * /matricula/:status         -> retorno do Mercado Pago (sucesso/erro/pendente)
 * /login                     -> login do ALUNO, sem senha (link mágico por e-mail)
 * /admin-login                -> login da EQUIPE INTERNA, e-mail + senha tradicional
 * /aluno                     -> área do aluno (protegida por login)
 * /aluno/presencial          -> escolha/grade da turma presencial (protegida por login)
 * /aluno/checkin/:token      -> confirma presença no encontro escaneado (protegida por login)
 * /aluno/laboratorio         -> Laboratório Novo Jeito: atendimentos, avaliações, carteira (protegida por login)
 * /certificado/:code         -> verificação pública de certificado (QR do PDF, sem login)
 * /agenda-modelos            -> agenda pública do dia pra recepção/modelos (sem login)
 * /admin                     -> painel administrativo (protegida por login + estar na coleção "admins" do Firestore)
 */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/matricula" replace />} />
        <Route path="/matricula" element={<Matricula />} />
        <Route path="/matricula/:status" element={<MatriculaResultado />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin-login" element={<AdminLogin />} />

        <Route
          path="/aluno"
          element={
            <AuthGuard>
              <Aluno />
            </AuthGuard>
          }
        />
        <Route
          path="/aluno/presencial"
          element={
            <AuthGuard>
              <PresencialBookingPage />
            </AuthGuard>
          }
        />
        <Route
          path="/aluno/checkin/:token"
          element={
            <AuthGuard>
              <LessonCheckin />
            </AuthGuard>
          }
        />
        <Route
          path="/aluno/laboratorio"
          element={
            <AuthGuard>
              <Laboratorio />
            </AuthGuard>
          }
        />

        <Route path="/certificado/:code" element={<CertificadoVerificacao />} />
        <Route path="/agenda-modelos" element={<AgendaModelos />} />

        <Route
          path="/admin"
          element={
            <AuthGuard requireAdmin>
              <Admin />
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

// wrapper temporário até existir o enrollmentId real vindo do login do aluno
function PresencialBookingPage() {
  const enrollmentId = localStorage.getItem("enrollmentId") || "";
  return <PresencialBooking enrollmentId={enrollmentId} />;
}
