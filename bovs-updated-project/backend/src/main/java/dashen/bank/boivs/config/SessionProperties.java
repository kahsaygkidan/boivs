package dashen.bank.boivs.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Backs the {@code bovs.session.*} keys in application.yml. Exposed to the
 * frontend via GET /api/config/session so the UI's idle-logout timer and
 * proactive-refresh timer always match what's configured here, instead of being
 * hardcoded client-side.
 * <p>
 * NOTE: idleTimeoutMinutes is a UX layer only. The real security boundary is
 * Keycloak's realm-level "SSO Session Idle" setting, which should be kept in
 * sync with this value so a stolen/replayed refresh token also stops working
 * after this much inactivity.
 */
@ConfigurationProperties(prefix = "bovs.session")
public record SessionProperties(
        int idleTimeoutMinutes,
        int refreshLeadSeconds
        ) {

}
