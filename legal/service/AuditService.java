package dashen.bank.boivs.service;

import dashen.bank.boivs.domain.AuditLog;
import dashen.bank.boivs.domain.enums.AuditAction;
import dashen.bank.boivs.repository.AuditLogRepository;
import dashen.bank.boivs.security.CurrentUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final CurrentUser currentUser;

    public AuditService(AuditLogRepository auditLogRepository, CurrentUser currentUser) {
        this.auditLogRepository = auditLogRepository;
        this.currentUser = currentUser;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String entityType, String entityRef, AuditAction action, String details) {
        AuditLog log = new AuditLog();
        log.setEntityType(entityType);
        log.setEntityRef(entityRef);
        log.setAction(action.name());
        log.setActorUsername(currentUser.username());
        log.setActorRoles(currentUser.rolesAsCsv());
        log.setDetails(details);
        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> findByEntityRef(String entityRef, Pageable pageable) {
        return auditLogRepository.findByEntityRefOrderByCreatedAtDesc(entityRef, pageable);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> findAll(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
    }
}
