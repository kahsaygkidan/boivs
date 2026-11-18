
Tracing is incomplete (see the warnings). Continue anyway?
...

need to trace ownership and control through every intermediate company until you reach the natural person(s) who ultimately own or control the customer.
The NBE definition is consistent with this approach: a beneficial owner is a natural person who ultimately owns or controls the customer, including someone exercising ultimate effective control over a legal person. 
Recommended UBO registration process
10.1. Identify the customer/legal entity
•	Company name
•	Registration number
•	TIN
•	Country of incorporation
•	Nature of business
•	Directors and senior management
10.2. Obtain the ownership structure
For example:
ABC Manufacturing PLC
        │
        ├── 60% → XYZ Holdings Ltd
        │             │
        │             └── 70% → Mr. A
        │
        └── 40% → Mr. B
You should not register XYZ Holdings Ltd as the final UBO because it is a legal person.
Trace the chain:
•	XYZ Holdings Ltd → 70% owned by Mr. A
•	ABC Manufacturing PLC → 60% owned by XYZ
•	Mr. A's indirect interest = 60% × 70% = 42%
•	Mr. B's direct interest = 40%
Therefore, Mr. A and Mr. B would need to be assessed as UBOs under the applicable ownership/control criteria.
10.3. Continue through multiple layers
For example:
Customer Company
       │
       ▼
Holding Company A
       │
       ▼
Holding Company B
       │
       ▼
Investment Company C
       │
       ▼
Natural Person
The KYC officer should continue tracing until reaching the natural person(s) at the end of the ownership/control chain. FATF specifically recognizes indirect ownership through chains of corporate vehicles. 
10.4. Examine control, not only percentage ownership
A person may be a UBO because of control, even where their direct shareholding is below the applicable ownership threshold.
Check for:
•	Voting rights
•	Shareholder agreements
•	Voting agreements
•	Power to appoint/remove directors
•	Board control
•	Management/control rights
•	Convertible instruments
•	Nominee arrangements
•	Other contractual arrangements
•	Persons acting together
•	Other means of exercising ultimate effective control
FATF emphasizes that beneficial ownership can arise through ownership or other means of ultimate effective control. 
10.5. Apply the senior managing official fallback
If, after taking reasonable measures, no natural person can be identified as exercising control through ownership or other means, the CDD process should identify the appropriate senior managing official and record that capacity.
Importantly, this does not mean that the CEO automatically becomes the UBO. It is a fallback for CDD where the actual controlling natural person cannot be identified after reasonable measures. 
10.6. Verify each UBO
For each identified natural-person UBO, obtain and verify appropriate information such as:
UBO information	Example
Full name	Mr. A
Nationality	Ethiopian
Date of birth	DD/MM/YYYY
ID/passport	Verified document
Address	Residential address
Ownership %	42% indirect
Direct/indirect	Indirect
Ownership chain	ABC → XYZ → Mr. A
Control basis	Ownership/voting/control
PEP status	Screened
Sanctions	Screened
Source of wealth	Obtained where required
Source of funds	Obtained where required
FATF recommends that beneficial ownership information be adequate, accurate and up to date, with reasonable measures taken to verify the identity and BO status of the identified persons. 
For a bank's UBO system
For a Dashen Bank KYC/CDD system, I would recommend that the UBO module support a UBO ownership tree, rather than having only one "UBO Name" field:
CUSTOMER
   │
   ├── Shareholder 1 – Company
   │       │
   │       ├── Shareholder A – Company
   │       │       └── Natural Person UBO
   │       │
   │       └── Shareholder B – Individual
   │
   └── Shareholder 2 – Individual
The system should automatically calculate direct and indirect ownership percentages, maintain the ownership chain, identify control relationships, and retain documentary evidence.
