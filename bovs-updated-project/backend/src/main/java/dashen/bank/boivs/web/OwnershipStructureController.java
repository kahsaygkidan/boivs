package dashen.bank.boivs.web;

import dashen.bank.boivs.dto.LegalPersonProfileRequest;
import dashen.bank.boivs.dto.LegalPersonResponse;
import dashen.bank.boivs.dto.NodeControlRequest;
import dashen.bank.boivs.dto.OwnershipNodeRequest;
import dashen.bank.boivs.dto.OwnershipTreeResponse;
import dashen.bank.boivs.dto.SeniorManagingOfficialRequest;
import dashen.bank.boivs.service.LegalPersonService;
import dashen.bank.boivs.service.OwnershipStructureService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/legal-persons/{legalPersonId}")
public class OwnershipStructureController {

    private final OwnershipStructureService structureService;
    private final LegalPersonService legalPersonService;

    public OwnershipStructureController(OwnershipStructureService structureService,
            LegalPersonService legalPersonService) {
        this.structureService = structureService;
        this.legalPersonService = legalPersonService;
    }

    /** Ownership tree with calculated effective %, UBO assessment and tracing warnings. */
    @GetMapping("/ownership-tree")
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public OwnershipTreeResponse tree(@PathVariable String legalPersonId) {
        return structureService.getTree(legalPersonId);
    }

    @PostMapping("/ownership-nodes")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public ResponseEntity<OwnershipTreeResponse> addNode(@PathVariable String legalPersonId,
            @Valid @RequestBody OwnershipNodeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(structureService.addNode(legalPersonId, request));
    }

    @DeleteMapping("/ownership-nodes/{nodeId}")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public OwnershipTreeResponse deleteNode(@PathVariable String legalPersonId, @PathVariable String nodeId) {
        return structureService.deleteNode(legalPersonId, nodeId);
    }

    @PutMapping("/ownership-nodes/{nodeId}/control")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public OwnershipTreeResponse updateControl(@PathVariable String legalPersonId, @PathVariable String nodeId,
            @RequestBody NodeControlRequest request) {
        return structureService.updateControl(legalPersonId, nodeId, request);
    }

    @PutMapping("/senior-managing-official")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public OwnershipTreeResponse saveSenior(@PathVariable String legalPersonId,
            @Valid @RequestBody SeniorManagingOfficialRequest request) {
        return structureService.saveSeniorManagingOfficial(legalPersonId, request);
    }

    @PutMapping("/profile")
    @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
    public LegalPersonResponse updateProfile(@PathVariable String legalPersonId,
            @RequestBody LegalPersonProfileRequest request) {
        return LegalPersonResponse.from(legalPersonService.updateProfile(legalPersonId, request));
    }
}
