package dashen.bank.boivs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import dashen.bank.boivs.config.KeycloakProperties;
import dashen.bank.boivs.config.SessionProperties;

@SpringBootApplication
@EnableConfigurationProperties({KeycloakProperties.class, SessionProperties.class})
public class BovsApplication {
    public static void main(String[] args) {
        SpringApplication.run(BovsApplication.class, args);
    }
}
