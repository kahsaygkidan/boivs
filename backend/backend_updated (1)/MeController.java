package dashen.bank.boivs.web;

import dashen.bank.boivs.security.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Lets the frontend ask "who am I / what roles do I have" right after Keycloak login. */
@RestController
@RequestMapping("/api/me")
public class MeController {

    private final CurrentUser currentUser;

    public MeController(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    @GetMapping
    public Map<String, Object> me() {
        return Map.of(
                "username", currentUser.username(),
                "roles", currentUser.roles()
        );
    }
}
