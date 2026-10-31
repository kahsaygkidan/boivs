package dashen.bank.boivs.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import dashen.bank.boivs.domain.BeneficialOwner;
import dashen.bank.boivs.domain.enums.BoStatus;

public interface BeneficialOwnerRepository extends JpaRepository<BeneficialOwner, String> {

    Optional<BeneficialOwner> findByBoReference(String boReference);

    Page<BeneficialOwner> findByStatus(BoStatus status, Pageable pageable);

    // --- Fetch variants used for reads that get mapped to a response DTO ---------------
    // legalPerson is @ManyToOne(LAZY) and open-in-view is false, so the plain finders above
    // hand back a proxy that's no longer attached to a session by the time the controller
    // maps it to BeneficialOwnerResponse (b.getLegalPerson().getName()) — that throws
    // LazyInitializationException, which the generic handler turns into a bare 500. These
    // JOIN FETCH the association inside the query itself so it's already initialized.
    @Query("select b from BeneficialOwner b left join fetch b.legalPerson where b.id = :id")
    Optional<BeneficialOwner> findByIdFetchLegalPerson(@Param("id") String id);

    @Query("select b from BeneficialOwner b left join fetch b.legalPerson where b.boReference = :boReference")
    Optional<BeneficialOwner> findByBoReferenceFetchLegalPerson(@Param("boReference") String boReference);

    @Query(value = "select b from BeneficialOwner b left join fetch b.legalPerson where b.status = :status",
            countQuery = "select count(b) from BeneficialOwner b where b.status = :status")
    Page<BeneficialOwner> findByStatusFetchLegalPerson(@Param("status") BoStatus status, Pageable pageable);

    @Query(value = """
    select b from BeneficialOwner b left join fetch b.legalPerson
    where (:status is null or b.status = :status)
      and (b.status <> dashen.bank.boivs.domain.enums.BoStatus.WITHDRAWN)
      and (:pep is null or b.pep = :pep)
      and (:createdBy is null or b.createdBy = cast(:createdBy as string))
      and (:search is null
           or lower(b.fullName) like lower(concat('%', cast(:search as string), '%'))
           or lower(b.phoneNumber) like lower(concat('%', cast(:search as string), '%'))
           or lower(b.boReference) like lower(concat('%', cast(:search as string), '%'))
           or (cast(:phoneDigits as string) is not null
               and replace(replace(replace(replace(replace(b.phoneNumber, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '')
                   like concat('%', cast(:phoneDigits as string), '%')))
    """,
            countQuery = """
    select count(b) from BeneficialOwner b
    where (:status is null or b.status = :status)
      and (b.status <> dashen.bank.boivs.domain.enums.BoStatus.WITHDRAWN)
      and (:pep is null or b.pep = :pep)
      and (:createdBy is null or b.createdBy = cast(:createdBy as string))
      and (:search is null
           or lower(b.fullName) like lower(concat('%', cast(:search as string), '%'))
           or lower(b.phoneNumber) like lower(concat('%', cast(:search as string), '%'))
           or lower(b.boReference) like lower(concat('%', cast(:search as string), '%'))
           or (cast(:phoneDigits as string) is not null
               and replace(replace(replace(replace(replace(b.phoneNumber, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '')
                   like concat('%', cast(:phoneDigits as string), '%')))
    """)
    Page<BeneficialOwner> search(@Param("status") BoStatus status,
                                 @Param("pep") Boolean pep,
                                 @Param("createdBy") String createdBy,
                                 @Param("search") String search,
                                 @Param("phoneDigits") String phoneDigits,
                                 Pageable pageable);

    long countByStatus(BoStatus status);

    long countByPepTrue();
}
