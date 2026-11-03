package dashen.bank.boivs.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dashen.bank.boivs.config.KeycloakProperties;
import dashen.bank.boivs.dto.TokenResponse;
import dashen.bank.boivs.exception.AuthServiceException;
import dashen.bank.boivs.exception.InvalidCredentialsException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Performs login/refresh/logout against Keycloak's token endpoint on the SPA's behalf,
 * using the confidential "bovs-backend" client. This keeps the client secret server-side
 * and means the browser never has to redirect to Keycloak's own hosted login page: the
 * username/password entered in our own UI are forwarded once, directly, over this
 * server-to-server call (the OAuth2 "Resource Owner Password Credentials" grant).
 */
@Service
public class KeycloakAuthService {

    private final RestClient restClient = RestClient.create();
    private final KeycloakProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public KeycloakAuthService(KeycloakProperties properties) {
        this.properties = properties;
    }

    public TokenResponse login(String username, String password) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "password");
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("username", username);
        form.add("password", password);
        form.add("scope", "openid");
        return exchange(form);
    }

    public TokenResponse refresh(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("refresh_token", refreshToken);
        return exchange(form);
    }

    public void logout(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("refresh_token", refreshToken);
        try {
            restClient.post()
                    .uri(properties.logoutUri())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            // Session may already be expired/invalidated - treat as a successful logout either way.
        }
    }

    private TokenResponse exchange(MultiValueMap<String, String> form) {
        try {
            String body = restClient.post()
                    .uri(properties.tokenUri())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .body(form)
                    .retrieve()
                    .body(String.class);
            return toTokenResponse(body);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 401 || e.getStatusCode().value() == 400) {
                throw new InvalidCredentialsException("Invalid username, password, or refresh token");
            }
            throw new AuthServiceException("Identity provider error: " + e.getMessage());
        } catch (Exception e) {
            throw new AuthServiceException("Could not reach the identity provider: " + e.getMessage());
        }
    }

    private TokenResponse toTokenResponse(String body) throws Exception {
        JsonNode node = objectMapper.readTree(body);
        String accessToken = node.path("access_token").asText();
        String refreshToken = node.path("refresh_token").asText(null);
        long expiresIn = node.path("expires_in").asLong();
        long refreshExpiresIn = node.path("refresh_expires_in").asLong();
        String tokenType = node.path("token_type").asText("Bearer");

        JsonNode claims = decodeClaims(accessToken);
        String username = claims.path("preferred_username").asText(null);
        List<String> roles = new ArrayList<>();
        JsonNode realmRoles = claims.path("realm_access").path("roles");
        if (realmRoles.isArray()) {
            realmRoles.forEach(r -> roles.add(r.asText()));
        }

        return new TokenResponse(accessToken, refreshToken, expiresIn, refreshExpiresIn, tokenType, username, roles);
    }

    private JsonNode decodeClaims(String jwt) throws Exception {
        String[] parts = jwt.split("\\.");
        if (parts.length < 2) {
            return objectMapper.createObjectNode();
        }
        byte[] decoded = Base64.getUrlDecoder().decode(parts[1]);
        return objectMapper.readTree(new String(decoded, StandardCharsets.UTF_8));
    }
}
