package dashen.bank.boivs.service;

import dashen.bank.boivs.domain.LegalPerson;
import dashen.bank.boivs.domain.enums.AuditAction;
import dashen.bank.boivs.dto.LegalPersonProfileRequest;
import dashen.bank.boivs.dto.LegalPersonRequest;
import dashen.bank.boivs.exception.ConflictException;
import dashen.bank.boivs.exception.NotFoundException;
import dashen.bank.boivs.repository.LegalPersonRepository;
import dashen.bank.boivs.security.CurrentUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LegalPersonService {

    private final LegalPersonRepository legalPersonRepository;
    private final CurrentUser currentUser;
    private final AuditService auditService;

    public LegalPersonService(LegalPersonRepository legalPersonRepository, CurrentUser currentUser, AuditService auditService) {
        this.legalPersonRepository = legalPersonRepository;
        this.currentUser = currentUser;
        this.auditService = auditService;
    }

    @Transactional
    public LegalPerson create(LegalPersonRequest request) {
        if (legalPersonRepository.existsByRegistrationNumber(request.registrationNumber())) {
            throw new ConflictException("A legal person with this registration number already exists");
        }
        LegalPerson lp = new LegalPerson();
        lp.setName(request.name());
        lp.setRegistrationNumber(request.registrationNumber());
        lp.setEntityType(request.entityType());
        lp.setTin(request.tin());
        lp.setCountryOfIncorporation(request.countryOfIncorporation());
        lp.setSector(request.sector());
        lp.setDirectorsAndManagement(request.directorsAndManagement());
        lp.setCreatedBy(currentUser.username());
        LegalPerson saved = legalPersonRepository.save(lp);
        auditService.record("LEGAL_PERSON", saved.getRegistrationNumber(), AuditAction.LEGAL_PERSON_CREATED,
                "Registered legal person '" + saved.getName() + "'");
        return saved;
    }

    /** Updates the customer KYC profile (TIN, country, sector, directors / senior management). */
    @Transactional
    public LegalPerson updateProfile(String id, LegalPersonProfileRequest request) {
        LegalPerson lp = getById(id);
        lp.setTin(request.tin());
        lp.setCountryOfIncorporation(request.countryOfIncorporation());
        lp.setSector(request.sector());
        lp.setDirectorsAndManagement(request.directorsAndManagement());
        LegalPerson saved = legalPersonRepository.save(lp);
        auditService.record("LEGAL_PERSON", saved.getRegistrationNumber(), AuditAction.LEGAL_PERSON_UPDATED,
                "Updated KYC profile of '" + saved.getName() + "'");
        return saved;
    }

    @Transactional(readOnly = true)
    public Page<LegalPerson> findAll(Pageable pageable) {
        return legalPersonRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public LegalPerson getById(String id) {
        return legalPersonRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Legal person not found: " + id));
    }
}