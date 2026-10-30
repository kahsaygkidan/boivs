package dashen.bank.boivs.service;

import dashen.bank.boivs.domain.BeneficialOwner;
import dashen.bank.boivs.domain.BoDocument;
import dashen.bank.boivs.domain.enums.AuditAction;
import dashen.bank.boivs.exception.NotFoundException;
import dashen.bank.boivs.repository.BoDocumentRepository;
import dashen.bank.boivs.security.CurrentUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentStorageService {

    private final BoDocumentRepository documentRepository;
    private final BeneficialOwnerService beneficialOwnerService;
    private final CurrentUser currentUser;
    private final AuditService auditService;

    @Value("${bovs.storage.documents-dir:./bovs-documents}")
    private String documentsDir;

    public DocumentStorageService(BoDocumentRepository documentRepository,
                                   BeneficialOwnerService beneficialOwnerService,
                                   CurrentUser currentUser,
                                   AuditService auditService) {
        this.documentRepository = documentRepository;
        this.beneficialOwnerService = beneficialOwnerService;
        this.currentUser = currentUser;
        this.auditService = auditService;
    }

    @Transactional
    public BoDocument upload(String beneficialOwnerId, MultipartFile file) {
        BeneficialOwner bo = beneficialOwnerService.getById(beneficialOwnerId);
        try {
            Path dir = Path.of(documentsDir, bo.getBoReference());
            Files.createDirectories(dir);
            String storedName = UUID.randomUUID() + "-" + sanitize(file.getOriginalFilename());
            Path target = dir.resolve(storedName);
            Files.copy(file.getInputStream(), target);

            BoDocument doc = new BoDocument();
            doc.setBeneficialOwner(bo);
            doc.setFileName(file.getOriginalFilename());
            doc.setContentType(file.getContentType());
            doc.setSizeBytes(file.getSize());
            doc.setStoragePath(target.toString());
            doc.setUploadedBy(currentUser.username());
            BoDocument saved = documentRepository.save(doc);

            auditService.record("BENEFICIAL_OWNER", bo.getBoReference(), AuditAction.DOCUMENT_UPLOADED,
                    "Uploaded document '" + saved.getFileName() + "'");
            return saved;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store document: " + e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public List<BoDocument> listFor(String beneficialOwnerId) {
        return documentRepository.findByBeneficialOwnerId(beneficialOwnerId);
    }

    @Transactional(readOnly = true)
    public BoDocument getById(String documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Document not found: " + documentId));
    }

    @Transactional
    public void delete(String beneficialOwnerId, String documentId) {
        BoDocument doc = getById(documentId);
        if (!doc.getBeneficialOwner().getId().equals(beneficialOwnerId)) {
            throw new NotFoundException("Document not found: " + documentId);
        }
        try {
            Files.deleteIfExists(Path.of(doc.getStoragePath()));
        } catch (IOException e) {
            // The DB record is the source of truth for listings; log-and-continue rather than
            // block deletion on a filesystem hiccup (e.g. the file was already removed manually).
        }
        documentRepository.delete(doc);
        auditService.record("BENEFICIAL_OWNER", doc.getBeneficialOwner().getBoReference(), AuditAction.DOCUMENT_DELETED,
                "Deleted document '" + doc.getFileName() + "'");
    }

    private String sanitize(String fileName) {
        if (fileName == null) {
            return "file";
        }
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
