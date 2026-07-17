/**
 * Novo Jeito Academy — Firebase Functions
 * Ponto central de exportação de todas as funções do backend.
 */

import * as admin from "firebase-admin";
admin.initializeApp();

export { createEnrollment, signContract, createPaymentPreference, mercadopagoWebhook } from "./enrollment";
export { generateCertificate } from "./certificate";
export {
  createTurma,
  listTurmas,
  joinTurma,
  confirmCheckinTurma,
  listTurmaAttendance,
  getMyTurma,
  adminAssignTurma,
} from "./turmas";
export { uploadImage } from "./imgbb";
export { applyScholarship, listScholarshipApplications, grantScholarship } from "./scholarship";
export { getSiteContent, updateSiteContent } from "./siteContent";
export { getStudentProgress, markLessonComplete } from "./progress";
export { listStudents, listTransactions, getOverviewStats, toggleStudentAccess, resendCertificate, resendContract, resendAccessEmail } from "./admin";
export { registerLead, listLeads } from "./leads";
