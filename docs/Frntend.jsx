/* -------------------------------------------------------------------------
   Legal person documents api
   ------------------------------------------------------------------------- */

export async function listLegalPersonDocuments(legalPersonId) {
  const res = await api.get(`/api/legal-persons/${legalPersonId}/documents`);
  return res.data;
}

export async function uploadLegalPersonDocument(legalPersonId, file, docType) {
  const form = new FormData();
  form.append('file', file);
  if (docType) form.append('docType', docType);
  const res = await api.post(`/api/legal-persons/${legalPersonId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function downloadLegalPersonDocument(legalPersonId, docId, fileName) {
  const res = await api.get(`/api/legal-persons/${legalPersonId}/documents/${docId}/download`, {
    responseType: 'blob',
  });
  triggerDownload(res.data, fileName);
}

export async function deleteLegalPersonDocument(legalPersonId, docId) {
  await api.delete(`/api/legal-persons/${legalPersonId}/documents/${docId}`);
}

/* Shared helper */
function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document';
  a.click();
  URL.revokeObjectURL(url);
}

≈==registration
/* Map client-side docKey → backend LegalDocType */
const DOC_KEY_TO_TYPE = {
  moa: 'MOA',
  aoa: 'AOA',
  commercialRegistration: 'COMMERCIAL_REGISTRATION',
  businessLicense: 'BUSINESS_LICENSE',
  tinCertificate: 'TIN_CERTIFICATE',
  shareholderRegister: 'SHAREHOLDER_REGISTER',
  boardResolution: 'BOARD_RESOLUTION',
  minutes: 'MINUTES',
  foreignHomeDoc: 'FOREIGN_HOME_DOCUMENT',
};

for (const [docKey, file] of Object.entries(legalDocs)) {
  if (!file) continue;
  try {
    await uploadLegalPersonDocument(legalPersonId, file, DOC_KEY_TO_TYPE[docKey] || 'OTHER');
  } catch (e) {
    console.warn('Legal doc upload failed', docKey, e);
  }
}



