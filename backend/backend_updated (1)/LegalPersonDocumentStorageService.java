package dashen.bank.boivs.service;

import dashen.bank.boivs.domain.LegalPersonDocument;
import dashen.bank.boivs.domain.enums.LegalDocType;
import dashen.bank.boivs.repository.LegalPersonDocumentRepository;
import dashen.bank.boivs.exception.NotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class LegalPersonDocumentStorageService {

    private final LegalPersonDocumentRepository repository;
    private final Path baseDir;
    private final String uploader;

    public LegalPersonDocumentStorageService(
            LegalPersonDocumentRepository repository,
            @Value("${boivs.storage.root:./storage}") String storageRoot,
            @Value("${boivs.uploader:system}") String uploader) throws IOException {
        this.repository = repository;
        this.baseDir = Paths.get(storageRoot, "legal-persons").toAbsolutePath().normalize();
        Files.createDirectories(this.baseDir);
        this.uploader = uploader;
    }

    @Transactional
    public LegalPersonDocument upload(String lpId, MultipartFile file, LegalDocType docType) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }
        String safeName = sanitize(file.getOriginalFilename());
        String storageName = UUID.randomUUID() + "-" + safeName;
        Path target = baseDir.resolve(storageName);

        try {
            file.transferTo(target);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }

        LegalPersonDocument doc = new LegalPersonDocument();
        doc.setLegalPersonId(lpId);
        doc.setDocType(docType != null ? docType : LegalDocType.OTHER);
        doc.setFileName(safeName);
        doc.setContentType(file.getContentType());
        doc.setSizeBytes(file.getSize());
        doc.setStorageRef(target.toString());
        doc.setUploadedBy(uploader);
        doc.setUploadedAt(LocalDateTime.now());

        return repository.save(doc);
    }

    public List<LegalPersonDocument> listFor(String lpId) {
        return repository.findByLegalPersonIdOrderByUploadedAtDesc(lpId);
    }

    public LegalPersonDocument getById(String docId) {
        return repository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Document not found: " + docId));
    }

    @Transactional
    public void delete(String lpId, String docId) {
        LegalPersonDocument doc = repository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Document not found: " + docId));
        if (!doc.getLegalPersonId().equals(lpId)) {
            throw new IllegalArgumentException("Document does not belong to this legal person");
        }
        try {
            Files.deleteIfExists(Path.of(doc.getStorageRef()));
        } catch (IOException e) {
            // log and continue — DB deletion should still succeed
        }
        repository.delete(doc);
    }

    private String sanitize(String name) {
        if (name == null || name.isBlank()) return "upload";
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}