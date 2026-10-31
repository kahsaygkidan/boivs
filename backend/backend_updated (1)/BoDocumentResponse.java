package dashen.bank.boivs.dto;

import java.time.LocalDateTime;

import dashen.bank.boivs.domain.BoDocument;

public record BoDocumentResponse(
        String id,
        String fileName,
        String contentType,
        Long sizeBytes,
        String uploadedBy,
        LocalDateTime uploadedAt
        ) {

    public static BoDocumentResponse from(BoDocument d) {
        return new BoDocumentResponse(d.getId(), d.getFileName(), d.getContentType(), d.getSizeBytes(),
                d.getUploadedBy(), d.getUploadedAt());
    }
}
