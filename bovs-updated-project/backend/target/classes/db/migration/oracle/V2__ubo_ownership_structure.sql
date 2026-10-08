-- Customer KYC profile + senior managing official fallback
ALTER TABLE legal_person ADD (
    tin                      VARCHAR2(50),
    country_of_incorporation VARCHAR2(100),
    nature_of_business       VARCHAR2(500),
    directors_and_management VARCHAR2(2000),
    smo_name                 VARCHAR2(255),
    smo_position             VARCHAR2(255),
    smo_justification        VARCHAR2(1000)
);

-- Ownership tree (multi-layer structures)
CREATE TABLE ownership_node (
    id                    VARCHAR2(36)   NOT NULL PRIMARY KEY,
    legal_person_id       VARCHAR2(36)   NOT NULL REFERENCES legal_person(id),
    parent_id             VARCHAR2(36)   REFERENCES ownership_node(id) ON DELETE CASCADE,
    node_type             VARCHAR2(20)   NOT NULL,
    name                  VARCHAR2(255)  NOT NULL,
    registration_number   VARCHAR2(100),
    id_number             VARCHAR2(100),
    nationality           VARCHAR2(100),
    ownership_percentage  NUMBER(5,2)    NOT NULL,
    control_basis         VARCHAR2(500),
    control_notes         VARCHAR2(1000),
    beneficial_owner_id   VARCHAR2(36)   REFERENCES beneficial_owner(id),
    created_by            VARCHAR2(100)  NOT NULL,
    created_at            TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_node_legal_person ON ownership_node(legal_person_id);
CREATE INDEX idx_node_parent ON ownership_node(parent_id);

-- BO verification data
ALTER TABLE beneficial_owner ADD (
    capacity            VARCHAR2(40)   DEFAULT 'OWNERSHIP' NOT NULL,
    ownership_chain     VARCHAR2(2000),
    control_basis       VARCHAR2(500),
    source_of_wealth    VARCHAR2(1000),
    source_of_funds     VARCHAR2(1000),
    sanctions_screened  NUMBER(1)      DEFAULT 0 NOT NULL,
    ownership_node_id   VARCHAR2(36)
);
