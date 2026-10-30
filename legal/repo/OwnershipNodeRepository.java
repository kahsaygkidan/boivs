package dashen.bank.boivs.repository;

import dashen.bank.boivs.domain.OwnershipNode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OwnershipNodeRepository extends JpaRepository<OwnershipNode, String> {
    List<OwnershipNode> findByLegalPersonIdOrderByCreatedAtAsc(String legalPersonId);
}