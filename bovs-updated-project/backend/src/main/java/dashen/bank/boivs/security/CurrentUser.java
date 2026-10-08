package dashen.bank.boivs.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Small helper to read the authenticated username / roles out of the current
 * Keycloak-issued JWT, for use in audit logging and ownership checks.
 */
@Component
public class CurrentUser {

    public String username() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            String preferred = jwtAuth.getToken().getClaimAsString("preferred_username");
            return preferred != null ? preferred : auth.getName();
        }
        return auth != null ? auth.getName() : "anonymous";
    }

    public List<String> roles() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return List.of();
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(a -> a.startsWith("ROLE_") ? a.substring(5) : a)
                .collect(Collectors.toList());
    }

    public String rolesAsCsv() {
        return String.join(",", roles());
    }

    public boolean hasRole(String role) {
        return roles().contains(role);
    }
}
