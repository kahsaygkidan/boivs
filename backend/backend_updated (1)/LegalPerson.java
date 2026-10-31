package dashen.bank.boivs.domain;

import dashen.bank.boivs.domain.enums.EntityType;
import dashen.bank.boivs.domain.enums.Sector;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "legal_person")
@Getter
@Setter
@NoArgsConstructor
public class LegalPerson {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "registration_number", nullable = false, unique = true)
    private String registrationNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type")
    private EntityType entityType;

    @Column(length = 50)
    private String tin;

    @Column(name = "country_of_incorporation", length = 100)
    private String countryOfIncorporation;

    @Enumerated(EnumType.STRING)
    @Column(name = "sector", length = 50)
    private Sector sector;

    @Column(name = "directors_and_management", length = 2000)
    private String directorsAndManagement;

    /** maker fallback when no natural-person UBO can be identified after reasonable measures. */
    @Column(name = "smo_name")
    private String smoName;

    @Column(name = "smo_position")
    private String smoPosition;

    @Column(name = "smo_justification", length = 1000)
    private String smoJustification;

    @Column(name = "created_by", nullable = false)
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