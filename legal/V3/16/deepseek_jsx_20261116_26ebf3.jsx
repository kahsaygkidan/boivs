{renderNav({
  onNext: nextFromCustomer,
  hideBack: true,
  disabled:
    Object.values(legalDocs).reduce((n, arr) => n + (arr?.length || 0), 0) +
    Object.values(existingDocs).reduce((n, arr) => n + (arr?.length || 0), 0) === 0,
})}