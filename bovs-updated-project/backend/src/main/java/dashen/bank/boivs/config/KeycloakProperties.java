package dashen.bank.boivs.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bovs.keycloak")
public record KeycloakProperties(
        String baseUrl,
        String realm,
        String clientId,
        String clientSecret
) {
    public String tokenUri() {
        return baseUrl + "/realms/" + realm + "/protocol/openid-connect/token";
    }

    public String logoutUri() {
        return baseUrl + "/realms/" + realm + "/protocol/openid-connect/logout";
    }
}
