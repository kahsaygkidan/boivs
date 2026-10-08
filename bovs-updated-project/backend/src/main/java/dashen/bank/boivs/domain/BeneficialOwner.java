package dashen.bank.boivs.domain;

import dashen.bank.boivs.domain.enums.BoCapacity;
import dashen.bank.boivs.domain.enums.Gender;
import dashen.bank.boivs.domain.enums.ResidentialStatus;
import dashen.bank.boivs.domain.enums.SourceOfInformation;
import dashen.bank.boivs.domain.enums.VerificationStatus;
import dashen.bank.boivs.domain.enums.BoStatus;
import dashen.bank.boivs.domain.enums.IdDocumentType;
import dashen.bank.boivs.domain.enums.OwnershipType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "beneficial_owner")
@Getter
@Setter
@NoArgsConstructor
public class BeneficialOwner {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "bo_reference", nullable = false, unique = true, length = 30)
    private String boReference;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "legal_person_id", nullable = false)
    private LegalPerson legalPerson;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(name = "id_document_type", nullable = false)
    private IdDocumentType idDocumentType;

    /** Extra detail for the ID type: document name for OTHER, Kebele / Woreda for KEBELE_ID. */
    @Column(name = "id_type_detail")
    private String idTypeDetail;

    /** Verification status of the identification document only (chosen with the ID type). */
    @Enumerated(EnumType.STRING)
    @Column(name = "id_verification_status", length = 20)
    private VerificationStatus idVerificationStatus;

    @Column(name = "id_number", nullable = false)
    private String idNumber;

    @Column(nullable = false)
    private String nationality;

    @Column(name = "country_of_issue", nullable = false)
    private String countryOfIssue;

    @Column(name = "date_of_expiry", nullable = false)
    private LocalDate dateOfExpiry;

    @Enumerated(EnumType.STRING)
    @Column(name = "ownership_type", nullable = false)
    private OwnershipType ownershipType;

    @Column(name = "ownership_percentage", nullable = false, precision = 5, scale = 2)
    private BigDecimal ownershipPercentage;

    @Column(name = "date_became_bo", nullable = false)
    private LocalDate dateBecameBo;

    /** Why this person is on the register: ownership threshold, control, or senior managing official fallback. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private BoCapacity capacity = BoCapacity.OWNERSHIP;

    /** Human readable ownership path(s), e.g. "ABC PLC → XYZ Holdings (60%) → Mr. A (70%) = 42%". */
    @Column(name = "ownership_chain", length = 2000)
    private String ownershipChain;

    /** Comma separated ControlBasis names. */
    @Column(name = "control_basis", length = 500)
    private String controlBasis;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Gender gender;

    @Column(name = "place_of_birth")
    private String placeOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(name = "residential_status", length = 20)
    private ResidentialStatus residentialStatus;

    @Column(name = "email_address")
    private String emailAddress;

    @Column(name = "phone_number", length = 50)
    private String phoneNumber;

    @Column
    private String occupation;

    @Column(name = "date_of_issue")
    private LocalDate dateOfIssue;

    /** Nature of ownership or control, e.g. "Shareholding; Voting rights". */
    @Column(name = "ownership_nature", length = 500)
    private String ownershipNature;

    @Column(name = "date_ceased")
    private LocalDate dateCeased;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_of_information", length = 40)
    private SourceOfInformation sourceOfInformation;

    @Column(name = "additional_information", length = 2000)
    private String additionalInformation;

    /** Set when a checker verifies the record (kept even if the record is later ceased). */
    @Column(name = "verification_date")
    private LocalDateTime verificationDate;

    @Column(name = "residential_address", length = 500)
    private String residentialAddress;

    @Column(name = "source_of_wealth", length = 1000)
    private String sourceOfWealth;

    @Column(name = "source_of_funds", length = 1000)
    private String sourceOfFunds;

    @Column(name = "sanctions_screened", nullable = false)
    private boolean sanctionsScreened;

    /** The tree node this record was registered from (null for manually captured records). */
    @Column(name = "ownership_node_id", length = 36)
    private String ownershipNodeId;

    @Column(name = "is_pep", nullable = false)
    private boolean pep;

    @Column(name = "pep_details", length = 1000)
    private String pepDetails;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BoStatus status = BoStatus.DRAFT;

    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "decided_by")
    private String decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @OneToMany(mappedBy = "beneficialOwner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BoDocument> documents = new ArrayList<>();

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
