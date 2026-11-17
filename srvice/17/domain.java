
package dashen.bank.boivs.domain;

import dashen.bank.boivs.domain.enums.Gender;
import dashen.bank.boivs.domain.enums.IdDocumentType;
import dashen.bank.boivs.domain.enums.VerificationStatus;

import jakarta.persistence.*;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "senior_managing_official",
    indexes = {
        @Index(
            name = "idx_smo_legal_person",
            columnList = "legal_person_id"
        ),
        @Index(
            name = "idx_smo_document",
            columnList = "id_document_type,id_number"
        )
    }
)
@Getter
@Setter
@NoArgsConstructor
public class SeniorManagingOfficial {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "legal_person_id",
        nullable = false
    )
    private LegalPerson legalPerson;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(nullable = false, length = 100)
    private String nationality;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Gender gender;

    @Column(name = "phone_number", nullable = false, length = 50)
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(
        name = "id_document_type",
        nullable = false,
        length = 40
    )
    private IdDocumentType idDocumentType;

    @Column(name = "id_number", nullable = false, length = 100)
    private String idNumber;

    @Column(name = "country_of_issue", nullable = false, length = 100)
    private String countryOfIssue;

    @Column(name = "date_of_issue", nullable = false)
    private LocalDate dateOfIssue;

    @Column(name = "date_of_expiry", nullable = false)
    private LocalDate dateOfExpiry;

    /*
     * Set by the checker/verification workflow.
     * The maker cannot submit an official as already verified.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "id_verification_status", length = 20)
    private VerificationStatus idVerificationStatus;

    @Column(nullable = false, length = 150)
    private String position;

    @Column(nullable = false, length = 2000)
    private String justification;

    @Column(name = "verification_notes", length = 2000)
    private String verificationNotes;

    @Column(name = "created_by", nullable = false, length = 100)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }

        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
