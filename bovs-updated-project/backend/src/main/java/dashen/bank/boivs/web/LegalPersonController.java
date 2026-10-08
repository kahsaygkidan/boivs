package dashen.bank.boivs.web;

import dashen.bank.boivs.dto.LegalPersonRequest;
import dashen.bank.boivs.dto.LegalPersonResponse;
import dashen.bank.boivs.service.LegalPersonService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/legal-persons")
public class LegalPersonController {

    private final LegalPersonService legalPersonService;

    public LegalPersonController(LegalPersonService legalPersonService) {
        this.legalPersonService = legalPersonService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public ResponseEntity<LegalPersonResponse> create(@Valid @RequestBody LegalPersonRequest request) {
        var saved = legalPersonService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(LegalPersonResponse.from(saved));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public Page<LegalPersonResponse> list(Pageable pageable) {
        return legalPersonService.findAll(pageable).map(LegalPersonResponse::from);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public LegalPersonResponse get(@PathVariable String id) {
        return LegalPersonResponse.from(legalPersonService.getById(id));
    }
}
