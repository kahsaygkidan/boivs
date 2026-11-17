
package dashen.bank.boivs.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

import dashen.bank.boivs.dto.SeniorManagingOfficialRequest;
import dashen.bank.boivs.dto.SeniorManagingOfficialResponse;
import dashen.bank.boivs.dto.SeniorManagingOfficialVerificationRequest;
import dashen.bank.boivs.service.SeniorManagingOfficialService;

@RestController
@RequestMapping(
    "/api/legal-persons/{legalPersonId}/senior-managing-officials"
)
public class SeniorManagingOfficialController {

    private final SeniorManagingOfficialService service;

    public SeniorManagingOfficialController(
            SeniorManagingOfficialService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<SeniorManagingOfficialResponse>> findAll(
            @PathVariable String legalPersonId) {

        return ResponseEntity.ok(service.findAll(legalPersonId));
    }

    @GetMapping("/{officialId}")
    public ResponseEntity<SeniorManagingOfficialResponse> findById(
            @PathVariable String legalPersonId,
            @PathVariable String officialId) {

        return ResponseEntity.ok(
                service.findById(legalPersonId, officialId)
        );
    }

    @PostMapping
    public ResponseEntity<SeniorManagingOfficialResponse> create(
            @PathVariable String legalPersonId,
            @Valid @RequestBody SeniorManagingOfficialRequest request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(legalPersonId, request));
    }

    @PutMapping("/{officialId}")
    public ResponseEntity<SeniorManagingOfficialResponse> update(
            @PathVariable String legalPersonId,
            @PathVariable String officialId,
            @Valid @RequestBody SeniorManagingOfficialRequest request) {

        return ResponseEntity.ok(
                service.update(legalPersonId, officialId, request)
        );
    }

    @DeleteMapping("/{officialId}")
    public ResponseEntity<Void> delete(
            @PathVariable String legalPersonId,
            @PathVariable String officialId) {

        service.delete(legalPersonId, officialId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{officialId}/verification")
    public ResponseEntity<SeniorManagingOfficialResponse> verify(
            @PathVariable String legalPersonId,
            @PathVariable String officialId,
            @Valid @RequestBody
            SeniorManagingOfficialVerificationRequest request) {

        return ResponseEntity.ok(
                service.updateVerification(
                        legalPersonId,
                        officialId,
                        request.status(),
                        request.notes()
                )
        );
    }
}
