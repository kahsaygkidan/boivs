package dashen.bank.boivs.repository;

import dashen.bank.boivs.domain.BoDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BoDocumentRepository extends JpaRepository<BoDocument, String> {
    List<BoDocument> findByBeneficialOwnerId(String beneficialOwnerId);
}
