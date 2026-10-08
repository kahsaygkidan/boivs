import apiClient from "./client.js";

// -- Legal persons -----------------------------------------------------
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

// -- Documents ------------------------------------------------------------
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
  const res = await apiClient.get(
    `/bo-records/${boId}/documents/${docId}/download`,
    { responseType: "blob" },
  );
  const url = window.URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const deleteDocument = (boId, docId) =>
  apiClient
    .delete(`/bo-records/${boId}/documents/${docId}`)
    .then((r) => r.data);

// Same download endpoint, but returns an in-memory object URL instead of triggering a
// browser download — used to preview images inline (e.g. a lightbox) in RecordDetail.
// The endpoint requires the Authorization header, so a plain <img src="..."> can't hit it
// directly; we fetch the blob through apiClient (which attaches the token) instead.
export const fetchDocumentBlobUrl = async (boId, docId) => {
  const res = await apiClient.get(
    `/bo-records/${boId}/documents/${docId}/download`,
    { responseType: "blob" },
  );
  return {
    url: window.URL.createObjectURL(res.data),
    contentType: res.headers["content-type"],
  };
};

// -- Audit trail ------------------------------------------------------------
export const listAuditLogs = (params = {}) =>
  apiClient.get("/audit-logs", { params }).then((r) => r.data);

// -- Dashboard ------------------------------------------------------------
export const getDashboardStats = () =>
  apiClient.get("/dashboard/stats").then((r) => r.data);

// -- Current user ------------------------------------------------------------
export const getMe = () => apiClient.get("/me").then((r) => r.data);
