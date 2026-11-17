
package dashen.bank.boivs.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import dashen.bank.boivs.domain.LegalPerson;
import dashen.bank.boivs.domain.SeniorManagingOfficial;
import dashen.bank.boivs.domain.enums.IdDocumentType;
import dashen.bank.boivs.domain.enums.VerificationStatus;
import dashen.bank.boivs.dto.SeniorManagingOfficialRequest;
import dashen.bank.boivs.dto.SeniorManagingOfficialResponse;
import dashen.bank.boivs.repository.LegalPersonRepository;
import dashen.bank.boivs.repository.SeniorManagingOfficialRepository;

import jakarta.persistence.EntityNotFoundException;

@Service
@Transactional
public class SeniorManagingOfficialService {

    private final SeniorManagingOfficialRepository repository;
    private final LegalPersonRepository legalPersonRepository;

    public SeniorManagingOfficialService(
            SeniorManagingOfficialRepository repository,
            LegalPersonRepository legalPersonRepository) {
        this.repository = repository;
        this.legalPersonRepository = legalPersonRepository;
    }

    @Transactional(readOnly = true)
    public List<SeniorManagingOfficialResponse> findAll(String legalPersonId) {

        ensureLegalPersonExists(legalPersonId);

        return repository
                .findAllByLegalPerson_IdOrderByCreatedAtDesc(legalPersonId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SeniorManagingOfficialResponse findById(
            String legalPersonId,
            String officialId) {

        return toResponse(findOfficial(legalPersonId, officialId));
    }

    public SeniorManagingOfficialResponse create(
            String legalPersonId,
            SeniorManagingOfficialRequest request) {

        validateRequest(request);
        validateDuplicateIdentity(legalPersonId, request.idNumber(), null);

        LegalPerson legalPerson = ensureLegalPersonExists(legalPersonId);

        SeniorManagingOfficial official = new SeniorManagingOfficial();

        official.setLegalPerson(legalPerson);
        applyRequest(official, request);

        official.setIdVerificationStatus(null);
        official.setCreatedBy(currentUsername());

        return toResponse(repository.save(official));
    }

    public SeniorManagingOfficialResponse update(
            String legalPersonId,
            String officialId,
            SeniorManagingOfficialRequest request) {

        validateRequest(request);
        validateDuplicateIdentity(legalPersonId, request.idNumber(), officialId);

        SeniorManagingOfficial official =
                findOfficial(legalPersonId, officialId);

        applyRequest(official, request);

        /*
         * A change to identity information requires re-verification.
         * Do not retain an old VERIFIED status after changing the ID.
         */
        official.setIdVerificationStatus(null);
        official.setUpdatedBy(currentUsername());

        return toResponse(repository.save(official));
    }

    public void delete(String legalPersonId, String officialId) {

        SeniorManagingOfficial official =
                findOfficial(legalPersonId, officialId);

        repository.delete(official);
    }

    /**
     * Called by the authorized verification workflow.
     * Protect this operation using your actual checker/admin authorities.
     */
    public SeniorManagingOfficialResponse updateVerification(
            String legalPersonId,
            String officialId,
            VerificationStatus status,
            String notes) {

        if (status == null) {
            throw new IllegalArgumentException(
                    "Verification status is required."
            );
        }

        SeniorManagingOfficial official =
                findOfficial(legalPersonId, officialId);

        official.setIdVerificationStatus(status);
        official.setVerificationNotes(notes);
        official.setUpdatedBy(currentUsername());

        return toResponse(repository.save(official));
    }

    private void applyRequest(
            SeniorManagingOfficial official,
            SeniorManagingOfficialRequest request) {

        official.setFullName(request.fullName().trim());
        official.setDateOfBirth(request.dateOfBirth());
        official.setNationality(request.nationality().trim());
        official.setGender(request.gender());
        official.setPhoneNumber(request.phoneNumber().trim());
        official.setIdDocumentType(request.idDocumentType());
        official.setIdNumber(request.idNumber().trim());
        official.setCountryOfIssue(request.countryOfIssue().trim());
        official.setDateOfIssue(request.dateOfIssue());
        official.setDateOfExpiry(request.dateOfExpiry());
        official.setPosition(request.position().trim());
        official.setJustification(request.justification().trim());
        official.setVerificationNotes(request.verificationNotes());
    }

    private void validateRequest(SeniorManagingOfficialRequest request) {

        validateIdentityDocument(
                request.nationality(),
                request.idDocumentType()
        );

        if (!request.dateOfExpiry().isAfter(request.dateOfIssue())) {
            throw new IllegalArgumentException(
                    "Document expiry date must be after its issue date."
            );
        }

        if (!request.dateOfBirth().isBefore(LocalDate.now())) {
            throw new IllegalArgumentException(
                    "Date of birth must be in the past."
            );
        }

        if (request.dateOfIssue().isBefore(request.dateOfBirth())) {
            throw new IllegalArgumentException(
                    "Document issue date cannot be before date of birth."
            );
        }
    }

    private void validateIdentityDocument(
            String nationality,
            IdDocumentType documentType) {

        boolean ethiopian = isEthiopianNationality(nationality);

        if (ethiopian && documentType != IdDocumentType.FAYDA_ID) {
            throw new IllegalArgumentException(
                    "Ethiopian nationals must provide a Fayda ID."
            );
        }

        if (!ethiopian && documentType != IdDocumentType.PASSPORT) {
            throw new IllegalArgumentException(
                    "Non-Ethiopian nationals must provide a passport."
            );
        }
    }

    private boolean isEthiopianNationality(String nationality) {

        if (nationality == null) {
            return false;
        }

        String normalized = nationality
                .trim()
                .replaceAll("[^a-zA-Z]", "")
                .toUpperCase();

        return normalized.equals("ETHIOPIAN")
                || normalized.equals("ETHIOPIA")
                || normalized.equals("ET");
    }

    private void validateDuplicateIdentity(
            String legalPersonId,
            String idNumber,
            String currentOfficialId) {

        boolean duplicate;

        if (currentOfficialId == null) {
            duplicate = repository.existsByLegalPerson_IdAndIdNumber(
                    legalPersonId,
                    idNumber.trim()
            );
        } else {
            duplicate = repository
                    .existsByLegalPerson_IdAndIdNumberAndIdNot(
                            legalPersonId,
                            idNumber.trim(),
                            currentOfficialId
                    );
        }

        if (duplicate) {
            throw new IllegalArgumentException(
                    "This identity document is already registered "
                    + "for this legal person."
            );
        }
    }

    private LegalPerson ensureLegalPersonExists(String legalPersonId) {

        return legalPersonRepository.findById(legalPersonId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Legal person not found: " + legalPersonId
                ));
    }

    private SeniorManagingOfficial findOfficial(
            String legalPersonId,
            String officialId) {

        return repository
                .findByIdAndLegalPerson_Id(officialId, legalPersonId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Senior Managing Official not found."
                ));
    }

    private SeniorManagingOfficialResponse toResponse(
            SeniorManagingOfficial official) {

        LocalDate today = LocalDate.now();

        return new SeniorManagingOfficialResponse(
                official.getId(),
                official.getLegalPerson().getId(),
                official.getLegalPerson().getName(),
                official.getLegalPerson().getRegistrationNumber(),
                official.getFullName(),
                official.getDateOfBirth(),
                official.getNationality(),
                official.getGender(),
                official.getPhoneNumber(),
                official.getIdDocumentType(),
                official.getIdNumber(),
                official.getCountryOfIssue(),
                official.getDateOfIssue(),
                official.getDateOfExpiry(),
                official.getIdVerificationStatus(),
                official.getDateOfExpiry().isBefore(today),
                official.getPosition(),
                official.getJustification(),
                official.getVerificationNotes(),
                official.getCreatedBy(),
                official.getCreatedAt(),
                official.getUpdatedBy(),
                official.getUpdatedAt()
        );
    }

    private String currentUsername() {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null) {
            return "system";
        }

        return authentication.getName();
    }
}
