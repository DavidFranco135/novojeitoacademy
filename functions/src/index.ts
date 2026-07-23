/**
 * Novo Jeito Academy — Firebase Functions
 * Ponto central de exportação de todas as funções do backend.
 */

import * as admin from "firebase-admin";
admin.initializeApp();

export { createEnrollment, signContract, createPaymentPreference, mercadopagoWebhook, getEnrollmentForSigning } from "./enrollment";
export { generateCertificate } from "./certificate";
export {
  createTurma,
  listTurmas,
  joinTurma,
  confirmCheckinTurma,
  listTurmaAttendance,
  getMyTurma,
  adminAssignTurma,
  getTurmaAvulsa,
} from "./turmas";
export { uploadImage } from "./imgbb";
export { applyScholarship, listScholarshipApplications, grantScholarship, rejectScholarship, deleteScholarship } from "./scholarship";
export { getSiteContent, updateSiteContent } from "./siteContent";
export { getStudentProgress, markLessonComplete } from "./progress";
export { listStudents, listTransactions, getOverviewStats, toggleStudentAccess, resendCertificate, resendContract, resendAccessEmail, registerCashPayment, updateStudent, deleteStudent } from "./admin";
export { getCourseContent, updateCourseContent } from "./courseContent";
export { registerLead, listLeads } from "./leads";
export { generateComprovante } from "./comprovante";
