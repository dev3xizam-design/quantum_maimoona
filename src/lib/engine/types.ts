export type TxRow = {
  documentId: string;
  lineNo: string;
  ref1: string | null;
  itemCode: string | null;
  itemDescription: string | null;
  docType: string | null;
  documentDate: string | null;
  period: string;
  state: string;
  destCounty: string | null;
  destCity: string | null;
  destZip: string | null;
  jurisdictionType: string | null;
  jurisdictionDescription: string | null;
  rate: number;
  lineAmount: number;
  discountAmount: number;
  taxableAmount: number;
  exemptAmount: number;
  taxAmount: number;
  quantity: number;
};

export type JurisdictionLine = {
  type: string;
  name: string;
  county: string | null;
  city: string | null;
  code: string | null;
  pairedCode: string | null;
  pairedName: string | null;
  gross: number;
  exempt: number;
  taxable: number;
  rate: number;
  tax: number;
  taxComputed: number;
  unmapped: boolean;
};

export type SalesResult = {
  state: string;
  taxType: "sales";
  period: string;
  periodLabel: string;
  frequency: string;
  form: string | null;
  portal: string | null;
  dueDate: string;
  rounding: string;
  allocation: string;
  stateRate: number;
  hasLocal: boolean;
  gross: number;
  exempt: number;
  taxable: number;
  taxCollected: number;
  taxComputed: number;
  delta: number;
  stateTaxCollected: number;
  localTaxCollected: number;
  reconciles: boolean;
  reconcileDiff: number;
  documentCount: number;
  lineCount: number;
  rowCount: number;
  returnLineCount: number;
  byJurisdiction: JurisdictionLine[];
  byCounty: JurisdictionLine[];
  byCity: JurisdictionLine[];
  notes: string[];
  warnings: string[];
};

export type ExciseComponent = {
  label: string;
  basisLabel: string;
  basisAmount: number;
  rate: number;
  rateUnit: string;
  tax: number;
};

export type ExciseResult = {
  state: string;
  taxType: "excise";
  period: string;
  periodLabel: string;
  structure: string;
  basis: "SALES" | "RECEIPTS";
  frequency: string;
  form: string | null;
  portal: string | null;
  dueDate: string;
  totalMl: number;
  totalUnits: number;
  totalCartridges: number;
  wholesaleCost: number;
  retailPrice: number;
  components: ExciseComponent[];
  taxComputed: number;
  skuCoverage: { total: number; matched: number; missing: string[] };
  notes: string[];
  warnings: string[];
};

export type PactRow = {
  customerName: string | null;
  shipToAddress: string | null;
  shipToCity: string | null;
  shipToState: string | null;
  shipToZip: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  product: string | null;
  brand: string | null;
  quantity: number;
  ml: number;
};

export type PactResult = {
  state: string;
  taxType: "pact";
  period: string;
  periodLabel: string;
  dueDate: string;
  frequency: string;
  portal: string | null;
  form: string | null;
  rows: PactRow[];
  shipmentCount: number;
  totalQuantity: number;
  totalMl: number;
  source: "shipments" | "transactions";
  notes: string[];
  warnings: string[];
};

export type AnyResult = SalesResult | ExciseResult | PactResult;
