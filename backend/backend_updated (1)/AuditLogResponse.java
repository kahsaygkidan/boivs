package  dashen.bank.boivs.dto;

import  dashen.bank.boivs.domain.AuditLog;

import java.time.LocalDateTime;

public record AuditLogResponse(
        String id,
        String entityType,
        String entityRef,
        String action,
        String actorUsername,
        String actorRoles,
        String details,
        LocalDateTime createdAt
) {
    public static AuditLogResponse from(AuditLog a) {
        return new AuditLogResponse(a.getId(), a.getEntityType(), a.getEntityRef(), a.getAction(),
                a.getActorUsername(), a.getActorRoles(), a.getDetails(), a.getCreatedAt());
    }
}
