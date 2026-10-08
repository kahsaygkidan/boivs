package dashen.bank.boivs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import dashen.bank.boivs.domain.enums.NodeType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One party in the ownership tree of a customer (legal person).
 * parentId == null  -> direct shareholder of the customer.
 * parentId != null  -> shareholder of another COMPANY node.
 * Percentage is the DIRECT stake held in the parent; effective (indirect) % is calculated, never stored.
 */
@Entity
@Table(name = "ownership_node")
@Getter
@Setter
@NoArgsConstructor
public class OwnershipNode {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "legal_person_id", nullable = false, length = 36)
    private String legalPersonId;

    @Column(name = "parent_id", length = 36)
    private String parentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "node_type", nullable = false, length = 20)
    private NodeType nodeType;

    @Column(nullable = false)
    private String name;

    @Column(name = "registration_number", length = 100)
    private String registrationNumber;

    @Column(name = "id_number", length = 100)
    private String idNumber;

    @Column(length = 100)
    private String nationality;

    @Column(name = "ownership_percentage", nullable = false, precision = 5, scale = 2)
    private BigDecimal ownershipPercentage;

    /** Comma separated ControlBasis names (INDIVIDUAL nodes only). */
    @Column(name = "control_basis", length = 500)
    private String controlBasis;

    @Column(name = "control_notes", length = 1000)
    private String controlNotes;

    /** Set once a BO record has been registered for this person from this node. */
    @Column(name = "beneficial_owner_id", length = 36)
    private String beneficialOwnerId;

    @Column(name = "created_by", nullable = false, length = 100)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
