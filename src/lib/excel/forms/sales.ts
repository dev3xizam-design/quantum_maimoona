/**
 * Per-state sales-tax form mirrors. Each spec encodes that state's own quirks
 * as learned filing them by hand (doc 03 / doc 05) - which line the taxable
 * figure belongs on, what rounds to whole dollars, which schedules to switch
 * on, and what the portal will reject.
 */

import { round2, roundWholeDollar } from "@/lib/money";
import type { SalesResult } from "@/lib/engine/types";
import type { FormCtx, ReturnLine, SalesFormSpec } from "./types";

const S = (label: string): ReturnLine => ({ kind: "section", label });
const B = (): ReturnLine => ({ kind: "blank" });
const L = (
  line: string | undefined,
  label: string,
  value: number | string | null,
  opts: Partial<Extract<ReturnLine, { kind: "line" }>> = {},
): ReturnLine => ({ kind: "line", line, label, value, format: "money", ...opts });

const R = (r: SalesResult, v: number) => (r.rounding === "whole_dollar" ? roundWholeDollar(v) : round2(v));
const fmtOf = (r: SalesResult) => (r.rounding === "whole_dollar" ? "money0" : "money");

const acct = (ctx: FormCtx) => ctx.accountNumber ?? "(add in Config > Accounts)";

/** Local (non-state) tax collected, i.e. county/city/special portions. */
const localTax = (r: SalesResult) => round2(r.taxCollected - r.stateTaxCollected);

function countyTaxable(r: SalesResult, name: string): number {
  const hit = r.byCounty.find((c) => c.name.toLowerCase().includes(name.toLowerCase()));
  return hit ? hit.taxable : 0;
}
function countyGross(r: SalesResult, name: string): number {
  const hit = r.byCounty.find((c) => c.name.toLowerCase().includes(name.toLowerCase()));
  return hit ? hit.gross : 0;
}

/* ------------------------------------------------------------------ */
/* Flat-rate states                                                    */
/* ------------------------------------------------------------------ */

const FL: SalesFormSpec = {
  id: "FL_sales_DR15",
  title: "Florida DR-15 - Sales and Use Tax Return",
  lines: (r) => {
    const f = fmtOf(r);
    const surtax = localTax(r);
    return [
      S("Sales Details - Row A (Sales / Services / Electricity)"),
      L("A", "Gross Sales", R(r, r.gross), { format: f, note: "Column 1" }),
      L("A", "Exempt Sales", R(r, r.exempt), { format: f, note: "Column 2" }),
      L("A", "Taxable Amount", R(r, r.taxable), { format: f, highlight: true, note: "Column 3" }),
      L("A", "Tax Due (state 6%)", R(r, r.taxable * r.stateRate), { format: f, highlight: true, note: "Column 4" }),
      B(),
      S("Discretionary Sales Surtax (county)"),
      L(undefined, "Taxable sales subject to county surtax", R(r, r.taxable), { format: f }),
      L(undefined, "Total discretionary sales surtax due", R(r, surtax), { format: f, highlight: true }),
      L(undefined, "Surtax cap reminder", "Capped at $5,000 per single item - confirm no single item exceeds it", { format: "text" }),
      B(),
      S("Totals"),
      L("Line 7", "Total tax due (state + surtax)", R(r, r.taxComputed), { format: f, highlight: true }),
      L(undefined, "Tax collected per Avalara", R(r, r.taxCollected), { format: f }),
      L(undefined, "Collection allowance", 0, { format: f, note: "Forfeited if filed late" }),
    ];
  },
  steps: (r, ctx) => [
    `Log in at floridarevenue.com with certificate number ${acct(ctx)}.`,
    "Choose the FULL DR-15 (not the EZ) - the EZ has no county surtax section.",
    "Open the Sales Details tab and use Row A (Sales/Services) only. Leave rows B-E blank.",
    `Row A Column 1 Gross Sales = ${R(r, r.gross).toLocaleString()}.`,
    `Row A Column 2 Exempt Sales = ${R(r, r.exempt).toLocaleString()}.`,
    `Row A Column 3 Taxable = ${R(r, r.taxable).toLocaleString()}; Column 4 Tax Due = ${R(r, r.taxable * r.stateRate).toLocaleString()}.`,
    `Scroll to the Discretionary Sales Surtax section near the bottom and enter surtax ${round2(localTax(r)).toLocaleString()} (see the Jurisdiction Detail tab for the county split).`,
    "Everything rounds to WHOLE DOLLARS.",
    "File and pay by the 20th - late filing costs the collection allowance plus a $50 penalty.",
  ],
};

const IL: SalesFormSpec = {
  id: "IL_sales_ST1",
  title: "Illinois ST-1 - Sales and Use Tax Return (remote seller)",
  lines: (r) => {
    const f = fmtOf(r);
    return [
      S("Step 2 - Total Receipts"),
      L("1", "Total receipts", R(r, r.gross), { format: f }),
      L("2", "Deductions (Schedule A total)", R(r, r.exempt), { format: f }),
      L("3", "Taxable receipts (Line 1 - Line 2)", R(r, r.taxable), { format: f, highlight: true }),
      B(),
      S("Step 3 - Tax on Receipts"),
      L("4a", "General merchandise ROT (in-state)", 0, { format: f, note: "REMOTE SELLER: leave 0. This line is in-state ROT." }),
      L("6", "General merchandise USE TAX x 0.0625", R(r, r.taxable), {
        format: f,
        highlight: true,
        note: "Taxable amount goes HERE for a remote seller",
      }),
      L("6", "Tax on Line 6", R(r, r.taxable * 0.0625), { format: f, highlight: true }),
      B(),
      S("Local tax"),
      L(undefined, "Local / home-rule tax", 0, { format: f, note: "No local tax on remote-seller use tax - every Avalara local row is 0." }),
      B(),
      S("Totals"),
      L(undefined, "Total tax due", R(r, r.taxComputed), { format: f, highlight: true }),
      L(undefined, "Retailer's discount", 0, { format: f, note: "Zero when filed late" }),
    ];
  },
  steps: (r, ctx) => [
    `Log in at mytax.illinois.gov (FEIN ${ctx.fein} + PIN).`,
    "Start the ST-1 for the period. In Select Schedules, switch ON Schedule A if there are any deductions - deductions can ONLY flow through Schedule A.",
    `Line 1 Total receipts = ${R(r, r.gross).toLocaleString()}.`,
    `Line 2 Deductions = ${R(r, r.exempt).toLocaleString()} (Schedule A, usually line 5a interstate commerce).`,
    `Line 3 Taxable receipts = ${R(r, r.taxable).toLocaleString()}.`,
    `Put the taxable amount on LINE 6 (General merchandise, Use Tax, x 0.0625) - NOT line 4a. Tax = ${R(r, r.taxable * 0.0625).toLocaleString()}.`,
    "The rate-line amount boxes must sum to Line 1 - Line 2 or the form errors out.",
    "Whole dollars. Retailer's discount is zero if filed late.",
    "Note: the IL vapor excise (45% of wholesale) is a SEPARATE Tobacco Products return - it is not on the ST-1.",
  ],
};

const NJ: SalesFormSpec = {
  id: "NJ_sales_ST50",
  title: "New Jersey ST-50 - Quarterly Sales and Use Tax Return",
  lines: (r) => [
    S("Regular Sales"),
    L("1", "Gross receipts", round2(r.gross)),
    L("2", "Non-taxable receipts", round2(r.exempt)),
    L("3", "Taxable receipts", round2(r.taxable), { highlight: true }),
    L("4", "Sales tax due (rate locked at 6.625%)", round2(r.taxable * 0.06625), { highlight: true }),
    B(),
    S("Other tabs"),
    L(undefined, "Boat sales", 0, { note: "Ignore - not applicable" }),
    L(undefined, "Use tax", 0),
    B(),
    S("Monthly payment test (ST-51)"),
    L(undefined, "Any single month's tax over $500?", round2(r.taxComputed) > 500 ? "YES - ST-51 payment required for that month" : "No - no ST-51 needed", { format: "text" }),
  ],
  steps: (r, ctx) => [
    "Go to nj.gov/treasury/taxation > File Electronically > Sales & Use Tax (or guest filing at taxportal.nj.gov).",
    `Account number is your 12-digit ID: FEIN + 3-digit suffix - ${acct(ctx)}.`,
    "Use the Regular Sales tab. The rate is locked at 6.625% and there is NO local tax anywhere in NJ.",
    `Line 1 gross = ${round2(r.gross).toLocaleString()}; Line 2 non-taxable = ${round2(r.exempt).toLocaleString()}.`,
    `Taxable = ${round2(r.taxable).toLocaleString()}, tax = ${round2(r.taxable * 0.06625).toLocaleString()}.`,
    "Skip the Boat Sales tab entirely.",
    round2(r.taxComputed) > 500
      ? "This quarter has a month over $500 - file the ST-51 monthly payment for that month."
      : "No month exceeded $500, so no ST-51 monthly payment is needed.",
  ],
};

const KY: SalesFormSpec = {
  id: "KY_sales_worksheet",
  title: "Kentucky Sales and Use Tax Worksheet",
  lines: (r) => [
    S("Worksheet"),
    L("1", "Total Sales (a SALES amount, not tax)", round2(r.gross)),
    L("2", "Taxable Sales (a SALES amount, not tax)", round2(r.taxable), { highlight: true }),
    L("3", "Tax due (Taxable x 6%)", round2(r.taxable * 0.06), { highlight: true }),
    B(),
    S("Under-collection check"),
    L(undefined, "Tax Avalara actually collected", round2(r.taxCollected)),
    L(undefined, "Difference (state assesses vs collected)", round2(r.delta), {
      highlight: true,
      note: r.delta > 0 ? "You under-collected - this comes out of margin. Fix the Avalara rate." : "",
    }),
  ],
  steps: (r, ctx) => [
    `Log in at id-rev.ky.gov > MyTaxes. Account ${acct(ctx)}.`,
    'Form Type = "Sales and Use Tax Worksheet". Return Type = Original. Filing Method = Data Entry.',
    "The period dropdown defaults to the OLDEST unfiled period - pick the correct month deliberately.",
    `Total Sales = ${round2(r.gross).toLocaleString()} and Taxable Sales = ${round2(r.taxable).toLocaleString()}. Both are SALES amounts, not tax.`,
    `Tax = taxable x 6% = ${round2(r.taxable * 0.06).toLocaleString()}. Kentucky has NO local sales tax.`,
    "KY vapor excise is filed separately in KyETS (open 15% of wholesale / closed $1.50 per cartridge).",
  ],
};

const LA: SalesFormSpec = {
  id: "LA_sales_general",
  title: "Louisiana General Sales and Use Tax Return",
  lines: (r) => [
    S("Return"),
    L(undefined, "Motor vehicle sales?", "No", { format: "text" }),
    L("1", "Gross sales of tangible personal property", round2(r.gross)),
    L(undefined, "Allowable deductions (Schedule A)?", r.exempt > 0 ? "Yes - see Reconciliation tab" : "No", { format: "text" }),
    L(undefined, "0% transactions (Schedule A-1)?", "No", { format: "text" }),
    L(undefined, "Taxable", round2(r.taxable), { highlight: true }),
    L(undefined, "Tax due", round2(r.taxComputed), { highlight: true }),
    B(),
    S("Payment"),
    L(undefined, "Account number (9-digit, zero-padded)", (r.state === "LA" ? "002446798" : ""), { format: "text" }),
    L(undefined, "Paid preparer", "Leave blank - you file this yourself", { format: "text" }),
  ],
  steps: (r, ctx) => [
    `Log in at latap.revenue.louisiana.gov. Account ${acct(ctx)} - the payment step wants it ZERO-PADDED to 9 digits (e.g. 002446798).`,
    "Motor Vehicle question = No.",
    `Enter vape sales under "Gross sales of tangible personal property" = ${round2(r.gross).toLocaleString()}.`,
    r.exempt > 0 ? "Allowable Deductions (Schedule A) = Yes - enter the exempt amount." : "Allowable Deductions (Schedule A) = No.",
    "0% transactions (Schedule A-1) = No. Paid Preparer = blank.",
    "If the month shows as \"Estimated\" with a state-guessed balance, filing the real return REPLACES that estimate.",
    "For late months use Submit a Penalty Waiver in LaTAP.",
  ],
};

/* ------------------------------------------------------------------ */
/* Jurisdiction-allocated states                                       */
/* ------------------------------------------------------------------ */

const PA: SalesFormSpec = {
  id: "PA_sales_PA3",
  title: "Pennsylvania PA-3 - Sales, Use and Hotel Occupancy Tax",
  lines: (r) => {
    const philaGross = countyGross(r, "Philadelphia");
    const philaTax = countyTaxable(r, "Philadelphia");
    const allegGross = countyGross(r, "Allegheny");
    const allegTax = countyTaxable(r, "Allegheny");
    return [
      S("Answer Questions"),
      L(undefined, "PA sales this period?", "Yes", { format: "text" }),
      L(undefined, "Philadelphia sales?", philaTax > 0 ? "YES" : "No", { format: "text" }),
      L(undefined, "Allegheny sales?", allegTax > 0 ? "YES" : "No", { format: "text" }),
      L(undefined, "Hotel occupancy / Clean Indoor Air / TPPR", "No", { format: "text" }),
      B(),
      S("Column 1 - PA state 6%"),
      L("1", "Gross sales", round2(r.gross)),
      L("2", "Net taxable sales", round2(r.taxable), { highlight: true }),
      L("3", "Tax (6%)", round2(r.taxable * 0.06), { highlight: true }),
      B(),
      S("Column 2 - Philadelphia +2%"),
      L("1", "Gross sales shipped to Philadelphia", round2(philaGross)),
      L("2", "Net taxable", round2(philaTax)),
      L("3", "Tax (2%)", round2(philaTax * 0.02), { note: "Philadelphia sales are taxed in BOTH the state column and here." }),
      B(),
      S("Column 3 - Allegheny +1%"),
      L("1", "Gross sales shipped to Allegheny", round2(allegGross)),
      L("2", "Net taxable", round2(allegTax)),
      L("3", "Tax (1%)", round2(allegTax * 0.01)),
      B(),
      S("Totals"),
      L(undefined, "Total tax due", round2(r.taxable * 0.06 + philaTax * 0.02 + allegTax * 0.01), { highlight: true }),
      L(undefined, "Discount", 0, { note: "Zero when filed late" }),
    ];
  },
  steps: (r, ctx) => {
    const phila = countyTaxable(r, "Philadelphia");
    const alleg = countyTaxable(r, "Allegheny");
    return [
      `Log in at mypath.pa.gov. Account ${acct(ctx)}. Form PA-3.`,
      `Answer Questions: PA sales = Yes. Philadelphia = ${phila > 0 ? "Yes" : "No"}. Allegheny = ${alleg > 0 ? "Yes" : "No"}. Hotel/Clean Indoor Air/TPPR = No.`,
      "PA has NO general local tax - only Philadelphia (+2%) and Allegheny (+1%), and only if you shipped there.",
      `State column: gross ${round2(r.gross).toLocaleString()}, net taxable ${round2(r.taxable).toLocaleString()}, tax ${round2(r.taxable * 0.06).toLocaleString()}.`,
      phila > 0 ? `Philadelphia column: net taxable ${round2(phila).toLocaleString()}, tax ${round2(phila * 0.02).toLocaleString()}. These sales appear in BOTH columns.` : "Philadelphia column: leave blank.",
      alleg > 0 ? `Allegheny column: net taxable ${round2(alleg).toLocaleString()}, tax ${round2(alleg * 0.01).toLocaleString()}.` : "Allegheny column: leave blank.",
      "Pay by ACH Debit. Discount is zero when late.",
      "The PA vapor excise (40% of wholesale) is a SEPARATE Tobacco Products return.",
    ];
  },
};

const OK: SalesFormSpec = {
  id: "OK_sales_citycounty",
  title: "Oklahoma Sales Tax Return (city + county COPO schedule)",
  lines: (r) => {
    const f = fmtOf(r);
    return [
      S("Sales Information"),
      L("1", "Total Sales", R(r, r.gross), { format: f }),
      L(undefined, "Beer sales / removed from inventory", 0, { format: f, note: "Leave 0" }),
      B(),
      S("Exemption Schedule"),
      L(undefined, "Exempt - out of state / nontaxable services", R(r, r.exempt), {
        format: f,
        note: "Put it in the right category, or leave 0 and slightly overpay",
      }),
      B(),
      S("Grocery section"),
      L(undefined, "Prepared food more than 75% of sales?", "No", { format: "text" }),
      L(undefined, "Food sales", 0, { format: f }),
      B(),
      S("City / County Tax Schedule"),
      L(undefined, "Net taxable to allocate", R(r, r.taxable), { format: f, highlight: true }),
      L(undefined, "Rows required", "PAIRED city AND county lines with COPO codes - see Jurisdiction Detail tab", { format: "text" }),
      B(),
      S("Totals"),
      L(undefined, "Total tax due", R(r, r.taxComputed), { format: f, highlight: true }),
    ];
  },
  steps: (r, ctx) => [
    `Log in at oktap.tax.ok.gov. Account ${acct(ctx)}.`,
    `Sales Information: enter Total Sales ${R(r, r.gross).toLocaleString()} only. Leave beer and removed-from-inventory at 0.`,
    "Exemption Schedule: put exempt sales in the correct category (out-of-state / nontaxable services), or leave 0 and overpay slightly.",
    'Grocery section: "Prepared food more than 75%?" = No. Food sales = 0.',
    "City/County Tax Schedule needs PAIRED city AND county rows with COPO codes. Use the Jurisdiction Detail tab - it is already in the portal's import format (code, net taxable).",
    'If a tooltip says "Add County CoPo on new line [XXXX]", that is the county pair for the city you just entered.',
    "Watch OKC: it spans four counties - use 5521 (Oklahoma County), never 0921 (Canadian).",
    "Avalara maps Edmond addresses to Oklahoma City and Marlow to Duncan - the codes in the detail tab already reflect that.",
    "Oklahoma has no vapor excise, so this is the only OK return.",
  ],
};

const AZ: SalesFormSpec = {
  id: "AZ_sales_TPT",
  title: "Arizona TPT Return (remote seller, business code 605)",
  lines: (r) => [
    S("Return header"),
    L(undefined, "Business code", "605 - Marketplace / Remote Retail", { format: "text" }),
    B(),
    S("Totals"),
    L(undefined, "Gross receipts", round2(r.gross)),
    L(undefined, "Deductions / exempt", round2(r.exempt)),
    L(undefined, "Net taxable", round2(r.taxable), { highlight: true }),
    L(undefined, "Total tax due", round2(r.taxComputed), { highlight: true }),
    B(),
    S("Region rows"),
    L(undefined, "Filed by region", "One row per county/city region - see Jurisdiction Detail tab", { format: "text" }),
    L(undefined, "County rows", "Already include the state 5.6% rate", { format: "text" }),
    L(undefined, "City rows", "Incorporated cities add their own rate on top", { format: "text" }),
  ],
  steps: (r, ctx) => [
    `Log in at aztaxes.gov. License ${ctx.licenseNumber ?? acct(ctx)} (Remote Seller).`,
    "Business code 605 (Marketplace/Remote Retail).",
    "File by REGION using the rows in the Jurisdiction Detail tab. County rows already include the state 5.6%.",
    "File city rows for incorporated cities. If you file county-only, city-tax cities under-report and the Excess Tax page appears.",
    "Watch address-to-jurisdiction mapping - Avalara may tax a suburb under a different city.",
    `Net taxable ${round2(r.taxable).toLocaleString()}, total tax ${round2(r.taxComputed).toLocaleString()}.`,
    "Pay via Pay > Pay Outstanding Liabilities > E-Check (free).",
    "Arizona has NO vape excise - TPT is the only AZ filing.",
  ],
};

const NV: SalesFormSpec = {
  id: "NV_sales_bycounty",
  title: "Nevada Sales / Use Tax Return (by county)",
  lines: (r) => [
    S("Reporting Questionnaire"),
    L(undefined, "Did you have sales this period?", "Yes", { format: "text" }),
    L(undefined, "Do you owe use tax?", "No", { format: "text" }),
    L(undefined, "Did you over-collect?", "No", { format: "text" }),
    B(),
    S("County entry - enter TOTAL SALES and EXEMPT, not taxable"),
    L(undefined, "Total Sales (gross, all counties)", round2(r.gross), { highlight: true }),
    L(undefined, "Exempt (all counties)", round2(r.exempt)),
    L(undefined, "Per-county rows", "See Jurisdiction Detail tab", { format: "text" }),
    B(),
    S("Totals"),
    L(undefined, "Tax due (form computes)", round2(r.taxComputed), { highlight: true }),
    L(undefined, "Collection allowance", "Applied automatically when timely", { format: "text" }),
  ],
  steps: (r, ctx) => [
    `Log in at the Nevada Tax Center. Account ${acct(ctx)}.`,
    "Reporting Questionnaire answers: sales = Yes, use tax = No, over-collected = No.",
    "The return lists EVERY county. For each county you shipped to, enter Total Sales (gross) and Exempt - NOT taxable. The form derives taxable itself.",
    "Use the Jurisdiction Detail tab for the per-county gross and exempt figures.",
    "The collection allowance is applied automatically when you file on time.",
    "Tick the perjury declaration checkbox before submitting.",
    "Nevada also has a monthly PACT Act ENDS report - the cigarette PA-1 sections stay blank.",
  ],
};

const TN: SalesFormSpec = {
  id: "TN_sales_SLC",
  title: "Tennessee Sales and Use Tax Return (SLC - out of state)",
  lines: (r) => {
    const f = fmtOf(r);
    return [
      S("Preliminary questions"),
      L(undefined, "Submitting a vendor file?", "No", { format: "text" }),
      L(undefined, "Sales to report?", "Yes (open the out-of-state location's Sales Detail)", { format: "text" }),
      B(),
      S("Sales section - do NOT double-enter"),
      L("1", "Gross Sales", R(r, r.gross), { format: f, highlight: true }),
      L("2", "Cost of personal property used", 0, { format: f }),
      L("3", "Fair market value of property sold", 0, { format: f }),
      L("4", "Other (leave blank unless it applies)", 0, {
        format: f,
        note: "Entering the gross here AND on Line 1 doubles Line 5 - that was the mistake made by hand.",
      }),
      L("5", "Total (sum of lines 1-4)", R(r, r.gross), { format: f }),
      B(),
      S("Deductions / taxable"),
      L(undefined, "Exemptions", R(r, r.exempt), { format: f }),
      L(undefined, "Taxable", R(r, r.taxable), { format: f, highlight: true }),
      B(),
      S("Schedule B - local tax by delivery destination"),
      L(undefined, "Amount to allocate across counties", R(r, r.taxable), {
        format: f,
        highlight: true,
        note: 'The red error "must equal Total Sales - Exemptions" points at THIS table.',
      }),
      L(undefined, "County rows", "See Jurisdiction Detail tab", { format: "text" }),
      B(),
      S("Schedules"),
      L(undefined, "Schedule A (exempt)", "No", { format: "text" }),
      L(undefined, "Schedule C (single article / special)", "No", { format: "text" }),
      B(),
      S("Totals"),
      L(undefined, "Total tax due", R(r, r.taxComputed), { format: f, highlight: true }),
    ];
  },
  steps: (r, ctx) => [
    `Log in at tntap.tn.gov. Account ${acct(ctx)} (the -SLC suffix means out-of-state).`,
    '"Submitting a vendor file?" = No.',
    "Open the out-of-state location and its Sales Detail. \"Sales to report?\" = Yes.",
    `Line 1 Gross = ${R(r, r.gross).toLocaleString()}. Lines 2-4 are COMPONENTS - leave them 0 unless they genuinely apply. Line 5 is the sum.`,
    "Do NOT put the gross on both Line 1 and Line 4 - that doubles Line 5.",
    `Distribute ${R(r, r.taxable).toLocaleString()} across the Schedule B delivery-destination (county) table using the Jurisdiction Detail tab.`,
    "Schedule A = No, Schedule C = No.",
    "Whole dollars.",
    "If the form still errors, use the ? help beside the Schedule B table before finalising - this form's line logic is the finickiest of the set.",
  ],
};

const WY: SalesFormSpec = {
  id: "WY_sales_bycounty",
  title: "Wyoming Return for Licensed Vendors (by county)",
  lines: (r) => [
    S("Summary"),
    L("1", "Gross sales", round2(r.gross)),
    L("2", "Deductions", round2(r.exempt)),
    L(undefined, "Net taxable", round2(r.taxable), { highlight: true }),
    L("8", "Penalty / interest", 0, { note: "Leave 0 - the state bills it separately" }),
    B(),
    S("County rows"),
    L(undefined, "Add each county via 'Add Tax Jurisdiction'", "See Jurisdiction Detail tab", { format: "text" }),
    L(undefined, "Rate note", "Each county's combined rate ALREADY includes the state 4%", { format: "text" }),
    B(),
    S("Totals"),
    L(undefined, "Total tax due", round2(r.taxComputed), { highlight: true }),
  ],
  steps: (r, ctx) => [
    `Log in at excise-wyifs.wy.gov (WYIFS). License ${ctx.licenseNumber ?? acct(ctx)}. Choose "Return for Licensed Vendors".`,
    'Add each destination county with "Add Tax Jurisdiction" and enter its taxable amount - see the Jurisdiction Detail tab for codes (Natrona 0100, Sweetwater 0400, ...).',
    "Each county's combined rate already includes the state 4% - do not add the state separately.",
    `Summary: Line 1 gross ${round2(r.gross).toLocaleString()}, Line 2 deductions ${round2(r.exempt).toLocaleString()}, Line 8 penalty 0.`,
    "Pay by e-check/ACH, NOT card - CPTeller charges a flat $1.50 card fee, which is huge on a small return.",
  ],
};

/* ------------------------------------------------------------------ */
/* Generic fallbacks                                                   */
/* ------------------------------------------------------------------ */

const GENERIC_FLAT: SalesFormSpec = {
  id: "generic_sales_flat",
  title: "Sales / Use Tax Return",
  lines: (r) => {
    const f = fmtOf(r);
    return [
      S("Return"),
      L("1", "Gross sales", R(r, r.gross), { format: f }),
      L("2", "Exempt / non-taxable sales", R(r, r.exempt), { format: f }),
      L("3", "Taxable sales", R(r, r.taxable), { format: f, highlight: true }),
      L("4", `Tax due (state rate)`, R(r, r.taxable * r.stateRate), { format: f, highlight: true }),
      ...(r.hasLocal || localTax(r) !== 0
        ? [B(), S("Local tax"), L(undefined, "Local tax (county/city)", round2(localTax(r)), { format: f })]
        : []),
      B(),
      S("Totals"),
      L(undefined, "Total tax due", R(r, r.taxComputed), { format: f, highlight: true }),
      L(undefined, "Tax collected per Avalara", R(r, r.taxCollected), { format: f }),
      L(undefined, "Difference (computed - collected)", round2(r.delta), { format: f, highlight: Math.abs(r.delta) >= 0.01 }),
    ];
  },
  steps: (r, ctx) => [
    `Log in at ${r.portal ?? "the state portal"}. Account ${acct(ctx)}.`,
    `Open form ${r.form ?? "the sales & use tax return"} for ${r.periodLabel}.`,
    `Gross ${round2(r.gross).toLocaleString()}, exempt ${round2(r.exempt).toLocaleString()}, taxable ${round2(r.taxable).toLocaleString()}.`,
    `Tax due ${round2(r.taxComputed).toLocaleString()}.`,
    r.allocation !== "flat"
      ? "This state allocates by jurisdiction - use the Jurisdiction Detail tab."
      : "Flat state rate - no jurisdiction breakdown needed.",
    "VERIFY the rate and frequency on the portal before filing - this is a generic template until the state's own quirks are encoded.",
  ],
};

export const SALES_FORMS: Record<string, SalesFormSpec> = {
  FL, IL, NJ, KY, LA, PA, OK, AZ, NV, TN, WY,
};

export function salesFormFor(state: string): SalesFormSpec {
  return SALES_FORMS[state] ?? GENERIC_FLAT;
}
