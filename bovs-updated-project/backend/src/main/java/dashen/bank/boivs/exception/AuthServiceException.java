package dashen.bank.boivs.exception;

/**
 * Thrown when Keycloak itself is unreachable or returns an unexpected error
 * during login/refresh/logout.
 */
public class AuthServiceException extends RuntimeException {

    public AuthServiceException(String message) {
        super(message);
    }
}
