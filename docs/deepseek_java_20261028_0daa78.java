package dashen.bank.boivs.dto;

import dashen.bank.boivs.domain.LegalPersonDocument;

import java.time.LocalDateTime;

public record LegalPersonDocumentResponse(
        String id,
        String legalPersonId,
        String docType,
        String fileName,
        String contentType,
        Long sizeBytes,
        String uploadedBy,
        LocalDateTime uploadedAt
) {
    public static LegalPersonDocumentResponse from(LegalPersonDocument d) {
        return new LegalPersonDocumentResponse(
                d.getId(),
                d.getLegalPersonId(),
                d.getDocType() != null ? d.getDocType().name() : null,
                d.getFileName(),
                d.getContentType(),
                d.getSizeBytes(),
                d.getUploadedBy(),
                d.getUploadedAt()
        );
    }
}