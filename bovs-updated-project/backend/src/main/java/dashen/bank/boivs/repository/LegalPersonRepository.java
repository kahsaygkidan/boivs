package dashen.bank.boivs.repository;

import dashen.bank.boivs.domain.LegalPerson;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LegalPersonRepository extends JpaRepository<LegalPerson, String> {
    Optional<LegalPerson> findByRegistrationNumber(String registrationNumber);
    boolean existsByRegistrationNumber(String registrationNumber);
}
