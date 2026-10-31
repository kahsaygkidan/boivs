package dashen.bank.boivs.service;

import java.time.Year;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import dashen.bank.boivs.domain.BoSequence;
import dashen.bank.boivs.repository.BoSequenceRepository;

/**
 * Generates BO references in the format BO-<year>-<5 digit sequence>, e.g.
 * BO-2026-00142. Uses a dedicated, row-locked sequence table so it works
 * identically on PostgreSQL and Oracle.
 */
@Component
public class BoReferenceGenerator {

    private final BoSequenceRepository boSequenceRepository;

    public BoReferenceGenerator(BoSequenceRepository boSequenceRepository) {
        this.boSequenceRepository = boSequenceRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String next() {
        int year = Year.now().getValue();
        BoSequence sequence = boSequenceRepository.lockByYear(year).orElseGet(() -> {
            BoSequence s = new BoSequence();
            s.setSeqYear(year);
            s.setLastValue(0);
            return s;
        });
        int nextValue = sequence.getLastValue() + 1;
        sequence.setLastValue(nextValue);
        boSequenceRepository.save(sequence);
        return String.format("BO-%d-%05d", year, nextValue);
    }
}
