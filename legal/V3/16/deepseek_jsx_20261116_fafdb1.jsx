{Object.values(legalDocs).reduce((n, arr) => n + (arr?.length || 0), 0) === 0 &&
 Object.values(existingDocs).reduce((n, arr) => n + (arr?.length || 0), 0) === 0 && (
  <FieldError msg="At least one supporting document is required." />
)}