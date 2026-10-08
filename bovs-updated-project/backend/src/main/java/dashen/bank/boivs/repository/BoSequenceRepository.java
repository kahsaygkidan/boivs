package dashen.bank.boivs.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import dashen.bank.boivs.domain.BoSequence;
import jakarta.persistence.LockModeType;

public interface BoSequenceRepository extends JpaRepository<BoSequence, Integer> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from BoSequence s where s.seqYear = :year")
    Optional<BoSequence> lockByYear(Integer year);
}
