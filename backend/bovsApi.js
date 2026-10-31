import apiClient from "./client.js";

// -- Legal persons -----------------------------------------------------
// GET /legal-persons accepts: tin (exact match), page, size, sort.
export const listLegalPersons = (params = {}) =>
  apiClient.get("/legal-persons", { params }).then((r) => r.data);

export const createLegalPerson = (payload) =>
  apiClient.post("/legal-persons", payload).then((r) => r.data);

export const updateLegalPersonProfile = (legalPersonId, payload) =>
  apiClient.put(`/legal-persons/${legalPersonId}/profile`, payload).then((r) => r.data);

// -- Ownership structure (multi-layer UBO tracing) ----------------------------
export const getOwnershipTree = (legalPersonId) =>
  apiClient.get(`/legal-persons/${legalPersonId}/ownership-tree`).then((r) => r.data);

export const addOwnershipNode = (legalPersonId, payload) =>
  apiClient.post(`/legal-persons/${legalPersonId}/ownership-nodes`, payload).then((r) => r.data);

export const deleteOwnershipNode = (legalPersonId, nodeId) =>
  apiClient.delete(`/legal-persons/${legalPersonId}/ownership-nodes/${nodeId}`).then((r) => r.data);

export const updateNodeControl = (legalPersonId, nodeId, payload) =>
  apiClient.put(`/legal-persons/${legalPersonId}/ownership-nodes/${nodeId}/control`, payload).then((r) => r.data);

export const saveSeniorManagingOfficial = (legalPersonId, payload) =>
  apiClient.put(`/legal-persons/${legalPersonId}/senior-managing-official`, payload).then((r) => r.data);

// -- Beneficial owner records -------------------------------------------
// GET /bo-records accepts: status, pep, createdBy, q (name / BO reference / phone), page, size, sort.
export const searchBoRecords = (params = {}) =>
  apiClient.get("/bo-records", { params }).then((r) => r.data);

export const getBoRecord = (id) =>
  apiClient.get(`/bo-records/${id}`).then((r) => r.data);

export const createBoRecord = (payload, submit = true) =>
  apiClient.post(`/bo-records?submit=${submit}`, payload).then((r) => r.data);

export const updateBoRecord = (id, payload) =>
  apiClient.put(`/bo-records/${id}`, payload).then((r) => r.data);

export const submitBoRecord = (id) =>
  apiClient.post(`/bo-records/${id}/submit`).then((r) => r.data);

export const getQueue = (params = {}) =>
  apiClient.get("/bo-records/queue", { params }).then((r) => r.data);

export const approveBoRecord = (id) =>
  apiClient.post(`/bo-records/${id}/approve`).then((r) => r.data);

export const rejectBoRecord = (id, reason) =>
  apiClient.post(`/bo-records/${id}/reject`, { reason }).then((r) => r.data);

export const ceaseBoRecord = (id, reason) =>
  apiClient.post(`/bo-records/${id}/cease`, { reason }).then((r) => r.data);

export const removeBoRecord = (id, reason) =>
  apiClient
    .delete(`/bo-records/${id}`, { params: reason ? { reason } : undefined })
    .then((r) => r.data);

/* -------------------------------------------------------------------------
   Shared helpers
   ------------------------------------------------------------------------- */
export function triggerDownload(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

// Returns an in-memory object URL instead of triggering a download — used to preview files inline.
// The endpoints require the Authorization header, so a plain <img src> / <iframe src> can't hit them
// directly; we fetch the blob through apiClient (which attaches the token) instead.
const fetchBlobUrl = async (path) => {
  const res = await apiClient.get(path, { responseType: "blob" });
  return {
    url: window.URL.createObjectURL(res.data),
    contentType: res.headers["content-type"],
  };
};

// -- Beneficial owner documents ------------------------------------------------
export const uploadDocument = (boId, file) => {
  const form = new FormData();
  form.append("file", file);
  return apiClient
    .post(`/bo-records/${boId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const listDocuments = (boId) =>
  apiClient.get(`/bo-records/${boId}/documents`).then((r) => r.data);

export const downloadDocument = async (boId, docId, fileName) => {
  const res = await apiClient.get(`/bo-records/${boId}/documents/${docId}/download`, {
    responseType: "blob",
  });
  triggerDownload(res.data, fileName);
};

export const fetchDocumentBlobUrl = (boId, docId) =>
  fetchBlobUrl(`/bo-records/${boId}/documents/${docId}/download`);

export const deleteDocument = (boId, docId) =>
  apiClient.delete(`/bo-records/${boId}/documents/${docId}`).then((r) => r.data);

// -- Legal person (customer) documents -----------------------------------------
// FIX: these used an undefined `api` object and an extra "/api" prefix; they now use apiClient
// with the same relative paths as every other call in this file.
export const listLegalPersonDocuments = (legalPersonId) =>
  apiClient.get(`/legal-persons/${legalPersonId}/documents`).then((r) => r.data);

export const uploadLegalPersonDocument = (legalPersonId, file, docType) => {
  const form = new FormData();
  form.append("file", file);
  if (docType) form.append("docType", docType);
  return apiClient
    .post(`/legal-persons/${legalPersonId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const downloadLegalPersonDocument = async (legalPersonId, docId, fileName) => {
  const res = await apiClient.get(`/legal-persons/${legalPersonId}/documents/${docId}/download`, {
    responseType: "blob",
  });
  triggerDownload(res.data, fileName);
};

// NEW: preview helper used by RecordDetail's "Legal entity documents" card.
export const fetchLegalPersonDocumentBlobUrl = (legalPersonId, docId) =>
  fetchBlobUrl(`/legal-persons/${legalPersonId}/documents/${docId}/download`);

export const deleteLegalPersonDocument = (legalPersonId, docId) =>
  apiClient.delete(`/legal-persons/${legalPersonId}/documents/${docId}`).then((r) => r.data);

// -- Audit trail ------------------------------------------------------------
export const listAuditLogs = (params = {}) =>
  apiClient.get("/audit-logs", { params }).then((r) => r.data);

// -- Dashboard ------------------------------------------------------------
export const getDashboardStats = () =>
  apiClient.get("/dashboard/stats").then((r) => r.data);

// -- Current user ------------------------------------------------------------
export const getMe = () => apiClient.get("/me").then((r) => r.data);
