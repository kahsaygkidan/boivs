package dashen.bank.boivs.domain;

import dashen.bank.boivs.domain.enums.*;
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
@Table(
    name = "beneficial_owner",
    indexes = {
        @Index(name = "idx_bo_legal_person", columnList = "legal_person_id"),
        @Index(name = "idx_bo_status", columnList = "status"),
        @Index(name = "idx_bo_approved_by", columnList = "approved_by"),
        @Index(name = "idx_bo_approved_at", columnList = "approved_at"),
        @Index(name = "idx_bo_id_number", columnList = "id_number")
    }
)
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

    /* ======================================================================
       Identity
       ====================================================================== */

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

    /** Verification status of the identification document. */
    @Enumerated(EnumType.STRING)
    @Column(name = "id_verification_status", length = 20)
    private VerificationStatus idVerificationStatus;

    @Column(name = "id_number", nullable = false)
    private String idNumber;

    @Column(nullable = false)
    private String nationality;

    @Column(name = "country_of_issue", nullable = false)
    private String countryOfIssue;

    @Column(name = "date_of_issue")
    private LocalDate dateOfIssue;

    @Column(name = "date_of_expiry", nullable = false)
    private LocalDate dateOfExpiry;

    /* ======================================================================
       Demographics
       ====================================================================== */

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

    @Column(name = "residential_address", length = 500)
    private String residentialAddress;

    /* ======================================================================
       Ownership & control
       ====================================================================== */

    @Enumerated(EnumType.STRING)
    @Column(name = "ownership_type", nullable = false)
    private OwnershipType ownershipType;

    @Column(name = "ownership_percentage", nullable = false, precision = 5, scale = 2)
    private BigDecimal ownershipPercentage;

    /**
     * Voting rights % — may differ from ownership %.
     * NBE directive: "capture the nature, type and extent of ownership or control,
     * including ownership percentage, voting rights, direct, indirect and joint
     * ownership and the mechanism through which control is exercised."
     */
    @Column(name = "voting_rights", precision = 5, scale = 2)
    private BigDecimal votingRights;

    /**
     * Basis of ownership/control for this holder:
     * OWNERSHIP (by equity), CONTROL (by other means), BOTH.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "ownership_basis", length = 20)
    private OwnershipBasis ownershipBasis;

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

    /** Nature of ownership or control, e.g. "Shareholding; Voting rights". */
    @Column(name = "ownership_nature", length = 500)
    private String ownershipNature;

    /** Joint ownership flag — NBE directive: "direct, indirect and joint ownership". */
    @Column(name = "joint_ownership", nullable = false)
    private boolean jointOwnership = false;

    /** Names of the other joint holders when jointOwnership=true. */
    @Column(name = "joint_owner_names", length = 500)
    private String jointOwnerNames;

    @Column(name = "date_ceased")
    private LocalDate dateCeased;

    /** The tree node this record was registered from (null for manually captured records). */
    @Column(name = "ownership_node_id", length = 36)
    private String ownershipNodeId;

    /* ======================================================================
       PEP — structured
       ====================================================================== */

    @Column(name = "is_pep", nullable = false)
    private boolean pep;

    @Column(name = "pep_position", length = 200)
    private String pepPosition;

    @Column(name = "pep_country", length = 100)
    private String pepCountry;

    @Column(name = "pep_organization", length = 200)
    private String pepOrganization;

    /** Legacy free-text field — kept for backward compatibility with older records. */
    @Column(name = "pep_details", length = 1000)
    private String pepDetails;

    /* ======================================================================
       Screening — sanctions, NBE freeze, adverse media
       ====================================================================== */

    @Column(name = "sanctions_screened", nullable = false)
    private boolean sanctionsScreened;

    @Enumerated(EnumType.STRING)
    @Column(name = "sanctions_result", length = 30)
    private ScreeningResult sanctionsResult;

    @Column(name = "sanctions_resolution", length = 500)
    private String sanctionsResolution;

    @Column(name = "nbe_freeze_screened", nullable = false)
    private boolean nbeFreezeScreened;

    @Enumerated(EnumType.STRING)
    @Column(name = "nbe_freeze_result", length = 30)
    private ScreeningResult nbeFreezeResult;

    @Column(name = "nbe_freeze_resolution", length = 500)
    private String nbeFreezeResolution;

    @Column(name = "adverse_media_screened", nullable = false)
    private boolean adverseMediaScreened;

    @Enumerated(EnumType.STRING)
    @Column(name = "adverse_media_result", length = 30)
    private ScreeningResult adverseMediaResult;

    @Column(name = "adverse_media_resolution", length = 500)
    private String adverseMediaResolution;

    /* ======================================================================
       Verification meta
       ====================================================================== */

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_method", length = 40)
    private VerificationMethod verificationMethod;

    /** Set when a checker verifies the record (kept even if the record is later ceased). */
    @Column(name = "verification_date")
    private LocalDateTime verificationDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_outcome", length = 30)
    private VerificationOutcome verificationOutcome;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_of_information", length = 40)
    private SourceOfInformation sourceOfInformation;

    @Column(name = "additional_information", length = 2000)
    private String additionalInformation;

    @Column(name = "source_of_wealth", length = 1000)
    private String sourceOfWealth;

    @Column(name = "source_of_funds", length = 1000)
    private String sourceOfFunds;

    /* ======================================================================
       Lifecycle
       ====================================================================== */

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BoStatus status = BoStatus.DRAFT;

    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;

    /* ======================================================================
       Audit
       ====================================================================== */

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /* ======================================================================
       Decision — approve / reject / cease
       ====================================================================== */

    /** Actor who made the last decision — approve, reject, or cease. */
    @Column(name = "decided_by")
    private String decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    /* ======================================================================
       Approval — set only when a checker approves
       Preserved if the record later moves to CEASED.
       Cleared only if rejected before ever being approved.
       ====================================================================== */

    /** Checker who approved the record. Null until approved. */
    @Column(name = "approved_by")
    private String approvedBy;

    /** Timestamp of approval. Null until approved. */
    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    /* ======================================================================
       Documents (legacy association — kept for backward compatibility)
       New uploads go through /api/documents/BO_RECORD/{boId}
       ====================================================================== */

    @OneToMany(mappedBy = "beneficialOwner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BoDocument> documents = new ArrayList<>();

    /* ======================================================================
       Lifecycle hooks
       ====================================================================== */

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /* ======================================================================
       Derived helpers (not persisted)
       ====================================================================== */

    @Transient
    public boolean isApproved() {
        return status == BoStatus.VERIFIED && approvedBy != null && approvedAt != null;
    }

    @Transient
    public boolean isCeased() {
        return status == BoStatus.CEASED || dateCeased != null;
    }

    @Transient
    public boolean hasAnyScreeningMatch() {
        return (sanctionsResult != null && sanctionsResult != ScreeningResult.CLEAR)
            || (nbeFreezeResult != null && nbeFreezeResult != ScreeningResult.CLEAR)
            || (adverseMediaResult != null && adverseMediaResult != ScreeningResult.CLEAR);
    }
}
