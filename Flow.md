Here is the UBO identification flow built from your document. Gray boxes are process steps, amber boxes are decisions, and purple boxes are the loops and fallbacks.

- **Layer loop (right, top):** If a shareholder is a company, you drill into its owners and return to the ownership-structure step. This repeats until every branch ends at a natural person. In your example, XYZ Holdings leads to Mr. A at 60% × 70% = 42%.
- **Ownership and control test:** The percentage calculation alone isn't enough. This step also checks voting rights, shareholder agreements, board appointment powers, nominees and persons acting together, so someone below the threshold can still be a UBO.
- **Senior managing official fallback (right, bottom):** This applies only if no natural person is found after reasonable measures. The official is recorded with their capacity and is not treated as the UBO.
- **Verification and storage:** For each UBO, verify ID, PEP and sanctions status, and source of wealth or funds where required. Then save the full tree with the chain, percentages and evidence.

For the bank's UBO module, the flow implies a few system requirements:
- A tree data model instead of a single "UBO name" field.
- Automatic calculation of direct and indirect percentages.
- A loop that prevents a case from closing while any branch ends at a legal entity.
- A flag for the fallback case, so a senior managing official can't be mistaken for a UBO.

Click any box to dig into that step. I can also draw the ownership-tree data model or a screen-level workflow for the KYC officer.
