package dashen.bank.boivs.web;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import dashen.bank.boivs.dto.AuditLogResponse;
import dashen.bank.boivs.service.AuditService;

@RestController
@RequestMapping("/api/audit-logs")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('AUDITOR','ADMIN')")
    public Page<AuditLogResponse> list(@RequestParam(required = false) String entityRef, Pageable pageable) {
        Page<dashen.bank.boivs.domain.AuditLog> page = entityRef != null
                ? auditService.findByEntityRef(entityRef, pageable)
                : auditService.findAll(pageable);
        return page.map(AuditLogResponse::from);
    }
}