package dashen.bank.boivs.domain;

import dashen.bank.boivs.domain.enums.LegalDocType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "legal_person_document",
    indexes = {
        @Index(name = "idx_lpd_legal_person", columnList = "legal_person_id"),
        @Index(name = "idx_lpd_doc_type", columnList = "doc_type")
    }
)
@Getter
@Setter
@NoArgsConstructor
public class LegalPersonDocument {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "legal_person_id", nullable = false, length = 36)
    private String legalPersonId;

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false, length = 40)
    private LegalDocType docType;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    /** Storage reference (path, object-store key, etc.). */
    @Column(name = "storage_ref", length = 500, nullable = false)
    private String storageRef;

    @Column(name = "uploaded_by", nullable = false)
    private String uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (uploadedAt == null) uploadedAt = LocalDateTime.now();
    }
}
