# District of Columbia (DC)

**Rows:** 1 (state: 1)  
**Code system:** Census FIPS `11` used only as a key — DC is a single jurisdiction and the sales tax return has no location codes.  
**Completeness:** Complete for the current rate (valid through 2026-09-30). **A rate change takes effect in 16 days.**

## Sources
- OTR "Notice of Oct. 1, 2025 Tax Changes": https://otr.cfo.dc.gov/release/notice-oct-1-2025-tax-changes — general sales tax stays at 6.0% through 2026-09-30 and **rises to 7.0% for periods beginning on/after 2026-10-01** (Sales Tax Increase Delay Amendment Act of 2025, via Acts 26-0146/26-0148).
- Raw copy: `raw/DC/notice-oct-1-2025.html` (the OTR "DC Tax Rates" page returned "Access denied" to curl).

## Preparer notes
- The row carries 6% with effective_to 2026-09-30, per the "current only" rule. **October 2026 onward uses 7%.** Quantum needs a dated rate change here.
- An earlier budget draft proposed 6.5% from 2025-10-01. That version was superseded by the Delay Act, so the 6.5% rate was never in effect. Ignore third-party tables that show 6.5%.
- I searched OTR for a FY2027 budget act changing the Oct 2026 increase and found none. Re-check OTR notices before filing the first October return.
- DC's other sales tax rates (hotel 15.95% through 2027-09-30, restaurant/prepared food, parking, etc.) do not apply to vape goods.
- Vapor products may also be subject to DC's other-tobacco-products excise (64% of wholesale for TY2026). That is a separate return; confirm vapor treatment with OTR.
