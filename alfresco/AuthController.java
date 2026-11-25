package standard_contract.authentication;

import com.nimbusds.jwt.SignedJWT;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.text.ParseException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Value("${spring.security.oauth2.client.registration.keycloak.client-id}")
    private String clientId;

    @Value("${spring.security.oauth2.client.registration.keycloak.client-secret}")
    private String clientSecret;

    @Value("${spring.security.oauth2.client.provider.keycloak.token-uri}")
    private String tokenUri;

    private final RestTemplate restTemplate = new RestTemplate();


    private final Map<String, AttemptInfo> loginAttempts = new ConcurrentHashMap<>();
    private final int MAX_ATTEMPTS = 5;
    private final long LOCK_TIME_MS = 10 * 60 * 1000; // 10 minutes

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    static class AttemptInfo {
        private int count;
        private long lastAttemptTime;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        // Check lockout
        AttemptInfo attemptInfo = loginAttempts.get(username);
        if (attemptInfo != null && attemptInfo.getCount() >= MAX_ATTEMPTS) {
            long timeSinceLastAttempt = System.currentTimeMillis() - attemptInfo.lastAttemptTime;
            if (timeSinceLastAttempt < LOCK_TIME_MS) {
                long secondsLeft = (LOCK_TIME_MS - timeSinceLastAttempt) / 1000;
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(
                        Map.of("error", "Account locked. Try again in " + secondsLeft + " seconds.",
                                "loginAttempts", attemptInfo.count)
                );
            } else {
                loginAttempts.remove(username); // Reset lockout
            }
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "password");
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);
        body.add("username", username);
        body.add("password", password);


        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> tokenResponseEntity = restTemplate.postForEntity(tokenUri, request, Map.class);
            Map<String, Object> tokenResponse = tokenResponseEntity.getBody();

            String accessToken = (String) tokenResponse.get("access_token");

            String refreshToken = (String) tokenResponse.get("refresh_token");
            Integer expiresIn = (Integer) tokenResponse.get("expires_in");

            SignedJWT jwt = SignedJWT.parse(accessToken);
            Map<String, Object> claims = jwt.getJWTClaimsSet().getClaims();
            Map<String, Object> resourceAccess = (Map<String, Object>) claims.get("resource_access");

            List<String> roles = new ArrayList<>();
            if (resourceAccess != null && resourceAccess.containsKey(clientId)) {
                Map<String, Object> clientAccess = (Map<String, Object>) resourceAccess.get(clientId);
                if (clientAccess != null && clientAccess.containsKey("roles")) {
                    roles = (List<String>) clientAccess.get("roles");
                }
            }
            if (roles.isEmpty()) {
                incrementLoginAttempt(username);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                        Map.of("error", "You do not have access to this system",
                                "loginAttempts", loginAttempts.get(username).count)
                );
            }

            // extract full name from claim
            String fullName = (String) claims.get("given_name");

            loginAttempts.remove(username); // Reset on success

            username = (String) claims.get("preferred_username");
            ResponseCookie accessCookie = ResponseCookie.from("Authorization", accessToken)
                    .httpOnly(true)
                    .secure(true)
                    .path("/")
                    .sameSite("None")
                    .maxAge(Duration.ofSeconds(expiresIn))
                    .build();

            ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", refreshToken)
                    .httpOnly(true)
                    .secure(true)
                    .path("/")
                    .sameSite("None")
                    .maxAge(Duration.ofHours(1))
                    .build();

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, accessCookie.toString(), refreshCookie.toString())
                    .body(Map.of(
                            "roles", roles,
                            "fullName", fullName != null ? fullName : "",
                            "loginAttempts", 0,
                            "username", username,
                            "expiresIn", expiresIn,
                            "accessToken", accessToken
                    ));

        } catch (HttpClientErrorException e) {
            incrementLoginAttempt(username);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of("error", "Invalid username or password",
                            "loginAttempts", loginAttempts.get(username).count)
            );

        } catch (RestClientException e) {
            // Keycloak may be unreachable or return a non-4xx error. Without this,
            // the exception escapes, forwards to /error and surfaces as a blank 401.
            logger.error("Authentication service error during login for user {}: {}", username, e.getMessage());
            incrementLoginAttempt(username);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                    Map.of("error", "Authentication service is currently unavailable. Please try again.",
                            "loginAttempts", loginAttempts.get(username).count)
            );
        } catch (ParseException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of("error", "Token parsing failed",
                            "loginAttempts", loginAttempts.getOrDefault(username, new AttemptInfo()).count)
            );
        }
    }

    private void incrementLoginAttempt(String username) {
        loginAttempts.compute(username, (key, old) -> {
            if (old == null) {
                AttemptInfo info = new AttemptInfo();
                info.setCount(1);
                info.setLastAttemptTime(System.currentTimeMillis());
                return info;
            } else {
//                old.count++;
//                old.lastAttemptTime = System.currentTimeMillis();

                old.setCount(old.getCount() + 1);
                old.setLastAttemptTime(System.currentTimeMillis());
                return old;
            }
        });
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@CookieValue(value = "refreshToken", required = false) String refreshToken) {
        if (refreshToken == null || refreshToken.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Missing refresh token");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "refresh_token");
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);
        body.add("refresh_token", refreshToken);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(tokenUri, request, Map.class);
            Map<String, Object> tokenResponse = response.getBody();

            String newAccessToken = (String) tokenResponse.get("access_token");
            String newRefreshToken = (String) tokenResponse.get("refresh_token");
            Integer expiresIn = (Integer) tokenResponse.get("expires_in");
//            Integer expiresIn = (Integer) tokenResponse.get("expires_in");  // access token expiry
            Integer refreshExpiresIn = (Integer) tokenResponse.get("refresh_expires_in"); // refresh token expiry

            // Optional: decode roles again if needed

            ResponseCookie accessCookie = ResponseCookie.from("Authorization", newAccessToken)
                    .httpOnly(true)
                    .secure(true)
                    .path("/")
                    .sameSite("None")
                    .maxAge(Duration.ofSeconds(expiresIn))
                    .build();

            ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", newRefreshToken)
                    .httpOnly(true)
                    .secure(true)
                    .path("/")
                    .sameSite("None")
                    .maxAge(Duration.ofHours(1))
                    .build();

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, accessCookie.toString(), refreshCookie.toString())
                    .body(Map.of("message", "Token refreshed",
                            "expiresIn", refreshExpiresIn));
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid refresh token or Keycloak error");
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@CookieValue(value = "refreshToken", required = false) String refreshToken) {
        String logoutUrl = tokenUri.replace("/token", "/logout");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        if (refreshToken != null && !refreshToken.isEmpty()) {
            form.add("refresh_token", refreshToken);
        }

        HttpEntity<MultiValueMap<String, String>> logoutRequest = new HttpEntity<>(form, headers);

        // Clear access and refresh cookies
        ResponseCookie clearAccess = ResponseCookie.from("Authorization", "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0)
                .sameSite("None")
                .build();

        ResponseCookie clearRefresh = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0)
                .sameSite("None")
                .build();

        try {
            if (refreshToken != null && !refreshToken.isEmpty()) {
                restTemplate.postForEntity(logoutUrl, logoutRequest, String.class);
            }

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, clearAccess.toString(), clearRefresh.toString())
                    .body(Map.of("message", "Logout successful"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .header(HttpHeaders.SET_COOKIE, clearAccess.toString(), clearRefresh.toString())
                    .body(Map.of("error", "Logout failed", "details", e.getMessage()));
        }
    }

@GetMapping("/session")
public ResponseEntity<?> checkSession(Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated() || authentication.getPrincipal().equals("anonymousUser")) {
        return ResponseEntity.ok(Map.of(
                "authenticated", false,
                "error", "Not authenticated"
        ));
    }

    String username = null;
    if (authentication instanceof JwtAuthenticationToken jwtAuth) {
        Jwt jwt = jwtAuth.getToken();
        username = jwt.getClaimAsString("preferred_username");
        if (username == null) {
            username = jwt.getClaimAsString("email");
        }
        if (username == null) {
            username = jwt.getClaimAsString("name");
        }
    }

    if (username == null) {
        username = authentication.getName();
    }

    logger.info("Checking session for username: {}", username);

    List<String> roles = authentication.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority).filter(Objects::nonNull)
            .filter(r -> r.startsWith("ROLE_"))
            .map(r -> r.replace("ROLE_", ""))
            .toList();

    return ResponseEntity.ok(Map.of(
            "authenticated", true,
            "username", username,
            "roles", roles
    ));
}
    @GetMapping("/check-token")
    public ResponseEntity<Object> checkTokenValidity() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Jwt jwt) {
            Instant expiresAt = jwt.getExpiresAt();

            if (expiresAt != null) {
                boolean isValid = expiresAt.isAfter(Instant.now());
                long expiresIn = ChronoUnit.SECONDS.between(Instant.now(), expiresAt);

                return ResponseEntity.ok()
                        .body(Map.of(
                                "isValid", isValid,
                                "expiresIn", Math.max(0, expiresIn)));
            } else {
                return ResponseEntity.ok()
                        .body(Map.of("isValid", true, "expiresIn", -1));
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

}
