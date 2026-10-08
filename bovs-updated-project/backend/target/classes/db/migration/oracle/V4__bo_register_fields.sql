ALTER TABLE beneficial_owner ADD (
    gender                 VARCHAR2(20),
    place_of_birth         VARCHAR2(255),
    residential_status     VARCHAR2(20),
    email_address          VARCHAR2(255),
    phone_number           VARCHAR2(50),
    occupation             VARCHAR2(255),
    date_of_issue          DATE,
    ownership_nature       VARCHAR2(500),
    date_ceased            DATE,
    source_of_information  VARCHAR2(40),
    additional_information VARCHAR2(2000),
    verification_date      TIMESTAMP
);
