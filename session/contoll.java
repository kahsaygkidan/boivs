package dashen.bank.boivs.web;

import dashen.bank.boivs.dto.LoginRequest;
import dashen.bank.boivs.dto.LogoutRequest;
import dashen.bank.boivs.dto.RefreshRequest;
import dashen.bank.boivs.dto.TokenResponse;
import dashen.bank.boivs.service.KeycloakAuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Fronts Keycloak for the SPA: the browser only ever talks to this controller, never to
 * Keycloak's own hosted login page. Credentials are forwarded once, server-to-server, using
 * the confidential "bovs-backend" client (see KeycloakAuthService), and the resulting tokens
 * are handed back to the SPA to use as normal bearer tokens on /api/** calls.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final KeycloakAuthService keycloakAuthService;

    public AuthController(KeycloakAuthService keycloakAuthService) {
        this.keycloakAuthService = keycloakAuthService;
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return keycloakAuthService.login(request.username(), request.password());
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return keycloakAuthService.refresh(request.refreshToken());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody LogoutRequest request) {
        keycloakAuthService.logout(request.refreshToken());
        return ResponseEntity.noContent().build();
    }
}
