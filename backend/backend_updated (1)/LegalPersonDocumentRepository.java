package dashen.bank.boivs.repository;

import dashen.bank.boivs.domain.LegalPersonDocument;
import dashen.bank.boivs.domain.enums.LegalDocType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LegalPersonDocumentRepository extends JpaRepository<LegalPersonDocument, String> {
    List<LegalPersonDocument> findByLegalPersonIdOrderByUploadedAtDesc(String legalPersonId);

    boolean existsByLegalPersonIdAndDocType(String legalPersonId, LegalDocType docType);
}