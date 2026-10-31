package dashen.bank.boivs.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumSet;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import dashen.bank.boivs.domain.enums.EntityType;
import dashen.bank.boivs.domain.enums.Sector;

/**
 * Beneficial-ownership tests per Regulation No. 592/2026 (Transparency of Legal Persons'
 * Beneficial Ownership Information). Keep in step with getThresholdInfo() in the front-end uboForm.js.
 *
 * Entity types the regulation table does not cover (e.g. PUBLIC_LIMITED_COMPANY, TRUST) and foreign legal
 * persons (no threshold in the table) use the configurable fallback bovs.ubo.ownership-threshold (default 25)
 * on plain ownership.
 */
@Component
public class BoThresholdPolicy {

    /** Sectors that reduce the Share Company threshold from 10% to 5%. */
    private static final Set<Sector> REDUCED_THRESHOLD_SECTORS =
            EnumSet.of(Sector.MINING, Sector.REAL_ESTATE, Sector.MOTOR_DEALERSHIP, Sector.IMPORT_EXPORT);

    /** Absorbs decimal noise from multiplying percentages through ownership chains. */
    private static final BigDecimal EPSILON = new BigDecimal("0.0001");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int SCALE = 8;

    public enum Mode {
        /** Regulated percentage test: any listed criterion >= threshold, or control. */
        PERCENTAGE,
        /** One Member PLC: the owner (any holding) and the general manager / controller (control basis). */
        OWNER_PLUS_MANAGER,
        /** No rule in the regulation table: configurable fallback percentage on plain ownership. */
        FALLBACK
    }

    /** What can make a person a beneficial owner by holding (control is handled separately). */
    public enum Criterion {
        OWNERSHIP, CONVERTIBLE_DEBT, PREFERENTIAL_SHARES, PROFIT, DISSOLUTION, VOTING
    }

    /**
     * threshold is null only for OWNER_PLUS_MANAGER. jointAllowed: individuals in the same joint group
     * (persons holding jointly) are tested on their combined stake.
     */
    public record Rule(Mode mode, BigDecimal threshold, Set<Criterion> criteria, boolean jointAllowed) {

    }

    /**
     * A person's effective stake in the customer, per criterion, after multiplying through every layer.
     * Profit / dissolution / voting default to the ownership percentage when not given separately.
     */
    public record Stake(BigDecimal ownership, BigDecimal profit, BigDecimal dissolution, BigDecimal voting,
                        BigDecimal convertibleDebt, boolean preferentialShares) {

        public static Stake zero() {
            return new Stake(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, false);
        }

        /** The customer itself: 100% of everything. */
        public static Stake root() {
            return new Stake(HUNDRED, HUNDRED, HUNDRED, HUNDRED, HUNDRED, false);
        }

        /** A plain ownership stake (profit / dissolution / voting follow ownership). */
        public static Stake ofOwnership(BigDecimal pct) {
            return new Stake(pct, pct, pct, pct, BigDecimal.ZERO, false);
        }

        /**
         * Stake obtained through one more layer: this (the parent's effective stake) x the node's direct
         * percentages. A null profit/dissolution/voting means "same as ownership"; a null debt means 0.
         */
        public Stake through(BigDecimal own, BigDecimal profitPct, BigDecimal dissolutionPct, BigDecimal votingPct,
                             BigDecimal debtPct, boolean preferential) {
            BigDecimal o = own == null ? BigDecimal.ZERO : own;
            return new Stake(
                    mul(ownership, o),
                    mul(profit, profitPct == null ? o : profitPct),
                    mul(dissolution, dissolutionPct == null ? o : dissolutionPct),
                    mul(voting, votingPct == null ? o : votingPct),
                    mul(convertibleDebt, debtPct == null ? BigDecimal.ZERO : debtPct),
                    preferential);
        }

        public Stake plus(Stake o) {
            return new Stake(ownership.add(o.ownership), profit.add(o.profit), dissolution.add(o.dissolution),
                    voting.add(o.voting), convertibleDebt.add(o.convertibleDebt),
                    preferentialShares || o.preferentialShares);
        }

        private static BigDecimal mul(BigDecimal parent, BigDecimal pct) {
            return parent.multiply(pct).divide(HUNDRED, SCALE, RoundingMode.HALF_UP);
        }
    }

    private final BigDecimal fallbackThreshold;

    public BoThresholdPolicy(@Value("${bovs.ubo.ownership-threshold:25}") BigDecimal fallbackThreshold) {
        this.fallbackThreshold = fallbackThreshold;
    }

    public Rule resolve(EntityType type, Sector sector) {
        if (type == null) {
            return fallback();
        }
        return switch (type) {
            case SHARE_COMPANY -> new Rule(Mode.PERCENTAGE,
                    new BigDecimal(sector != null && REDUCED_THRESHOLD_SECTORS.contains(sector) ? "5" : "10"),
                    EnumSet.of(Criterion.OWNERSHIP, Criterion.CONVERTIBLE_DEBT, Criterion.PREFERENTIAL_SHARES), true);
            case PRIVATE_LIMITED_COMPANY -> new Rule(Mode.PERCENTAGE, new BigDecimal("5"),
                    EnumSet.of(Criterion.OWNERSHIP), true);
            case FINANCIAL_INSTITUTION -> new Rule(Mode.PERCENTAGE, new BigDecimal("2"),
                    EnumSet.of(Criterion.OWNERSHIP, Criterion.CONVERTIBLE_DEBT), true);
            case GENERAL_PARTNERSHIP, LIMITED_PARTNERSHIP -> new Rule(Mode.PERCENTAGE, new BigDecimal("25"),
                    EnumSet.of(Criterion.PROFIT, Criterion.DISSOLUTION, Criterion.VOTING), false);
            case LIMITED_LIABILITY_PARTNERSHIP -> new Rule(Mode.PERCENTAGE, new BigDecimal("25"),
                    EnumSet.of(Criterion.PROFIT, Criterion.DISSOLUTION), false);
            case PPP -> new Rule(Mode.PERCENTAGE, new BigDecimal("25"),
                    EnumSet.of(Criterion.OWNERSHIP, Criterion.DISSOLUTION), false);
            case ONE_MEMBER_PLC -> new Rule(Mode.OWNER_PLUS_MANAGER, null, EnumSet.of(Criterion.OWNERSHIP), false);
            default -> fallback();
        };
    }

    /** The criteria this stake satisfies (inclusive >= with a small rounding tolerance). Empty = none. */
    public Set<Criterion> qualifyingCriteria(Rule rule, Stake stake) {
        Set<Criterion> met = EnumSet.noneOf(Criterion.class);
        if (rule == null || stake == null) {
            return met;
        }
        if (rule.mode() == Mode.OWNER_PLUS_MANAGER) {
            if (stake.ownership().signum() > 0) {
                met.add(Criterion.OWNERSHIP);
            }
            return met;
        }
        for (Criterion c : rule.criteria()) {
            boolean ok = switch (c) {
                case OWNERSHIP -> reaches(stake.ownership(), rule.threshold());
                case PROFIT -> reaches(stake.profit(), rule.threshold());
                case DISSOLUTION -> reaches(stake.dissolution(), rule.threshold());
                case VOTING -> reaches(stake.voting(), rule.threshold());
                case CONVERTIBLE_DEBT -> stake.convertibleDebt().signum() > 0
                        && reaches(stake.convertibleDebt(), rule.threshold());
                case PREFERENTIAL_SHARES -> stake.preferentialShares();
            };
            if (ok) {
                met.add(c);
            }
        }
        return met;
    }

    public boolean qualifiesByOwnership(Rule rule, Stake stake) {
        return !qualifyingCriteria(rule, stake).isEmpty();
    }

    /** Convenience for a plain ownership percentage. */
    public boolean qualifiesByOwnership(Rule rule, BigDecimal ownershipPercentage) {
        return ownershipPercentage != null && qualifiesByOwnership(rule, Stake.ofOwnership(ownershipPercentage));
    }

    private static boolean reaches(BigDecimal value, BigDecimal threshold) {
        return value.add(EPSILON).compareTo(threshold) >= 0;
    }

    private Rule fallback() {
        return new Rule(Mode.FALLBACK, fallbackThreshold, EnumSet.of(Criterion.OWNERSHIP), false);
    }
}
