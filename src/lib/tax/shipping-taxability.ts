/**
 * Is a SEPARATELY STATED shipping/delivery charge (common carrier or USPS,
 * delivery mandatory - the buyer cannot pick up) subject to sales tax?
 *
 *  - "taxable"                     shipping is taxed even when separately stated
 *  - "exempt_if_separately_stated" exempt because the store states it separately
 *  - "exempt"                      no state sales tax at all
 *
 * The store always states shipping separately, so callers treat only
 * "taxable" as taxable. Every answer below was also checked against nine
 * months of this store's Avalara history (2026-01..09 SHIPPING lines), which
 * agrees for every state that had sales. STATE_NOTES records the caveats.
 */

export type ShippingTaxability = "taxable" | "exempt" | "exempt_if_separately_stated";

const RULES: Record<string, ShippingTaxability> = {
  AL: "exempt_if_separately_stated", // Ala. Admin. Code r. 810-6-1-.178: separately stated transportation charges excluded
  AK: "exempt_if_separately_stated", // ARSSTC Remote Seller Sales Tax Code 05.010 'sales price' excludes separately stated delivery charges (local ordinances may differ)
  AZ: "exempt_if_separately_stated", // A.R.S. 42-5001 / AAC R15-5-133: separately stated shipping excluded from gross receipts
  AR: "taxable", // Ark. Code 26-52-301 + GR-18: delivery charges are part of sales price (SST)
  CA: "exempt_if_separately_stated", // Cal. Reg. 1628(b): separately stated delivery by common carrier/USPS excluded (taxable part only if charge exceeds cost)
  CO: "taxable", // Colo. 39-26-102(21) + FYI Sales 5: exempt only if delivery is optional for the buyer; mandatory delivery is taxable
  CT: "taxable", // Conn. Gen. Stat. 12-407(a)(8): delivery charges are part of gross receipts
  DE: "exempt", // no sales tax
  DC: "taxable", // D.C. Code 47-2001(n): delivery charges are part of gross receipts
  FL: "taxable", // Fla. Admin. Code 12A-1.045: charges taxable when delivery is part of the sale (not optional)
  GA: "taxable", // O.C.G.A. 48-8-2(34): sales price includes delivery charges (SST)
  HI: "taxable", // HRS 237: GET applies to gross proceeds including shipping
  ID: "exempt_if_separately_stated", // IDAPA 35.01.02.061: separately stated transportation charges excluded
  IL: "taxable", // 86 Ill. Adm. Code 130.415: delivery charges taxable when delivery is not optional to the buyer
  IN: "taxable", // IC 6-2.5-1-5: sales price includes delivery charges (SST)
  IA: "exempt_if_separately_stated", // Iowa Code 423.1(51)(b)(5): separately stated delivery charges excluded (SST)
  KS: "exempt_if_separately_stated", // K.S.A. 79-3602(ll)(3)(D) as amended July 1 2023: separately stated delivery charges excluded
  KY: "taxable", // KRS 139.010: sales price includes delivery charges (SST)
  LA: "taxable", // La. R.S. 47:301(13): delivery charges taxable when incurred before title passes (shipping-terms dependent)
  ME: "exempt_if_separately_stated", // 36 M.R.S. 1752(14)(B)(4): separately stated shipping to the buyer excluded
  MD: "exempt_if_separately_stated", // COMAR 03.06.01.08: separately stated delivery charges not taxable
  MA: "exempt_if_separately_stated", // 830 CMR 64H.1.6: separately stated, reasonable delivery charges excluded
  MI: "exempt_if_separately_stated", // MCL 205.51(1)(d) as amended 2023 PA 20: separately stated delivery charges excluded
  MN: "taxable", // Minn. Stat. 297A.61 subd. 7: sales price includes delivery charges (SST)
  MS: "taxable", // Miss. Code 27-65-3(h): gross proceeds include transportation charges
  MO: "taxable", // 12 CSR 10-103.600: exempt only if separately stated AND optional; mandatory delivery taxable
  MT: "exempt", // no sales tax
  NE: "taxable", // Neb. Rev. Stat. 77-2701.35: sales price includes delivery charges (SST)
  NV: "exempt_if_separately_stated", // NAC 372.101: separately stated shipping by common carrier excluded
  NH: "exempt", // no sales tax
  NJ: "taxable", // N.J.S.A. 54:32B-2(oo): sales price includes delivery charges (SST)
  NM: "taxable", // NMSA 7-9-3.5: gross receipts include shipping charged to the buyer
  NY: "taxable", // Tax Law 1101(b)(3); TB-ST-838: shipping/delivery charges taxable on taxable goods
  NC: "taxable", // N.C.G.S. 105-164.3: sales price includes delivery charges (SST)
  ND: "taxable", // N.D.C.C. 57-39.2-01: sales price includes delivery charges (SST)
  OH: "taxable", // R.C. 5739.01(H)(1)(b)(v): price includes delivery charges (SST)
  OK: "exempt_if_separately_stated", // 68 O.S. 1352(22)/OAC 710:65-1-11: separately stated delivery charges excluded
  OR: "exempt", // no sales tax
  PA: "taxable", // 61 Pa. Code 54.1: delivery charges on taxable goods are taxable
  RI: "taxable", // R.I. Gen. Laws 44-18-12: sales price includes delivery charges (SST)
  SC: "taxable", // S.C. Code 12-36-90: gross proceeds include transportation charges
  SD: "taxable", // SDCL 10-45-1(14): sales price includes delivery charges (SST)
  TN: "taxable", // Tenn. Code 67-6-102: sales price includes delivery charges (SST)
  TX: "taxable", // 34 TAC 3.303: shipping/handling charges for taxable items are taxable
  UT: "exempt_if_separately_stated", // Utah Code 59-12-102 'sales price' excludes separately stated delivery charges (SST)
  VT: "taxable", // 32 V.S.A. 9701(4): sales price includes delivery charges (SST)
  VA: "exempt_if_separately_stated", // 23 VAC 10-210-6010 / Va. Code 58.1-609.5(3): separately stated transportation exempt
  WA: "taxable", // WAC 458-20-110: delivery charges are part of selling price
  WV: "taxable", // W. Va. Code 11-15B-2: sales price includes delivery charges (SST)
  WI: "taxable", // Wis. Stat. 77.51(15b)(a)4: sales price includes delivery charges (SST)
  WY: "exempt_if_separately_stated", // Wyo. Rules ch. 2 s.15: separately stated transportation charges excluded (SST)
};

export const STATE_NOTES: Record<string, string> = {
  AK: "No state tax. ARSSTC member jurisdictions follow the Uniform Code (separately stated shipping excluded); a few home-rule cities can differ. Avalara exempted every AK shipping line.",
  CA: "Exempt only if delivered by common carrier/USPS and the charge does not exceed actual cost; a flat charge above cost makes the excess taxable.",
  CO: "Statute exempts separately stated delivery only when the buyer could avoid it (pickup option). The store has no pickup, so it is taxable - Avalara taxed every CO shipping line. Home-rule cities follow their own codes.",
  FL: "Taxable because delivery is mandatory and title passes at the buyer's address; would be exempt only if the customer could pick up.",
  IL: "Taxable when the buyer has no option to pick up (Kean v. Wal-Mart line of cases). Avalara taxed every IL shipping line.",
  KS: "Exempt since 2023-07-01 (SB 248). Before that date shipping was taxable.",
  LA: "Taxable when the seller pays for delivery before title passes (typical FOB-destination e-commerce). Avalara taxed every LA shipping line.",
  MI: "Exempt since 2023-04-26 (2023 PA 20) when separately stated; before that, taxable.",
  MO: "Exempt only if separately stated AND the buyer could choose not to have it delivered; mandatory delivery is taxable. Avalara taxed every MO shipping line.",
  NY: "Shipping on a mix of taxable and exempt goods is taxed pro rata.",
  TX: "Handling and shipping on taxable items is taxable; on exempt items it is exempt.",
  HI: "GET is on the seller's gross income, including shipping.",
  AL: "Exempt when separately stated and title passes on delivery; remote sellers in SSUT collect the flat 8% on the item price only.",
  DE: "No sales tax.",
  MT: "No general sales tax (resort-area local taxes do not apply to remote sales).",
  NH: "No sales tax.",
  OR: "No sales tax.",
};

export function shippingTaxable(state: string): ShippingTaxability {
  return RULES[state.toUpperCase()] ?? "taxable";
}
