/**
 * Seed of the editable rule tables, transcribed from doc 03 (state playbook)
 * and doc 09 (data tables). Everything here is EDITABLE in the dashboard after
 * seeding - this file is only the starting point, never the runtime source.
 *
 * VERIFY EVERY RATE, FREQUENCY AND DUE DAY ON THE STATE PORTAL QUARTERLY.
 */

export const DEFAULT_EFFECTIVE_FROM = "2026-01-01";
/**
 * PACT starts a month earlier than the tax configs: the Suorin USA shipment
 * history begins with December 2025 (reported by 10 January 2026).
 */
export const PACT_EFFECTIVE_FROM = "2025-12-01";

export type SalesSeed = {
  state: string;
  rate: number;
  hasLocal: boolean;
  allocation: string;
  rounding: string;
  frequency: string;
  portal: string | null;
  form: string | null;
  dueDay: number; // 0 = last day of the following month
  rateLabel: string;
  notes: string;
  effectiveFrom?: string;
  active?: boolean;
};

/* dueDay 0 = last day of the month after the period. */
export const SALES_SEED: SalesSeed[] = [
  // ---- filed and verified by hand (highest confidence) ----
  { state: "IL", rate: 0.0625, hasLocal: false, allocation: "flat", rounding: "whole_dollar", frequency: "QUARTERLY", portal: "https://mytax.illinois.gov", form: "ST-1", dueDay: 20, rateLabel: "6.25% state use tax, no local for a remote seller", notes: "Taxable goes on Line 6 (General merchandise, Use Tax x 0.0625), NOT Line 4a. Deductions only via Schedule A. Whole dollars. Confirm frequency per account." },
  { state: "FL", rate: 0.06, hasLocal: true, allocation: "fl_surtax", rounding: "whole_dollar", frequency: "MONTHLY", portal: "https://floridarevenue.com", form: "DR-15", dueDay: 20, rateLabel: "6% state + discretionary county surtax", notes: "Use the FULL DR-15, not the EZ. Row A only. Surtax in the Discretionary section. Surtax capped at $5,000 per single item. $50 late penalty; collection allowance forfeited when late." },
  { state: "KS", rate: 0.065, hasLocal: true, allocation: "county", rounding: "cents", frequency: "ANNUAL", portal: "https://www.ksrevenue.gov", form: "CT-9 Retailers' Compensating Use", dueDay: 25, rateLabel: "6.5% state + local (destination)", notes: "ANNUAL as of 1/1/2026 (was monthly then quarterly). Do NOT file monthly - the monthly Kansas filing is the EC-2 EXCISE, a different account." },
  { state: "NJ", rate: 0.06625, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "QUARTERLY", portal: "https://www.nj.gov/treasury/taxation", form: "ST-50", dueDay: 20, rateLabel: "6.625% flat, no local tax anywhere in NJ", notes: "ST-51 monthly payment required for any month whose tax exceeds $500. Account = 12 digits (FEIN + 3-digit suffix). Ignore the Boat Sales tab." },
  { state: "WY", rate: 0.04, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://excise-wyifs.wy.gov", form: "Return for Licensed Vendors", dueDay: 0, rateLabel: "filed by county; each county rate INCLUDES the state 4%", notes: "Add each county via Add Tax Jurisdiction. Line 8 penalty = 0, the state bills it. Pay by e-check - CPTeller charges a flat $1.50 card fee." },
  { state: "AZ", rate: 0.056, hasLocal: true, allocation: "az_region", rounding: "cents", frequency: "MONTHLY", portal: "https://aztaxes.gov", form: "TPT return (business code 605)", dueDay: 20, rateLabel: "5.6% TPT + county + city, destination based", notes: "File by REGION. County rows already include the state rate; incorporated cities add their own on top. County-only filing triggers the Excess Tax page. Pay via E-Check (free). No AZ vape excise." },
  { state: "NV", rate: 0.0685, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://www.nevadatax.nv.gov", form: "Sales/Use Tax Return", dueDay: 0, rateLabel: "6.85% state + county", notes: "Enter TOTAL SALES and EXEMPT per county - not taxable; the form derives it. Questionnaire = Yes/No/No. Collection allowance applies when timely. Perjury checkbox required." },
  { state: "OK", rate: 0.045, hasLocal: true, allocation: "city_county", rounding: "whole_dollar", frequency: "MONTHLY", portal: "https://oktap.tax.ok.gov", form: "Sales Tax Return", dueDay: 20, rateLabel: "4.5% state + city + county (COPO codes)", notes: "City/County schedule needs PAIRED city AND county COPO rows. OKC spans four counties - use 5521 (Oklahoma County), not 0921 (Canadian). Grocery question = No. No OK vape excise." },
  { state: "PA", rate: 0.06, hasLocal: true, allocation: "pa_columns", rounding: "cents", frequency: "MONTHLY", portal: "https://mypath.pa.gov", form: "PA-3", dueDay: 20, rateLabel: "6% state; local ONLY Philadelphia +2% and Allegheny +1%", notes: "Three columns. Philadelphia/Allegheny sales are taxed in both the state column and the local column. Discount = 0 when late. ACH Debit payment." },
  { state: "KY", rate: 0.06, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://id-rev.ky.gov", form: "Sales and Use Tax Worksheet", dueDay: 20, rateLabel: "6% flat, no local", notes: "Total Sales and Taxable Sales are SALES amounts, not tax. The period dropdown defaults to the oldest unfiled period - choose deliberately. Watch for Avalara under-collection here." },
  { state: "LA", rate: 0.05, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://latap.revenue.louisiana.gov", form: "General Sales and Use Return", dueDay: 20, rateLabel: "5% state + parish local (remote sellers may use the combined 8.45% Remote Sellers return - CONFIRM which return this account files)", notes: "Account entered zero-padded to 9 digits. An unfiled month shows as Estimated with a state-guessed balance; filing the real return replaces it. Penalty waiver available in LaTAP." },
  { state: "TN", rate: 0.07, hasLocal: true, allocation: "county", rounding: "whole_dollar", frequency: "MONTHLY", portal: "https://tntap.tn.gov", form: "Sales and Use Tax Return (SLC)", dueDay: 20, rateLabel: "7% state + local by delivery destination", notes: "Lines 2-4 are COMPONENTS of Line 5 - do not repeat the gross on Line 4. The Schedule B delivery-destination table is what distributes the taxable amount. Whole dollars. Confirm the line logic with the portal's ? help." },

  // ---- other registered states (verify each on the portal) ----
  { state: "CA", rate: 0.0725, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://onlineservices.cdtfa.ca.gov", form: "CDTFA-401-A", dueDay: 0, rateLabel: "7.25% state + district taxes", notes: "TWO accounts (Maximum + Promotive). District taxes go on Schedule A. Effective rate ~8.4%." },
  { state: "CO", rate: 0.029, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://colorado.gov/revenueonline", form: "DR 0100", dueDay: 20, rateLabel: "2.9% state + local", notes: "Local jurisdictions filed through SUTS." },
  { state: "MA", rate: 0.0625, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://mtc.dor.state.ma.us", form: "ST-9", dueDay: 30, rateLabel: "6.25% flat", notes: "Verify due day on the portal." },
  { state: "MI", rate: 0.06, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://mto.treasury.michigan.gov", form: "Form 5080", dueDay: 20, rateLabel: "6% flat", notes: "No Michigan vape excise." },
  { state: "MN", rate: 0.06875, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://www.mndor.state.mn.us", form: "Sales and Use Tax Return", dueDay: 20, rateLabel: "6.875% state + local", notes: "" },
  { state: "NC", rate: 0.0475, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://www.ncdor.gov", form: "E-500", dueDay: 20, rateLabel: "4.75% state + local", notes: "" },
  { state: "NY", rate: 0.04, hasLocal: true, allocation: "county", rounding: "cents", frequency: "QUARTERLY", portal: "https://www.tax.ny.gov", form: "ST-100", dueDay: 20, rateLabel: "4% state + local", notes: "Confirm the filing frequency on the account." },
  { state: "OH", rate: 0.0575, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://gateway.ohio.gov", form: "UST-1", dueDay: 23, rateLabel: "5.75% state + county", notes: "" },
  { state: "SC", rate: 0.06, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://mydorway.dor.sc.gov", form: "ST-3", dueDay: 20, rateLabel: "6% state + local option", notes: "" },
  { state: "TX", rate: 0.0625, hasLocal: true, allocation: "city_county", rounding: "cents", frequency: "MONTHLY", portal: "https://comptroller.texas.gov", form: "01-114", dueDay: 20, rateLabel: "6.25% state + local (capped at 2%)", notes: "NO Texas vape excise, but an e-cigarette permit is required." },
  { state: "VA", rate: 0.053, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://www.tax.virginia.gov", form: "ST-9", dueDay: 20, rateLabel: "5.3% (state 4.3% + 1% local, filed combined)", notes: "Some localities add 0.7-1%. Verify against destinations." },
  { state: "WA", rate: 0.065, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://secure.dor.wa.gov", form: "Combined Excise Tax Return", dueDay: 25, rateLabel: "6.5% state + local", notes: "" },
  { state: "WI", rate: 0.05, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://tap.revenue.wi.gov", form: "ST-12", dueDay: 20, rateLabel: "5% state + county 0.5%", notes: "Verify due day - WI monthly returns may be due the last day of the following month." },
  { state: "WV", rate: 0.06, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://mytaxes.wvtax.gov", form: "CST-200CU", dueDay: 20, rateLabel: "6% state", notes: "" },
  { state: "IN", rate: 0.07, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "ANNUAL", portal: "https://intime.dor.in.gov", form: "ST-103", dueDay: 20, rateLabel: "7% flat, no local", notes: "Sales tax is ANNUAL on this account while PACT stays MONTHLY." },
  { state: "AL", rate: 0.04, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://myalabamataxes.alabama.gov", form: "Form 2100", dueDay: 20, rateLabel: "4% state + local", notes: "No Alabama vape excise." },

  // ---- remaining US states + DC: seeded from the reference tables ----
  // NOT filed by hand. Every row below needs verifying on the portal.
  { state: "AR", rate: 0.065, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://atap.arkansas.gov", form: "ET-1", dueDay: 20, rateLabel: "6.5% state + local (city/county)", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "CT", rate: 0.0635, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://drs.ct.gov", form: "OS-114", dueDay: 0, rateLabel: "6.35% flat, no local tax", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "DC", rate: 0.06, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://mytax.dc.gov", form: "FR-800M", dueDay: 20, rateLabel: "6% flat, no local tax", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "GA", rate: 0.04, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://gtc.dor.ga.gov", form: "ST-3", dueDay: 20, rateLabel: "4% state + local (LOST/SPLOST/ESPLOST)", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "HI", rate: 0.04, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://hitax.hawaii.gov", form: "G-45", dueDay: 20, rateLabel: "4% General Excise Tax + county surcharge (Oahu +0.5%)", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "IA", rate: 0.06, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://tax.iowa.gov", form: "Sales and Use Tax Return", dueDay: 20, rateLabel: "6% state + 1% local option", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "ID", rate: 0.06, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://tax.idaho.gov", form: "Form 850", dueDay: 20, rateLabel: "6% state + resort-city local", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "MD", rate: 0.06, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://interactive.marylandtaxes.gov", form: "Form 202", dueDay: 20, rateLabel: "6% flat, no local tax", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "ME", rate: 0.055, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://revenue.maine.gov", form: "ST-7", dueDay: 15, rateLabel: "5.5% flat, no local tax", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "MO", rate: 0.04225, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://mytax.mo.gov", form: "Form 53-1", dueDay: 20, rateLabel: "4.225% state + local", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "MS", rate: 0.07, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://tap.dor.ms.gov", form: "Form 72-010", dueDay: 20, rateLabel: "7% state (+1% Jackson)", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "ND", rate: 0.05, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://apps.nd.gov/tax/tap", form: "Sales and Use Tax Return", dueDay: 0, rateLabel: "5% state + local", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "NE", rate: 0.055, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://revenue.nebraska.gov", form: "Form 10", dueDay: 20, rateLabel: "5.5% state + local", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "NM", rate: 0.04875, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://tap.state.nm.us", form: "TRD-41413", dueDay: 25, rateLabel: "4.875% Gross Receipts Tax + local", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "RI", rate: 0.07, hasLocal: false, allocation: "flat", rounding: "cents", frequency: "MONTHLY", portal: "https://taxportal.ri.gov", form: "T-204", dueDay: 20, rateLabel: "7% flat, no local tax", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "SD", rate: 0.042, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://apps.sd.gov/rv23epath", form: "Sales and Use Tax Return", dueDay: 20, rateLabel: "4.2% state + municipal", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "UT", rate: 0.0485, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://tap.utah.gov", form: "TC-62S", dueDay: 0, rateLabel: "4.85% state + local (combined base 6.1%)", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },
  { state: "VT", rate: 0.06, hasLocal: true, allocation: "county", rounding: "cents", frequency: "MONTHLY", portal: "https://myvtax.vermont.gov", form: "SUT-451", dueDay: 25, rateLabel: "6% state + 1% local option", notes: "VERIFY - this state was seeded from the reference rate tables, not filed by hand. Confirm the rate, the filing frequency and the due day on the portal before the first filing." },

  // ---- NOMAD states: no sales tax, but excise and PACT can still apply ----
  { state: "AK", rate: 0, hasLocal: true, allocation: "none", rounding: "cents", frequency: "NONE", portal: null, form: null, dueDay: 20, rateLabel: "No state sales tax - local only", notes: "Check local (borough/city) sales taxes if you ship there." },
  { state: "DE", rate: 0, hasLocal: false, allocation: "none", rounding: "cents", frequency: "NONE", portal: "https://tax.delaware.gov", form: null, dueDay: 20, rateLabel: "No sales tax", notes: "Vape excise still applies ($0.05/mL)." },
  { state: "MT", rate: 0, hasLocal: false, allocation: "none", rounding: "cents", frequency: "NONE", portal: null, form: null, dueDay: 20, rateLabel: "No sales tax", notes: "No sales tax and no vape excise." },
  { state: "NH", rate: 0, hasLocal: false, allocation: "none", rounding: "cents", frequency: "NONE", portal: null, form: null, dueDay: 20, rateLabel: "No sales tax", notes: "Vape excise still applies (open 8% wholesale / closed $0.30 per mL)." },
  { state: "OR", rate: 0, hasLocal: false, allocation: "none", rounding: "cents", frequency: "NONE", portal: "https://revenueonline.dor.oregon.gov", form: null, dueDay: 20, rateLabel: "No sales tax", notes: "Vape excise still applies (65% of wholesale)." },
];

export type ExciseSeed = {
  state: string;
  structure: string;
  basis: "SALES" | "RECEIPTS";
  rate: number;
  rateUnit: string;
  openRate?: number;
  openRateUnit?: string;
  closedRate?: number;
  closedRateUnit?: string;
  frequency: string;
  portal: string | null;
  form: string | null;
  dueDay: number;
  notes: string;
  effectiveFrom?: string;
};

export const EXCISE_SEED: ExciseSeed[] = [
  { state: "IL", structure: "A", basis: "SALES", rate: 0.45, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://mytax.illinois.gov", form: "Tobacco Products Return", dueDay: 20, notes: "45% of wholesale (2025 change). Separate from the ST-1." },
  { state: "KS", structure: "C", basis: "RECEIPTS", rate: 0.05, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://www.ksrevenue.gov", form: "EC-2 Consumable Materials Monthly Report", dueDay: 20, notes: "RECEIPTS basis - Line 1a is mL PURCHASED during the month, not sold. License CM000573. Payment is ACH Credit only. Ignore CG-32/TB-32/EC-32." },
  { state: "PA", structure: "A", basis: "SALES", rate: 0.40, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://mypath.pa.gov", form: "Tobacco Products Return", dueDay: 20, notes: "40% of wholesale. Separate return from the PA-3." },
  { state: "KY", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_wholesale", openRate: 0.15, openRateUnit: "pct_wholesale", closedRate: 1.5, closedRateUnit: "per_unit", frequency: "MONTHLY", portal: "https://id-rev.ky.gov (KyETS)", form: "Cigarette/Tobacco and Vapor Products", dueDay: 20, notes: "Bifurcated: open 15% of wholesale, closed $1.50 per cartridge. CHECK THE BASIS ON A PRIOR FILED RETURN before submitting." },
  { state: "LA", structure: "C", basis: "SALES", rate: 0.15, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://latap.revenue.louisiana.gov", form: "Vapor Products", dueDay: 20, notes: "$0.15 per mL - confirm on the portal." },
  { state: "TN", structure: "A", basis: "SALES", rate: 0.10, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://tntap.tn.gov", form: "Vapor Products", dueDay: 20, notes: "10% of wholesale - new for 2026, verify before the first filing." },
  { state: "NV", structure: "A", basis: "SALES", rate: 0.30, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://www.nevadatax.nv.gov", form: "Other Tobacco Products", dueDay: 20, notes: "30% of wholesale." },
  { state: "WY", structure: "A", basis: "SALES", rate: 0.15, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://excise-wyifs.wy.gov", form: "Tobacco Products", dueDay: 20, notes: "15% of wholesale." },
  { state: "CA", structure: "A", basis: "SALES", rate: 0.5427, rateUnit: "pct_wholesale", frequency: "QUARTERLY", portal: "https://onlineservices.cdtfa.ca.gov", form: "Tobacco Products Distributor return", dueDay: 0, notes: "54.27% of wholesale. The 12.5% retail CECET is a SEPARATE return - add it as its own row once confirmed." },
  { state: "CO", structure: "A", basis: "SALES", rate: 0.56, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://colorado.gov/revenueonline", form: "Nicotine Products Tax", dueDay: 20, notes: "56% of manufacturer list price." },
  { state: "MA", structure: "A", basis: "SALES", rate: 0.75, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://mtc.dor.state.ma.us", form: "Form ST-ENDS", dueDay: 20, notes: "75% of wholesale." },
  { state: "MN", structure: "A", basis: "SALES", rate: 0.95, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://www.mndor.state.mn.us", form: "Tobacco Products Tax", dueDay: 20, notes: "95% of wholesale - the highest in the nation." },
  { state: "NC", structure: "C", basis: "SALES", rate: 0.05, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://www.ncdor.gov", form: "B-A-101", dueDay: 20, notes: "$0.05 per mL." },
  { state: "NY", structure: "B", basis: "SALES", rate: 0.20, rateUnit: "pct_retail", frequency: "MONTHLY", portal: "https://www.tax.ny.gov", form: "Supplemental Vapor Products Tax", dueDay: 20, notes: "20% of RETAIL price." },
  { state: "OH", structure: "C", basis: "SALES", rate: 0.10, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://gateway.ohio.gov", form: "Vapor Products Excise", dueDay: 23, notes: "$0.10 per mL." },
  { state: "SC", structure: "C", basis: "SALES", rate: 0.05, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://mydorway.dor.sc.gov", form: "Vapor Products", dueDay: 20, notes: "$0.05 per mL EFFECTIVE 1 OCTOBER 2026 - no SC excise is due for periods before then.", effectiveFrom: "2026-10-01" },
  { state: "VA", structure: "C", basis: "SALES", rate: 0.11, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://www.tax.virginia.gov", form: "TT-8 Liquid Nicotine", dueDay: 20, notes: "$0.11 per mL." },
  { state: "WA", structure: "A", basis: "SALES", rate: 0.95, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://secure.dor.wa.gov", form: "Vapor Products Tax", dueDay: 25, notes: "SB 5814: 95% of wholesale on ALL nicotine products from January 2026." },
  { state: "WI", structure: "C", basis: "SALES", rate: 0.05, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://tap.revenue.wi.gov", form: "TT-100 Vapor Products", dueDay: 20, notes: "$0.05 per mL." },
  { state: "WV", structure: "C", basis: "SALES", rate: 0.075, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://mytaxes.wvtax.gov", form: "E-Cigarette Liquid Tax", dueDay: 20, notes: "$0.075 per mL." },
  { state: "IN", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_retail", openRate: 0.30, openRateUnit: "pct_retail", closedRate: 0.30, closedRateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://intime.dor.in.gov", form: "Electronic Cigarette Tax", dueDay: 20, notes: "Doubled in 2025: open 30% of RETAIL, closed 30% of WHOLESALE." },
  { state: "DE", structure: "C", basis: "SALES", rate: 0.05, rateUnit: "per_ml", frequency: "MONTHLY", portal: "https://tax.delaware.gov", form: "Vapor Products Tax", dueDay: 20, notes: "$0.05 per mL - applies even though Delaware has no sales tax." },
  { state: "NH", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_wholesale", openRate: 0.08, openRateUnit: "pct_wholesale", closedRate: 0.30, closedRateUnit: "per_ml", frequency: "MONTHLY", portal: null, form: "E-Cigarette Tax", dueDay: 20, notes: "Open 8% of wholesale, closed $0.30 per mL. Applies despite no sales tax." },
  { state: "OR", structure: "A", basis: "SALES", rate: 0.65, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://revenueonline.dor.oregon.gov", form: "Tobacco/Inhalant Delivery Systems", dueDay: 20, notes: "65% of wholesale. Applies despite no sales tax." },
  // ---- remaining states with a vapor excise: reference values, UNVERIFIED ----
  { state: "CT", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_wholesale", openRate: 0.1, openRateUnit: "pct_wholesale", closedRate: 0.4, closedRateUnit: "per_ml", frequency: "MONTHLY", portal: "https://drs.ct.gov", form: "Electronic Cigarette Products Tax", dueDay: 20, notes: "Bifurcated: open 10% of wholesale, closed $0.40 per mL. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "GA", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_wholesale", openRate: 0.07, openRateUnit: "pct_wholesale", closedRate: 0.05, closedRateUnit: "per_ml", frequency: "MONTHLY", portal: "https://gtc.dor.ga.gov", form: "Vapor Products Excise", dueDay: 20, notes: "Bifurcated: open 7% of wholesale, closed $0.05 per mL. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "HI", structure: "A", basis: "SALES", rate: 0.7, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://hitax.hawaii.gov", form: "Tobacco Products Tax", dueDay: 20, notes: "70% of wholesale. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "MD", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_retail", openRate: 0.2, openRateUnit: "pct_retail", closedRate: 0.6, closedRateUnit: "pct_retail", frequency: "MONTHLY", portal: "https://interactive.marylandtaxes.gov", form: "Electronic Smoking Devices", dueDay: 20, notes: "Bifurcated by container size: 20% of retail generally, 60% on small (<=5mL) containers. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "ME", structure: "A", basis: "SALES", rate: 0.75, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://revenue.maine.gov", form: "Tobacco Products Tax", dueDay: 20, notes: "75% of wholesale. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "NE", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_retail", openRate: 0.1, openRateUnit: "pct_retail", closedRate: 0.05, closedRateUnit: "per_ml", frequency: "MONTHLY", portal: "https://revenue.nebraska.gov", form: "Vapor Products Tax", dueDay: 20, notes: "Bifurcated by volume: 10% of retail over 3mL, $0.05 per mL at 3mL or under. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "NM", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_wholesale", openRate: 0.125, openRateUnit: "pct_wholesale", closedRate: 0.5, closedRateUnit: "per_unit", frequency: "MONTHLY", portal: "https://tap.state.nm.us", form: "Tobacco Products Tax", dueDay: 25, notes: "Bifurcated: open 12.5% of wholesale, closed $0.50 per cartridge. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "RI", structure: "E", basis: "SALES", rate: 0, rateUnit: "pct_wholesale", openRate: 0.8, openRateUnit: "pct_wholesale", closedRate: 0.5, closedRateUnit: "per_ml", frequency: "MONTHLY", portal: "https://taxportal.ri.gov", form: "Electronic Nicotine Delivery System Tax", dueDay: 20, notes: "Bifurcated: closed $0.50 per mL. THE OPEN-SYSTEM RATE HERE IS THE LEAST CERTAIN IN THE WHOLE TABLE - check it before you file anything for Rhode Island. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "UT", structure: "A", basis: "SALES", rate: 0.56, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://tap.utah.gov", form: "Electronic Cigarette Products Tax", dueDay: 0, notes: "56% of manufacturer's sale price. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "VT", structure: "A", basis: "SALES", rate: 0.92, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://myvtax.vermont.gov", form: "Tobacco Products Tax", dueDay: 25, notes: "92% of wholesale. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },
  { state: "DC", structure: "A", basis: "SALES", rate: 0.64, rateUnit: "pct_wholesale", frequency: "MONTHLY", portal: "https://mytax.dc.gov", form: "Other Tobacco Products", dueDay: 20, notes: "64% of wholesale. VERIFY - seeded from the reference structure tables in the documentation set, not from a filed return. Confirm the rate, the basis and whether you are even licensed in this state before filing." },

];

/** PACT applies in every state you ship ENDS into, monthly, due the 10th. */
export const PACT_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
];

export type JurisdictionSeed = {
  state: string;
  name: string;
  type: string;
  code: string;
  pairedCode?: string;
  pairedName?: string;
  rate?: number;
  rateIncludesState?: boolean;
  avalaraAlias?: string;
  notes?: string;
};

export const JURISDICTION_SEED: JurisdictionSeed[] = [
  { state: "WY", name: "Natrona", type: "county", code: "0100", rateIncludesState: true, notes: "Combined rate includes the state 4%" },
  { state: "WY", name: "Sweetwater", type: "county", code: "0400", rateIncludesState: true },
  { state: "WY", name: "Goshen", type: "county", code: "0700", rateIncludesState: true, notes: "WY DOR jurisdiction table: Goshen 07 00. 0800 is Platte County." },
  { state: "OK", name: "Oklahoma City", type: "city", code: "5521", pairedCode: "5588", pairedName: "Oklahoma", avalaraAlias: "Edmond", notes: "OKC spans four counties - 5521 is the Oklahoma-County code. Never use 0921 (Canadian) for Oklahoma-County addresses." },
  { state: "OK", name: "Duncan", type: "city", code: "6911", pairedCode: "6988", pairedName: "Stephens", avalaraAlias: "Marlow", notes: "Marlow addresses are taxed as Duncan" },
  { state: "OK", name: "Broken Arrow", type: "city", code: "7204", pairedCode: "7288", pairedName: "Tulsa", notes: "Tulsa-county portion" },
  { state: "OK", name: "Oklahoma", type: "county", code: "5588", notes: "0% county - the line may still be required" },
  { state: "OK", name: "Stephens", type: "county", code: "6988" },
  { state: "OK", name: "Tulsa", type: "county", code: "7288" },
  { state: "OK", name: "Canadian", type: "county", code: "0988", notes: "OTC COPO chart: Canadian County is 0988. 0921 is the Oklahoma City city code for its Canadian-County portion (pairs with 0988) - never use it for Oklahoma-County addresses." },
  { state: "PA", name: "Philadelphia", type: "local", code: "PHILA", rate: 0.02, notes: "+2% column on the PA-3" },
  { state: "PA", name: "Allegheny", type: "local", code: "ALLEG", rate: 0.01, notes: "+1% column on the PA-3" },
  { state: "AZ", name: "Maricopa", type: "county", code: "MAR", rateIncludesState: true, notes: "Region code; county rows already include the state rate" },
  { state: "AZ", name: "Pima", type: "county", code: "PMA", rateIncludesState: true, notes: "Verify on aztaxes.gov" },
];

export type AccountSeed = {
  state: string;
  taxType: string;
  accountNumber?: string;
  licenseNumber?: string;
  loginField?: string;
  notes?: string;
};

/** Non-secret identifiers only. Passwords and PINs live in a password manager. */
export const ACCOUNT_SEED: AccountSeed[] = [
  { state: "IL", taxType: "sales", loginField: "FEIN + PIN", notes: "mytax.illinois.gov" },
  { state: "FL", taxType: "sales", accountNumber: "78-xxxxxxx", notes: "Certificate number - fill in the real one" },
  { state: "KS", taxType: "sales", notes: "Kansas Customer Service Center - Retailers' Compensating Use account" },
  { state: "KS", taxType: "excise", licenseNumber: "CM000573", notes: "Cigarette & Tobacco Tax account - same login, different account. Reach EC-2 via Your License List > View CM000573." },
  { state: "NJ", taxType: "sales", accountNumber: "FEIN + 3-digit suffix (12 digits)" },
  { state: "WY", taxType: "sales", licenseNumber: "24044420" },
  { state: "AZ", taxType: "sales", licenseNumber: "21403739", notes: "Remote Seller" },
  { state: "NV", taxType: "sales", accountNumber: "SUT-xxxx", notes: "Fill in the real account number" },
  { state: "OK", taxType: "sales", accountNumber: "STS-15666036-03" },
  { state: "PA", taxType: "sales", accountNumber: "20017237437" },
  { state: "KY", taxType: "sales", accountNumber: "000780515" },
  { state: "LA", taxType: "sales", accountNumber: "002446798", notes: "Enter zero-padded to 9 digits at the payment step" },
  { state: "TN", taxType: "sales", accountNumber: "1001867424-SLC", notes: "SLC = out-of-state" },
];

/** Standard economic-nexus thresholds; verify per state. */
export const NEXUS_SEED: { state: string; amount: number; txns: number | null }[] = [
  { state: "AL", amount: 250000, txns: null },
  { state: "AZ", amount: 100000, txns: null },
  { state: "CA", amount: 500000, txns: null },
  { state: "CO", amount: 100000, txns: null },
  { state: "FL", amount: 100000, txns: null },
  { state: "IL", amount: 100000, txns: 200 },
  { state: "IN", amount: 100000, txns: null },
  { state: "KS", amount: 100000, txns: null },
  { state: "KY", amount: 100000, txns: 200 },
  { state: "LA", amount: 100000, txns: null },
  { state: "MA", amount: 100000, txns: null },
  { state: "MI", amount: 100000, txns: 200 },
  { state: "MN", amount: 100000, txns: 200 },
  { state: "NC", amount: 100000, txns: null },
  { state: "NJ", amount: 100000, txns: 200 },
  { state: "NV", amount: 100000, txns: 200 },
  { state: "NY", amount: 500000, txns: 100 },
  { state: "OH", amount: 100000, txns: 200 },
  { state: "OK", amount: 100000, txns: null },
  { state: "PA", amount: 100000, txns: null },
  { state: "SC", amount: 100000, txns: null },
  { state: "TN", amount: 100000, txns: null },
  { state: "TX", amount: 500000, txns: null },
  { state: "VA", amount: 100000, txns: 200 },
  { state: "WA", amount: 100000, txns: null },
  { state: "WI", amount: 100000, txns: null },
  { state: "WV", amount: 100000, txns: 200 },
  { state: "WY", amount: 100000, txns: null },
];
