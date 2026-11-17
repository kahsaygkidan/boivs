
package dashen.bank.boivs.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import dashen.bank.boivs.domain.SeniorManagingOfficial;

public interface SeniorManagingOfficialRepository
        extends JpaRepository<SeniorManagingOfficial, String> {

    @EntityGraph(attributePaths = "legalPerson")
    List<SeniorManagingOfficial>
        findAllByLegalPerson_IdOrderByCreatedAtDesc(String legalPersonId);

    @EntityGraph(attributePaths = "legalPerson")
    Optional<SeniorManagingOfficial>
        findByIdAndLegalPerson_Id(String id, String legalPersonId);

    boolean existsByLegalPerson_IdAndIdNumber(
        String legalPersonId,
        String idNumber
    );
}
