package dashen.bank.boivs.web;

import dashen.bank.boivs.config.SessionProperties;
import dashen.bank.boivs.dto.SessionConfigResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lets the frontend read the idle-timeout / refresh-lead values that are actually
 * configured on the backend (bovs.session.*), instead of hardcoding them client-side.
 * Public: it carries no user data, just timing constants the SPA needs before/around login.
 */
@RestController
@RequestMapping("/api/config/session")
public class SessionConfigController {

    private final SessionProperties sessionProperties;

    public SessionConfigController(SessionProperties sessionProperties) {
        this.sessionProperties = sessionProperties;
    }

    @GetMapping
    public SessionConfigResponse sessionConfig() {
        return new SessionConfigResponse(
                sessionProperties.idleTimeoutMinutes(),
                sessionProperties.refreshLeadSeconds()
        );
    }
}
