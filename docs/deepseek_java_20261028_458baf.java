package dashen.bank.boivs.web;

import dashen.bank.boivs.domain.LegalPersonDocument;
import dashen.bank.boivs.domain.enums.LegalDocType;
import dashen.bank.boivs.dto.LegalPersonDocumentResponse;
import dashen.bank.boivs.service.LegalPersonDocumentStorageService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/legal-persons/{lpId}/documents")
public class LegalPersonDocumentController {

    private final LegalPersonDocumentStorageService documentStorageService;

    public LegalPersonDocumentController(LegalPersonDocumentStorageService documentStorageService) {
        this.documentStorageService = documentStorageService;
    }

    /**
     * Upload a document for a legal person.
     * Accepts an optional `docType` param (MOA, AOA, COMMERCIAL_REGISTRATION, …).
     * If omitted, the service stores it with docType = OTHER.
     */
    @PostMapping(consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public ResponseEntity<LegalPersonDocumentResponse> upload(
            @PathVariable String lpId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "docType", required = false) LegalDocType docType) {
        var saved = documentStorageService.upload(lpId, file, docType);
        return ResponseEntity.status(HttpStatus.CREATED).body(LegalPersonDocumentResponse.from(saved));
    }

    /** List all documents attached to a legal person. */
    @GetMapping
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public List<LegalPersonDocumentResponse> list(@PathVariable String lpId) {
        return documentStorageService.listFor(lpId).stream().map(LegalPersonDocumentResponse::from).toList();
    }

    /** Download one document. */
    @GetMapping("/{docId}/download")
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public ResponseEntity<FileSystemResource> download(
            @PathVariable String lpId,
            @PathVariable String docId) {
        LegalPersonDocument doc = documentStorageService.getById(docId);
        FileSystemResource resource = new FileSystemResource(Path.of(doc.getStorageRef()));
        MediaType mediaType = doc.getContentType() != null
                ? MediaType.parseMediaType(doc.getContentType())
                : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(doc.getFileName()).build().toString())
                .body(resource);
    }

    /** Delete one document. */
    @DeleteMapping("/{docId}")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String lpId, @PathVariable String docId) {
        documentStorageService.delete(lpId, docId);
        return ResponseEntity.noContent().build();
    }
}