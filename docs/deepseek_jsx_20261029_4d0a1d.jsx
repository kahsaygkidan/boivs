useEffect(() => {
  if (!legalPersonId || mode !== 'existing') return;
  listLegalPersonDocuments(legalPersonId)
    .then((docs) => {
      // Build a lookup of uploaded docs by docType
      const byType = {};
      docs.forEach((d) => { byType[d.docType] = d; });
      setExistingDocs(byType);
    })
    .catch(() => setExistingDocs({}));
}, [legalPersonId, mode]);