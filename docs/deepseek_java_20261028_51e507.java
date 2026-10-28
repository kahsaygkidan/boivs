package dashen.bank.boivs.repo;

import dashen.bank.boivs.domain.LegalPersonDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LegalPersonDocumentRepository extends JpaRepository<LegalPersonDocument, String> {
    List<LegalPersonDocument> findByLegalPersonIdOrderByUploadedAtDesc(String legalPersonId);
}