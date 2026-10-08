CREATE TABLE legal_person (
    id                   VARCHAR(36)   NOT NULL PRIMARY KEY,
    name                 VARCHAR(255)  NOT NULL,
    registration_number  VARCHAR(100)  NOT NULL UNIQUE,
    entity_type          VARCHAR(50)   NOT NULL,
    created_by           VARCHAR(100)  NOT NULL,
    created_at           TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE TABLE bo_sequence (
    seq_year   INT PRIMARY KEY,
    last_value INT NOT NULL
);

CREATE TABLE beneficial_owner (
    id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
    bo_reference          VARCHAR(30)   NOT NULL UNIQUE,
    legal_person_id       VARCHAR(36)   NOT NULL REFERENCES legal_person(id),
    full_name             VARCHAR(255)  NOT NULL,
    date_of_birth         DATE          NOT NULL,
    id_document_type      VARCHAR(50)   NOT NULL,
    id_number             VARCHAR(100)  NOT NULL,
    nationality           VARCHAR(100)  NOT NULL,
    country_of_issue      VARCHAR(100)  NOT NULL,
    date_of_expiry        DATE          NOT NULL,
    ownership_type        VARCHAR(50)   NOT NULL,
    ownership_percentage  NUMERIC(5,2)  NOT NULL,
    date_became_bo        DATE          NOT NULL,
    is_pep                BOOLEAN       NOT NULL DEFAULT FALSE,
    pep_details           VARCHAR(1000),
    status                VARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
    rejection_reason      VARCHAR(1000),
    created_by            VARCHAR(100)  NOT NULL,
    created_at            TIMESTAMP     NOT NULL DEFAULT now(),
    updated_by            VARCHAR(100),
    updated_at            TIMESTAMP,
    decided_by            VARCHAR(100),
    decided_at            TIMESTAMP
);

CREATE INDEX idx_bo_status ON beneficial_owner(status);
CREATE INDEX idx_bo_legal_person ON beneficial_owner(legal_person_id);
CREATE INDEX idx_bo_pep ON beneficial_owner(is_pep);

CREATE TABLE bo_document (
    id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
    beneficial_owner_id   VARCHAR(36)   NOT NULL REFERENCES beneficial_owner(id) ON DELETE CASCADE,
    file_name             VARCHAR(255)  NOT NULL,
    content_type          VARCHAR(150),
    size_bytes            BIGINT,
    storage_path          VARCHAR(500)  NOT NULL,
    uploaded_by           VARCHAR(100)  NOT NULL,
    uploaded_at           TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    entity_type     VARCHAR(50)   NOT NULL,
    entity_ref      VARCHAR(60)   NOT NULL,
    action          VARCHAR(50)   NOT NULL,
    actor_username   VARCHAR(100)  NOT NULL,
    actor_roles     VARCHAR(255),
    details         VARCHAR(2000),
    created_at      TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity_ref ON audit_log(entity_ref);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
