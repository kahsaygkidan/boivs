CREATE TABLE legal_person (
    id                   VARCHAR2(36)   NOT NULL PRIMARY KEY,
    name                 VARCHAR2(255)  NOT NULL,
    registration_number  VARCHAR2(100)  NOT NULL UNIQUE,
    entity_type          VARCHAR2(50)   NOT NULL,
    created_by           VARCHAR2(100)  NOT NULL,
    created_at           TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE TABLE bo_sequence (
    seq_year   NUMBER(4) PRIMARY KEY,
    last_value NUMBER(10) NOT NULL
);

CREATE TABLE beneficial_owner (
    id                    VARCHAR2(36)   NOT NULL PRIMARY KEY,
    bo_reference          VARCHAR2(30)   NOT NULL UNIQUE,
    legal_person_id       VARCHAR2(36)   NOT NULL REFERENCES legal_person(id),
    full_name             VARCHAR2(255)  NOT NULL,
    date_of_birth         DATE           NOT NULL,
    id_document_type      VARCHAR2(50)   NOT NULL,
    id_number             VARCHAR2(100)  NOT NULL,
    nationality           VARCHAR2(100)  NOT NULL,
    country_of_issue      VARCHAR2(100)  NOT NULL,
    date_of_expiry        DATE           NOT NULL,
    ownership_type        VARCHAR2(50)   NOT NULL,
    ownership_percentage  NUMBER(5,2)    NOT NULL,
    date_became_bo        DATE           NOT NULL,
    is_pep                NUMBER(1)      DEFAULT 0 NOT NULL,
    pep_details           VARCHAR2(1000),
    status                VARCHAR2(30)   DEFAULT 'DRAFT' NOT NULL,
    rejection_reason      VARCHAR2(1000),
    created_by            VARCHAR2(100)  NOT NULL,
    created_at            TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
    updated_by            VARCHAR2(100),
    updated_at            TIMESTAMP,
    decided_by            VARCHAR2(100),
    decided_at            TIMESTAMP
);

CREATE INDEX idx_bo_status ON beneficial_owner(status);
CREATE INDEX idx_bo_legal_person ON beneficial_owner(legal_person_id);
CREATE INDEX idx_bo_pep ON beneficial_owner(is_pep);

CREATE TABLE bo_document (
    id                    VARCHAR2(36)   NOT NULL PRIMARY KEY,
    beneficial_owner_id   VARCHAR2(36)   NOT NULL REFERENCES beneficial_owner(id) ON DELETE CASCADE,
    file_name             VARCHAR2(255)  NOT NULL,
    content_type          VARCHAR2(150),
    size_bytes            NUMBER(19),
    storage_path          VARCHAR2(500)  NOT NULL,
    uploaded_by           VARCHAR2(100)  NOT NULL,
    uploaded_at           TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE TABLE audit_log (
    id              VARCHAR2(36)   NOT NULL PRIMARY KEY,
    entity_type     VARCHAR2(50)   NOT NULL,
    entity_ref      VARCHAR2(60)   NOT NULL,
    action          VARCHAR2(50)   NOT NULL,
    actor_username  VARCHAR2(100)  NOT NULL,
    actor_roles     VARCHAR2(255),
    details         VARCHAR2(2000),
    created_at      TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_entity_ref ON audit_log(entity_ref);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
