package dashen.bank.boivs.web;

import dashen.bank.boivs.domain.enums.BoStatus;
import dashen.bank.boivs.dto.BeneficialOwnerCreateRequest;
import dashen.bank.boivs.dto.BeneficialOwnerResponse;
import dashen.bank.boivs.dto.BeneficialOwnerUpdateRequest;
import dashen.bank.boivs.dto.DecisionRequest;
import dashen.bank.boivs.service.BeneficialOwnerService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bo-records")
public class BeneficialOwnerController {

    private final BeneficialOwnerService beneficialOwnerService;

    public BeneficialOwnerController(BeneficialOwnerService beneficialOwnerService) {
        this.beneficialOwnerService = beneficialOwnerService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public ResponseEntity<BeneficialOwnerResponse> create(
            @Valid @RequestBody BeneficialOwnerCreateRequest request,
            @RequestParam(defaultValue = "true") boolean submit) {
        var saved = beneficialOwnerService.create(request, submit);
        return ResponseEntity.status(HttpStatus.CREATED).body(BeneficialOwnerResponse.from(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public BeneficialOwnerResponse update(@PathVariable String id,
                                          @RequestBody BeneficialOwnerUpdateRequest request) {
        return BeneficialOwnerResponse.from(beneficialOwnerService.update(id, request));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public BeneficialOwnerResponse submit(@PathVariable String id) {
        return BeneficialOwnerResponse.from(beneficialOwnerService.submit(id));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('CHECKER','ADMIN')")
    public BeneficialOwnerResponse approve(@PathVariable String id) {
        return BeneficialOwnerResponse.from(beneficialOwnerService.approve(id));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('CHECKER','ADMIN')")
    public BeneficialOwnerResponse reject(@PathVariable String id, @RequestBody DecisionRequest request) {
        return BeneficialOwnerResponse.from(beneficialOwnerService.reject(id, request.reason()));
    }

    @PostMapping("/{id}/cease")
    @PreAuthorize("hasAnyRole('CHECKER','ADMIN')")
    public BeneficialOwnerResponse cease(@PathVariable String id, @RequestBody(required = false) DecisionRequest request) {
        String reason = request != null ? request.reason() : null;
        return BeneficialOwnerResponse.from(beneficialOwnerService.cease(id, reason));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public Page<BeneficialOwnerResponse> search(
            @RequestParam(required = false) BoStatus status,
            @RequestParam(required = false) Boolean pep,
            @RequestParam(required = false) String createdBy,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return beneficialOwnerService.search(status, pep, createdBy, q, pageable).map(BeneficialOwnerResponse::from);
    }

    @GetMapping("/queue")
    @PreAuthorize("hasAnyRole('CHECKER','ADMIN')")
    public Page<BeneficialOwnerResponse> queue(Pageable pageable) {
        return beneficialOwnerService.queue(pageable).map(BeneficialOwnerResponse::from);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public BeneficialOwnerResponse get(@PathVariable String id) {
        return BeneficialOwnerResponse.from(beneficialOwnerService.getById(id));
    }

    @GetMapping("/by-reference/{reference}")
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public BeneficialOwnerResponse getByReference(@PathVariable String reference) {
        return BeneficialOwnerResponse.from(beneficialOwnerService.getByReference(reference));
    }

    /** Removes (withdraws) a record that is still a draft or pending verification. */
   @DeleteMapping("/{id}")
   @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
   public ResponseEntity<Void> remove(@PathVariable String id, @RequestParam(required = false) String reason) {
               beneficialOwnerService.withdraw(id, reason);
               return ResponseEntity.noContent().build();
           }
}