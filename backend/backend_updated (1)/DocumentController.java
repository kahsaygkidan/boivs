package dashen.bank.boivs.web;

import dashen.bank.boivs.domain.BoDocument;
import dashen.bank.boivs.dto.BoDocumentResponse;
import dashen.bank.boivs.service.DocumentStorageService;
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
@RequestMapping("/api/bo-records/{boId}/documents")
public class DocumentController {

    private final DocumentStorageService documentStorageService;

    public DocumentController(DocumentStorageService documentStorageService) {
        this.documentStorageService = documentStorageService;
    }

    @PostMapping(consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public ResponseEntity<BoDocumentResponse> upload(@PathVariable String boId, @RequestParam("file") MultipartFile file) {
        var saved = documentStorageService.upload(boId, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(BoDocumentResponse.from(saved));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public List<BoDocumentResponse> list(@PathVariable String boId) {
        return documentStorageService.listFor(boId).stream().map(BoDocumentResponse::from).toList();
    }

    @GetMapping("/{docId}/download")
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public ResponseEntity<FileSystemResource> download(@PathVariable String boId, @PathVariable String docId) {
        BoDocument doc = documentStorageService.getById(docId);
        FileSystemResource resource = new FileSystemResource(Path.of(doc.getStoragePath()));
        MediaType mediaType = doc.getContentType() != null
                ? MediaType.parseMediaType(doc.getContentType())
                : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(doc.getFileName()).build().toString())
                .body(resource);
    }

    @DeleteMapping("/{docId}")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String boId, @PathVariable String docId) {
        documentStorageService.delete(boId, docId);
        return ResponseEntity.noContent().build();
    }
}
