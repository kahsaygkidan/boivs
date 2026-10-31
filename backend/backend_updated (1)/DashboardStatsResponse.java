package dashen.bank.boivs.dto;





public record DashboardStatsResponse(
        long total,
        long verified,
        long pending,
        long rejected,
        long ceased,
        long pepFlagged
        ) {

}
