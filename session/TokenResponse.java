package dashen.bank.boivs.dto;

import java.util.List;

public record TokenResponse(
        String accessToken,
        String refreshToken,
        long expiresIn,
        long refreshExpiresIn,
        String tokenType,
        String username,
        List<String> roles
        ) {

}
