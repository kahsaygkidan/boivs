-- Customer KYC profile + senior managing official fallback
ALTER TABLE legal_person ADD COLUMN tin                      VARCHAR(50);
ALTER TABLE legal_person ADD COLUMN country_of_incorporation VARCHAR(100);
ALTER TABLE legal_person ADD COLUMN nature_of_business       VARCHAR(500);
ALTER TABLE legal_person ADD COLUMN directors_and_management VARCHAR(2000);
ALTER TABLE legal_person ADD COLUMN smo_name                 VARCHAR(255);
ALTER TABLE legal_person ADD COLUMN smo_position             VARCHAR(255);
ALTER TABLE legal_person ADD COLUMN smo_justification        VARCHAR(1000);

-- Ownership tree (multi-layer structures)
CREATE TABLE ownership_node (
    id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
    legal_person_id       VARCHAR(36)   NOT NULL REFERENCES legal_person(id),
    parent_id             VARCHAR(36)   REFERENCES ownership_node(id) ON DELETE CASCADE,
    node_type             VARCHAR(20)   NOT NULL,
    name                  VARCHAR(255)  NOT NULL,
    registration_number   VARCHAR(100),
    id_number             VARCHAR(100),
    nationality           VARCHAR(100),
    ownership_percentage  NUMERIC(5,2)  NOT NULL,
    control_basis         VARCHAR(500),
    control_notes         VARCHAR(1000),
    beneficial_owner_id   VARCHAR(36)   REFERENCES beneficial_owner(id),
    created_by            VARCHAR(100)  NOT NULL,
    created_at            TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX idx_node_legal_person ON ownership_node(legal_person_id);
CREATE INDEX idx_node_parent ON ownership_node(parent_id);

-- BO verification data
ALTER TABLE beneficial_owner ADD COLUMN capacity            VARCHAR(40)   NOT NULL DEFAULT 'OWNERSHIP';
ALTER TABLE beneficial_owner ADD COLUMN ownership_chain     VARCHAR(2000);
ALTER TABLE beneficial_owner ADD COLUMN control_basis       VARCHAR(500);
ALTER TABLE beneficial_owner ADD COLUMN source_of_wealth    VARCHAR(1000);
ALTER TABLE beneficial_owner ADD COLUMN source_of_funds     VARCHAR(1000);
ALTER TABLE beneficial_owner ADD COLUMN sanctions_screened  BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE beneficial_owner ADD COLUMN ownership_node_id   VARCHAR(36);
