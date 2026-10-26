
#283375 color

# Java Spring Boot Layered Implementation — BO Identification & Verification System

Below is a professional, production-grade layered architecture using **Spring Boot 3.x**, **Java 21**, **Spring Security + Keycloak**, **JPA/Hibernate**, **MapStruct**, **Lombok**, **PostgreSQL**, and **Flyway**.

---

## 1. Project Structure

```
bo-identification-system/
├── pom.xml
├── src/main/java/com/dashen/bos/
│   ├── BoIdentificationApplication.java
│   │
│   ├── config/
│   │   ├── SecurityConfig.java
│   │   ├── KeycloakRealmRoleConverter.java
│   │   ├── JpaAuditingConfig.java
│   │   ├── OpenApiConfig.java
│   │   ├── MapStructConfig.java
│   │   └── AsyncConfig.java
│   │
│   ├── common/
│   │   ├── exception/
│   │   │   ├── GlobalExceptionHandler.java
│   │   │   ├── BusinessException.java
│   │   │   ├── ResourceNotFoundException.java
│   │   │   ├── DuplicateResourceException.java
│   │   │   ├── WorkflowException.java
│   │   │   └── ValidationException.java
│   │   ├── response/
│   │   │   ├── ApiResponse.java
│   │   │   ├── PagedResponse.java
│   │   │   └── ErrorResponse.java
│   │   ├── enums/
│   │   │   ├── RecordStatus.java
│   │   │   ├── VerificationStatus.java
│   │   │   ├── BoStatus.java
│   │   │   ├── OwnershipType.java
│   │   │   ├── ControlType.java
│   │   │   ├── WorkflowStatus.java
│   │   │   ├── WorkflowActionType.java
│   │   │   ├── RoleCode.java
│   │   │   └── Gender.java
│   │   ├── util/
│   │   │   ├── BoReferenceGenerator.java
│   │   │   ├── SecurityUtils.java
│   │   │   └── JsonUtils.java
│   │   └── audit/
│   │       ├── Auditable.java
│   │       ├── AuditListener.java
│   │       └── AuditContext.java
│   │
│   ├── domain/
│   │   ├── entity/
│   │   │   ├── AppUser.java
│   │   │   ├── AppRole.java
│   │   │   ├── AppUserRole.java
│   │   │   ├── UserSessionAudit.java
│   │   │   ├── LegalPersonType.java
│   │   │   ├── OwnershipThreshold.java
│   │   │   ├── RefDocumentType.java
│   │   │   ├── RefCountry.java
│   │   │   ├── RefNationality.java
│   │   │   ├── RefReasonCode.java
│   │   │   ├── SystemConfig.java
│   │   │   ├── LegalPerson.java
│   │   │   ├── LegalPersonDirector.java
│   │   │   ├── BeneficialOwner.java
│   │   │   ├── BoDocument.java
│   │   │   ├── OwnershipNode.java
│   │   │   ├── OwnershipEdge.java
│   │   │   ├── OwnershipClosure.java
│   │   │   ├── ControlRelationship.java
│   │   │   ├── BoOwnershipChain.java
│   │   │   ├── WorkflowInstance.java
│   │   │   ├── WorkflowAction.java
│   │   │   ├── AuditLog.java
│   │   │   ├── AuditLogDetail.java
│   │   │   └── ComplianceReport.java
│   │   └── repository/
│   │       ├── AppUserRepository.java
│   │       ├── AppRoleRepository.java
│   │       ├── LegalPersonRepository.java
│   │       ├── BeneficialOwnerRepository.java
│   │       ├── BoDocumentRepository.java
│   │       ├── OwnershipNodeRepository.java
│   │       ├── OwnershipEdgeRepository.java
│   │       ├── OwnershipClosureRepository.java
│   │       ├── ControlRelationshipRepository.java
│   │       ├── WorkflowInstanceRepository.java
│   │       ├── WorkflowActionRepository.java
│   │       ├── AuditLogRepository.java
│   │       ├── OwnershipThresholdRepository.java
│   │       └── RefDataRepository.java
│   │
│   ├── dto/
│   │   ├── request/
│   │   │   ├── LegalPersonCreateRequest.java
│   │   │   ├── LegalPersonUpdateRequest.java
│   │   │   ├── BeneficialOwnerCreateRequest.java
│   │   │   ├── BeneficialOwnerUpdateRequest.java
│   │   │   ├── BoDocumentUploadRequest.java
│   │   │   ├── OwnershipEdgeRequest.java
│   │   │   ├── ControlRelationshipRequest.java
│   │   │   ├── WorkflowDecisionRequest.java
│   │   │   ├── ThresholdConfigRequest.java
│   │   │   └── ReportRequest.java
│   │   ├── response/
│   │   │   ├── LegalPersonResponse.java
│   │   │   ├── BeneficialOwnerResponse.java
│   │   │   ├── BoDocumentResponse.java
│   │   │   ├── OwnershipGraphResponse.java
│   │   │   ├── OwnershipChainResponse.java
│   │   │   ├── WorkflowInstanceResponse.java
│   │   │   ├── AuditLogResponse.java
│   │   │   ├── DashboardStatsResponse.java
│   │   │   └── ReportResponse.java
│   │   └── internal/
│   │       ├── ThresholdEvaluationResult.java
│   │       └── OwnershipPathResult.java
│   │
│   ├── mapper/
│   │   ├── LegalPersonMapper.java
│   │   ├── BeneficialOwnerMapper.java
│   │   ├── BoDocumentMapper.java
│   │   ├── OwnershipMapper.java
│   │   ├── WorkflowMapper.java
│   │   ├── AuditLogMapper.java
│   │   └── RefDataMapper.java
│   │
│   ├── service/
│   │   ├── LegalPersonService.java
│   │   ├── BeneficialOwnerService.java
│   │   ├── BoDocumentService.java
│   │   ├── OwnershipGraphService.java
│   │   ├── OwnershipClosureService.java
│   │   ├── ThresholdEvaluationService.java
│   │   ├── WorkflowService.java
│   │   ├── AuditService.java
│   │   ├── ReportService.java
│   │   ├── ReferenceDataService.java
│   │   ├── UserSyncService.java
│   │   └── impl/
│   │       ├── LegalPersonServiceImpl.java
│   │       ├── BeneficialOwnerServiceImpl.java
│   │       ├── BoDocumentServiceImpl.java
│   │       ├── OwnershipGraphServiceImpl.java
│   │       ├── OwnershipClosureServiceImpl.java
│   │       ├── ThresholdEvaluationServiceImpl.java
│   │       ├── WorkflowServiceImpl.java
│   │       ├── AuditServiceImpl.java
│   │       ├── ReportServiceImpl.java
│   │       ├── ReferenceDataServiceImpl.java
│   │       └── UserSyncServiceImpl.java
│   │
│   ├── controller/
│   │   ├── LegalPersonController.java
│   │   ├── BeneficialOwnerController.java
│   │   ├── BoDocumentController.java
│   │   ├── OwnershipGraphController.java
│   │   ├── WorkflowController.java
│   │   ├── AuditController.java
│   │   ├── ReportController.java
│   │   ├── DashboardController.java
│   │   └── AdminController.java
│   │
│   └── security/
│       ├── JwtAuthConverter.java
│       ├── CurrentUser.java
│       └── RoleConstants.java
│
└── src/main/resources/
    ├── application.yml
    ├── application-dev.yml
    ├── application-prod.yml
    └── db/migration/
        ├── V1__init_schema.sql
        ├── V2__seed_reference_data.sql
        └── V3__views_and_indexes.sql
```

---

## 2. `pom.xml` (Key Dependencies)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.4</version>
    </parent>

    <groupId>com.dashen</groupId>
    <artifactId>bo-identification-system</artifactId>
    <version>1.0.0</version>
    <name>BO Identification and Verification System</name>

    <properties>
        <java.version>21</java.version>
        <mapstruct.version>1.6.2</mapstruct.version>
        <lombok.version>1.18.34</lombok.version>
        <springdoc.version>2.6.0</springdoc.version>
    </properties>

    <dependencies>
        <!-- Web / JPA / Validation -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Security + Keycloak -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
        </dependency>
        <dependency>
            <groupId>org.keycloak</groupId>
            <artifactId>keycloak-admin-client</artifactId>
            <version>25.0.6</version>
        </dependency>

        <!-- DB -->
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>

        <!-- MapStruct + Lombok -->
        <dependency>
            <groupId>org.mapstruct</groupId>
            <artifactId>mapstruct</artifactId>
            <version>${mapstruct.version}</version>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>${lombok.version}</version>
            <scope>provided</scope>
        </dependency>

        <!-- OpenAPI -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>${springdoc.version}</version>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <source>21</source>
                    <target>21</target>
                    <annotationProcessorPaths>
                        <path>
                            <groupId>org.mapstruct</groupId>
                            <artifactId>mapstruct-processor</artifactId>
                            <version>${mapstruct.version}</version>
                        </path>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                            <version>${lombok.version}</version>
                        </path>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok-mapstruct-binding</artifactId>
                            <version>0.2.0</version>
                        </path>
                    </annotationProcessorPaths>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

---

## 3. Enums

```java
// common/enums/RecordStatus.java
package com.dashen.bos.common.enums;

public enum RecordStatus {
    DRAFT, PENDING_VERIFICATION, VERIFIED, REJECTED, RETURNED, CEASED
}

// common/enums/VerificationStatus.java
public enum VerificationStatus { VERIFIED, PENDING, NOT_VERIFIED }

// common/enums/BoStatus.java
public enum BoStatus { ACTIVE, CEASED }

// common/enums/OwnershipType.java
public enum OwnershipType { DIRECT, INDIRECT, JOINT, CONVERTIBLE_DEBT, PREFERENTIAL }

// common/enums/ControlType.java
public enum ControlType {
    VOTING_RIGHTS, SHAREHOLDER_AGREEMENT, VOTING_AGREEMENT,
    APPOINT_REMOVE_DIRECTOR, BOARD_CONTROL, MANAGEMENT_RIGHT,
    CONVERTIBLE_INSTRUMENT, NOMINEE_ARRANGEMENT, CONTRACTUAL,
    PERSONS_ACTING_TOGETHER, OTHER_MEANS, SENIOR_MANAGING_OFFICIAL_FALLBACK
}

// common/enums/WorkflowStatus.java
public enum WorkflowStatus {
    DRAFT, PENDING_VERIFICATION, APPROVED, REJECTED, RETURNED, CANCELLED
}

// common/enums/WorkflowActionType.java
public enum WorkflowActionType { CREATE, UPDATE, CEASE, DELETE }

// common/enums/RoleCode.java
public enum RoleCode { MAKER, CHECKER, ADMIN, AUDITOR }

// common/enums/Gender.java
public enum Gender { MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY }
```

---

## 4. Entities

### 4.1 Base Auditable Entity

```java
// domain/entity/BaseAuditableEntity.java
package com.dashen.bos.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseAuditableEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private UUID updatedBy;
}
```

### 4.2 `AppUser` (Keycloak Mirror)

```java
package com.dashen.bos.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "app_user")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppUser {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;                 // = Keycloak 'sub'

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(length = 255)
    private String email;

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(name = "branch_code", length = 20)
    private String branchCode;

    @Column(length = 100)
    private String department;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "keycloak_synced_at", nullable = false)
    private Instant keycloakSyncedAt = Instant.now();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "app_user_role",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<AppRole> roles = new HashSet<>();
}
```

### 4.3 `AppRole`

```java
package com.dashen.bos.domain.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "app_role")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "role_id")
    private Integer roleId;

    @Column(name = "role_code", nullable = false, unique = true, length = 50)
    private String roleCode;

    @Column(name = "role_name", nullable = false, length = 100)
    private String roleName;

    @Column(columnDefinition = "TEXT")
    private String description;
}
```

### 4.4 `LegalPerson`

```java
package com.dashen.bos.domain.entity;

import com.dashen.bos.common.enums.RecordStatus;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "legal_person")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LegalPerson extends BaseAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "legal_person_id")
    private UUID legalPersonId;

    @Column(name = "legal_person_name", nullable = false, length = 255)
    private String legalPersonName;

    @Column(name = "registration_number", nullable = false, unique = true, length = 100)
    private String registrationNumber;

    @Column(length = 50)
    private String tin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "country_of_incorporation")
    private RefCountry countryOfIncorporation;

    @Column(name = "nature_of_business", length = 255)
    private String natureOfBusiness;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lpt_id", nullable = false)
    private LegalPersonType legalPersonType;

    @Column(name = "cif_id", length = 50)
    private String cifId;

    @Column(name = "risk_rating", length = 20)
    private String riskRating;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_status", nullable = false, length = 30)
    private RecordStatus recordStatus = RecordStatus.DRAFT;
}
```

### 4.5 `BeneficialOwner` (SCD Type-2)

```java
package com.dashen.bos.domain.entity;

import com.dashen.bos.common.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "beneficial_owner")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BeneficialOwner extends BaseAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "bo_id")
    private UUID boId;

    @Column(name = "bo_reference_number", nullable = false, unique = true, length = 50)
    private String boReferenceNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "legal_person_id", nullable = false)
    private LegalPerson legalPerson;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Gender gender;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(name = "place_of_birth", length = 150)
    private String placeOfBirth;

    @Column(name = "residential_status", length = 20)
    private String residentialStatus;

    @Column(name = "residential_address", columnDefinition = "TEXT")
    private String residentialAddress;

    @Column(length = 255)
    private String email;

    @Column(length = 50)
    private String telephone;

    @Column(length = 150)
    private String occupation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_document_type")
    private RefDocumentType idDocumentType;

    @Column(name = "id_number", length = 100)
    private String idNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "country_of_issue")
    private RefCountry countryOfIssue;

    @Column(name = "id_issue_date")
    private LocalDate idIssueDate;

    @Column(name = "id_expiry_date")
    private LocalDate idExpiryDate;

    @Column(name = "ownership_control_nature", length = 255)
    private String ownershipControlNature;

    @Enumerated(EnumType.STRING)
    @Column(name = "ownership_control_type", length = 30)
    private OwnershipType ownershipControlType;

    @Column(name = "ownership_control_extent", precision = 7, scale = 4)
    private BigDecimal ownershipControlExtent;

    @Column(name = "date_became_bo")
    private LocalDate dateBecameBo;

    @Column(name = "date_ceased_bo")
    private LocalDate dateCeasedBo;

    @Enumerated(EnumType.STRING)
    @Column(name = "bo_status", nullable = false, length = 20)
    private BoStatus boStatus = BoStatus.ACTIVE;

    @Column(name = "pep_status", nullable = false)
    private Boolean pepStatus = false;

    @Column(name = "pep_details", columnDefinition = "TEXT")
    private String pepDetails;

    @Column(name = "source_of_information", length = 50)
    private String sourceOfInformation;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;

    @Column(name = "verification_date")
    private LocalDate verificationDate;

    @Column(name = "additional_information", columnDefinition = "TEXT")
    private String additionalInformation;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_status", nullable = false, length = 30)
    private RecordStatus recordStatus = RecordStatus.DRAFT;

    @Column(name = "current_version", nullable = false)
    private Integer currentVersion = 1;

    @Column(name = "valid_from", nullable = false)
    private Instant validFrom = Instant.now();

    @Column(name = "valid_to")
    private Instant validTo;

    @Version
    private Long version;
}
```

### 4.6 `OwnershipNode` & `OwnershipEdge`

```java
package com.dashen.bos.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ownership_node")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OwnershipNode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "node_id")
    private UUID nodeId;

    @Column(name = "node_type", nullable = false, length = 20)
    private String nodeType; // LEGAL_PERSON | NATURAL_PERSON

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bo_id")
    private BeneficialOwner beneficialOwner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "legal_person_id")
    private LegalPerson legalPerson;

    @Column(name = "external_entity_name", length = 255)
    private String externalEntityName;

    @Column(name = "external_reg_number", length = 100)
    private String externalRegNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "external_country")
    private RefCountry externalCountry;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
```

```java
package com.dashen.bos.domain.entity;

import com.dashen.bos.common.enums.OwnershipType;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "ownership_edge")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OwnershipEdge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "edge_id")
    private UUID edgeId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_node_id", nullable = false)
    private OwnershipNode parentNode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "child_node_id", nullable = false)
    private OwnershipNode childNode;

    @Column(name = "ownership_pct", nullable = false, precision = 7, scale = 4)
    private BigDecimal ownershipPct;

    @Enumerated(EnumType.STRING)
    @Column(name = "ownership_type", nullable = false, length = 20)
    private OwnershipType ownershipType;

    @Column(name = "is_joint", nullable = false)
    private Boolean isJoint = false;

    @Column(name = "joint_group_id")
    private UUID jointGroupId;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_document_id")
    private BoDocument sourceDocument;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
```

### 4.7 `WorkflowInstance`

```java
package com.dashen.bos.domain.entity;

import com.dashen.bos.common.enums.*;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_instance")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkflowInstance extends BaseAuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "workflow_id")
    private UUID workflowId;

    @Column(name = "entity_type", nullable = false, length = 30)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 30)
    private WorkflowActionType actionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private WorkflowStatus status = WorkflowStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "maker_id", nullable = false)
    private AppUser maker;

    @Column(name = "maker_submitted_at")
    private Instant makerSubmittedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checker_id")
    private AppUser checker;

    @Column(name = "checker_decision_at")
    private Instant checkerDecisionAt;

    @Column(name = "decision_reason", columnDefinition = "TEXT")
    private String decisionReason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "before_snapshot", columnDefinition = "jsonb")
    private String beforeSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "after_snapshot", columnDefinition = "jsonb")
    private String afterSnapshot;

    @Column(nullable = false)
    private Integer priority = 0;
}
```

> Remaining entities (`BoDocument`, `OwnershipClosure`, `ControlRelationship`, `AuditLog`, `RefCountry`, etc.) follow the same pattern. They are omitted here for brevity but should be generated identically from the schema in Section 1.

---

## 5. Repositories

```java
// domain/repository/BeneficialOwnerRepository.java
package com.dashen.bos.domain.repository;

import com.dashen.bos.common.enums.RecordStatus;
import com.dashen.bos.domain.entity.BeneficialOwner;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BeneficialOwnerRepository extends JpaRepository<BeneficialOwner, UUID> {

    Optional<BeneficialOwner> findByBoReferenceNumber(String boReferenceNumber);

    List<BeneficialOwner> findByLegalPersonLegalPersonIdAndValidToIsNull(UUID legalPersonId);

    Page<BeneficialOwner> findByRecordStatus(RecordStatus status, Pageable pageable);

    @Query("""
        SELECT b FROM BeneficialOwner b
        WHERE b.legalPerson.legalPersonId = :lpId
          AND b.validTo IS NULL
          AND b.recordStatus = 'VERIFIED'
    """)
    List<BeneficialOwner> findActiveVerifiedByLegalPerson(@Param("lpId") UUID legalPersonId);

    @Query("""
        SELECT CASE WHEN COUNT(b) > 0 THEN TRUE ELSE FALSE END
        FROM BeneficialOwner b
        WHERE b.legalPerson.legalPersonId = :lpId
          AND b.idNumber = :idNumber
          AND b.validTo IS NULL
    """)
    boolean existsDuplicate(@Param("lpId") UUID lpId, @Param("idNumber") String idNumber);
}
```

```java
// domain/repository/OwnershipClosureRepository.java
package com.dashen.bos.domain.repository;

import com.dashen.bos.domain.entity.OwnershipClosure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OwnershipClosureRepository extends JpaRepository<OwnershipClosure, UUID> {

    @Query(value = """
        WITH RECURSIVE paths AS (
            SELECT parent_node_id AS ancestor, child_node_id AS descendant,
                   1 AS depth, ownership_pct AS path_pct, ARRAY[edge_id] AS edges
            FROM ownership_edge
            UNION ALL
            SELECT p.ancestor, e.child_node_id, p.depth + 1,
                   p.path_pct * e.ownership_pct, p.edges || e.edge_id
            FROM paths p
            JOIN ownership_edge e ON e.parent_node_id = p.descendant
            WHERE NOT e.child_node_id = ANY(p.edges)
        )
        SELECT * FROM paths
    """, nativeQuery = true)
    List<Object[]> computeClosurePaths();

    @Modifying
    @Query(value = "DELETE FROM ownership_closure WHERE ancestor_node_id IN (SELECT node_id FROM ownership_node WHERE legal_person_id = :lpId)", nativeQuery = true)
    void deleteByLegalPerson(@Param("lpId") UUID legalPersonId);
}
```

```java
// domain/repository/WorkflowInstanceRepository.java
package com.dashen.bos.domain.repository;

import com.dashen.bos.common.enums.WorkflowStatus;
import com.dashen.bos.domain.entity.WorkflowInstance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface WorkflowInstanceRepository extends JpaRepository<WorkflowInstance, UUID> {

    @Query("""
        SELECT w FROM WorkflowInstance w
        WHERE w.status = :status
        ORDER BY w.priority DESC, w.makerSubmittedAt ASC
    """)
    Page<WorkflowInstance> findPendingQueue(@Param("status") WorkflowStatus status, Pageable pageable);

    boolean existsByEntityTypeAndEntityIdAndStatus(String entityType, UUID entityId, WorkflowStatus status);
}
```

---

## 6. DTOs

### 6.1 Request DTOs

```java
// dto/request/BeneficialOwnerCreateRequest.java
package com.dashen.bos.dto.request;

import com.dashen.bos.common.enums.Gender;
import com.dashen.bos.common.enums.OwnershipType;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BeneficialOwnerCreateRequest {

    @NotNull
    private UUID legalPersonId;

    @NotBlank @Size(max = 255)
    private String fullName;

    @NotNull
    private Gender gender;

    @NotNull @Past
    private LocalDate dateOfBirth;

    @Size(max = 150)
    private String placeOfBirth;

    @NotBlank
    private String residentialStatus;

    @NotBlank
    private String residentialAddress;

    @Email @Size(max = 255)
    private String email;

    @Pattern(regexp = "^\\+?[0-9]{7,15}$", message = "Invalid telephone format")
    private String telephone;

    @Size(max = 150)
    private String occupation;

    @NotNull
    private Integer idDocumentTypeId;

    @NotBlank @Size(max = 100)
    private String idNumber;

    @NotNull
    private Integer countryOfIssueId;

    @NotNull
    private LocalDate idIssueDate;

    @NotNull @Future
    private LocalDate idExpiryDate;

    private String ownershipControlNature;

    @NotNull
    private OwnershipType ownershipControlType;

    @DecimalMin("0.0") @DecimalMax("100.0")
    private BigDecimal ownershipControlExtent;

    @NotNull
    private LocalDate dateBecameBo;

    private LocalDate dateCeasedBo;

    @NotNull
    private Boolean pepStatus;

    private String pepDetails;

    @NotBlank
    private String sourceOfInformation;

    private String additionalInformation;
}
```

### 6.2 Response DTOs

```java
// dto/response/BeneficialOwnerResponse.java
package com.dashen.bos.dto.response;

import com.dashen.bos.common.enums.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BeneficialOwnerResponse {
    private UUID boId;
    private String boReferenceNumber;
    private UUID legalPersonId;
    private String legalPersonName;
    private String fullName;
    private Gender gender;
    private LocalDate dateOfBirth;
    private String placeOfBirth;
    private String residentialStatus;
    private String residentialAddress;
    private String email;
    private String telephone;
    private String occupation;
    private String idDocumentTypeName;
    private String idNumber;
    private String countryOfIssueName;
    private LocalDate idIssueDate;
    private LocalDate idExpiryDate;
    private String ownershipControlNature;
    private OwnershipType
