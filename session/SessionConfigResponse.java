package dashen.bank.boivs.dto;

/**
 * Idle-logout and proactive-refresh timing the frontend should use, sourced
 * from bovs.session.*.
 */
public record SessionConfigResponse(
        int idleTimeoutMinutes,
        int refreshLeadSeconds
        ) {

}
