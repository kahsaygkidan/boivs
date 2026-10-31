package dashen.bank.boivs.web;

import dashen.bank.boivs.dto.DashboardStatsResponse;
import dashen.bank.boivs.service.BeneficialOwnerService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final BeneficialOwnerService beneficialOwnerService;

    public DashboardController(BeneficialOwnerService beneficialOwnerService) {
        this.beneficialOwnerService = beneficialOwnerService;
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('MAKER','CHECKER','AUDITOR','ADMIN')")
    public DashboardStatsResponse stats() {
        return beneficialOwnerService.stats();
    }
}
