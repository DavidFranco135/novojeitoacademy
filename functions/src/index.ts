/**
 * Novo Jeito Academy — Firebase Functions
 * Ponto central de exportação de todas as funções do backend.
 */

import * as admin from "firebase-admin";
admin.initializeApp();

export { createEnrollment, signContract, createPaymentPreference, mercadopagoWebhook } from "./enrollment";
export { generateCertificate } from "./certificate";
export {
  createPresencialSession,
  listPresencialSessions,
  bookPresencialSession,
  confirmCheckin,
  listSessionAttendees,
} from "./presencial";
export { uploadImage } from "./imgbb";
export { applyScholarship, listScholarshipApplications } from "./scholarship";
export { getSiteContent, updateSiteContent } from "./siteContent";
export { getStudentProgress, markLessonComplete } from "./progress";
export { listStudents, listTransactions, getOverviewStats } from "./admin";
export { registerLead, listLeads } from "./leads";
