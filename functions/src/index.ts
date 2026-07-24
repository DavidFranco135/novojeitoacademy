/**
 * Novo Jeito Academy — Firebase Functions
 * Ponto central de exportação de todas as funções do backend.
 */

import * as admin from "firebase-admin";
admin.initializeApp();

export { createEnrollment, signContract, createPaymentPreference, mercadopagoWebhook, getEnrollmentForSigning, preferCashPayment } from "./enrollment";
export { generateCertificate, verifyCertificate } from "./certificate";
export {
  createTurma,
  listTurmas,
  joinTurma,
  getLessonCheckinLink,
  confirmLessonCheckin,
  listTurmaAttendance,
  getMyTurma,
  adminAssignTurma,
  getTurmaAvulsa,
  deleteTurma,
} from "./turmas";
export { uploadImage } from "./imgbb";
export { applyScholarship, listScholarshipApplications, grantScholarship, rejectScholarship, deleteScholarship } from "./scholarship";
export { getSiteContent, updateSiteContent } from "./siteContent";
export { getStudentProgress, markLessonComplete } from "./progress";
export { listStudents, getStudentDetail, listTransactions, getOverviewStats, toggleStudentAccess, resendCertificate, resendContract, resendAccessEmail, registerCashPayment, confirmPendingPayment, updateStudent, deleteStudent } from "./admin";
export { getCourseContent, updateCourseContent } from "./courseContent";
export { registerLead, listLeads } from "./leads";
export { generateComprovante } from "./comprovante";
export { getOwnerSignature, saveOwnerSignature } from "./settings";
export {
  createModelo,
  listModelos,
  listMeusModelos,
  agendarAtendimento,
  getAgendaDoDia,
  registrarAtendimento,
  avaliarAtendimento,
  listAtendimentosAdmin,
  listMeusAtendimentos,
  getMinhaCarteira,
} from "./laboratorio";
export { createAviso, listAvisosAdmin, deleteAviso, getMeusAvisos, dispensarAviso } from "./avisos";
