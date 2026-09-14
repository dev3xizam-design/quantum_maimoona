import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"), // admin | viewer
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Ingestion                                                           */
/* ------------------------------------------------------------------ */

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  kind: text("kind").notNull(), // avalara | purchases | products | shipments
  rowCount: integer("row_count").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | complete | failed
  stats: jsonb("stats").$type<Record<string, unknown>>(),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per Avalara export row (i.e. per jurisdiction per line item).
 * The file is PRE-EXPLODED by jurisdiction - see doc 04. Dedupe happens in
 * the engine, never on ingest, so the raw truth is preserved.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    uploadId: integer("upload_id").references(() => uploads.id, { onDelete: "cascade" }),
    sourceFile: text("source_file"),

    documentId: text("document_id").notNull(),
    lineNo: text("line_no").notNull(),
    ref1: text("ref1"),
    documentStatus: text("document_status"),
    docType: text("doc_type"), // Sales Invoice | Return Invoice
    sign: integer("sign").notNull().default(1), // -1 for Return Invoice

    documentDate: date("document_date"),
    period: text("period").notNull(), // YYYY-MM
    reportingDate: date("reporting_date"),
    taxCalcDate: date("tax_calc_date"),

    state: text("state").notNull(),
    destCounty: text("dest_county"),
    destCity: text("dest_city"),
    destZip: text("dest_zip"),

    jurisdictionType: text("jurisdiction_type"), // State | County | City | Special Tax Jurisdiction
    jurisdictionDescription: text("jurisdiction_description"),
    taxTypeDescription: text("tax_type_description"),

    rate: numeric("rate", { precision: 12, scale: 8 }).notNull().default("0"),
    lineAmount: numeric("line_amount", { precision: 18, scale: 4 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 4 }).notNull().default("0"),
    taxableAmount: numeric("taxable_amount", { precision: 18, scale: 4 }).notNull().default("0"),
    exemptAmount: numeric("exempt_amount", { precision: 18, scale: 4 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 4 }).notNull().default("0"),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default("0"),

    itemCode: text("item_code"),
    itemDescription: text("item_description"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tx_state_period_idx").on(t.state, t.period),
    index("tx_period_idx").on(t.period),
    index("tx_doc_idx").on(t.documentId, t.lineNo),
    uniqueIndex("tx_dedupe_idx").on(
      t.documentId,
      t.lineNo,
      t.jurisdictionType,
      t.jurisdictionDescription,
      t.itemCode,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* Editable, effective-dated config                                    */
/* ------------------------------------------------------------------ */

export const stateTaxConfig = pgTable(
  "state_tax_config",
  {
    id: serial("id").primaryKey(),
    state: text("state").notNull(),
    taxType: text("tax_type").notNull(), // sales | excise | pact
    frequency: text("frequency").notNull().default("MONTHLY"), // MONTHLY | QUARTERLY | ANNUAL | NONE
    stateRate: numeric("state_rate", { precision: 12, scale: 8 }).notNull().default("0"),
    hasLocal: boolean("has_local").notNull().default(false),
    allocation: text("allocation").notNull().default("flat"),
    // flat | county | city_county | az_region | pa_columns | fl_surtax | none
    rounding: text("rounding").notNull().default("cents"), // cents | whole_dollar
    portal: text("portal"),
    formName: text("form_name"),
    dueDay: integer("due_day").default(20),
    rateLabel: text("rate_label"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stc_lookup_idx").on(t.state, t.taxType, t.effectiveFrom)],
);

export const jurisdictionCodes = pgTable(
  "jurisdiction_codes",
  {
    id: serial("id").primaryKey(),
    state: text("state").notNull(),
    jurisdictionName: text("jurisdiction_name").notNull(),
    jurisdictionType: text("jurisdiction_type").notNull(), // county | city | local | special
    officialCode: text("official_code").notNull(),
    /** For OK: the county COPO code this city row must be paired with. */
    pairedCode: text("paired_code"),
    pairedName: text("paired_name"),
    rate: numeric("rate", { precision: 12, scale: 8 }),
    /** True when the published rate already includes the state rate (WY, AZ counties). */
    rateIncludesState: boolean("rate_includes_state").notNull().default(false),
    /** Avalara's jurisdiction description that maps here (e.g. "Edmond" -> OKC). */
    avalaraAlias: text("avalara_alias"),
    notes: text("notes"),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jc_lookup_idx").on(t.state, t.jurisdictionType, t.jurisdictionName)],
);

export const exciseConfig = pgTable(
  "excise_config",
  {
    id: serial("id").primaryKey(),
    state: text("state").notNull(),
    structure: text("structure").notNull(), // A | B | C | D | E
    basis: text("basis").notNull().default("SALES"), // SALES | RECEIPTS
    /** Structures A-D use these. */
    rate: numeric("rate", { precision: 12, scale: 8 }).notNull().default("0"),
    rateUnit: text("rate_unit").notNull().default("pct_wholesale"),
    // pct_wholesale | pct_retail | per_ml | per_unit
    /** Structure E (bifurcated). */
    openRate: numeric("open_rate", { precision: 12, scale: 8 }),
    openRateUnit: text("open_rate_unit"),
    closedRate: numeric("closed_rate", { precision: 12, scale: 8 }),
    closedRateUnit: text("closed_rate_unit"),
    frequency: text("frequency").notNull().default("MONTHLY"),
    portal: text("portal"),
    formName: text("form_name"),
    dueDay: integer("due_day").default(20),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ec_lookup_idx").on(t.state, t.effectiveFrom)],
);

export const nexusThresholds = pgTable("nexus_thresholds", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  amountThreshold: numeric("amount_threshold", { precision: 18, scale: 2 }),
  txnThreshold: integer("txn_threshold"),
  notes: text("notes"),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
});

/** Non-secret filing identifiers only. NEVER store portal passwords/PINs/cards. */
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  taxType: text("tax_type").notNull(),
  accountNumber: text("account_number"),
  licenseNumber: text("license_number"),
  loginField: text("login_field"),
  frequencyOverride: text("frequency_override"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Excise source data                                                  */
/* ------------------------------------------------------------------ */

/**
 * The product master. Most of it BUILDS ITSELF from the Avalara export - every
 * line carries an item code, a name, a quantity and a line amount, so the SKU
 * list, the descriptions and the real selling prices are all derivable. Only
 * what genuinely is not in the sales data (wholesale cost, and mL for pods)
 * needs a human, and the dashboard sorts those by revenue so the SKUs that
 * matter come first.
 *
 * `lockedFields` holds the names of fields a human has set. The deriver never
 * overwrites those, so a manual correction survives every future upload.
 */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  description: text("description"),

  /* Effective values the engine reads (manual value wins over derived). */
  wholesaleCost: numeric("wholesale_cost", { precision: 18, scale: 4 }),
  retailPrice: numeric("retail_price", { precision: 18, scale: 4 }),
  liquidMl: numeric("liquid_ml", { precision: 12, scale: 4 }),
  cartridgesPerUnit: numeric("cartridges_per_unit", { precision: 12, scale: 4 }),
  systemType: text("system_type"), // OPEN | CLOSED
  containsNicotine: boolean("contains_nicotine").notNull().default(true),

  /* Observed from the transactions - evidence, never overwritten by hand. */
  observedUnitPrice: numeric("observed_unit_price", { precision: 18, scale: 4 }),
  observedUnitCost: numeric("observed_unit_cost", { precision: 18, scale: 4 }),
  unitsSold: numeric("units_sold", { precision: 18, scale: 4 }).notNull().default("0"),
  revenue: numeric("revenue", { precision: 18, scale: 4 }).notNull().default("0"),
  lineCount: integer("line_count").notNull().default(0),
  statesSold: text("states_sold").array(),
  firstSeen: date("first_seen"),
  lastSeen: date("last_seen"),

  /* Provenance so the UI can show what is measured vs parsed vs assumed. */
  priceSource: text("price_source").default("unknown"), // observed | manual | unknown
  costSource: text("cost_source").default("unknown"), // purchases | manual | estimated | unknown
  mlSource: text("ml_source").default("unknown"), // parsed | manual | unknown
  systemTypeSource: text("system_type_source").default("unknown"), // inferred | manual | unknown
  classificationNote: text("classification_note"),

  lockedFields: jsonb("locked_fields").$type<string[]>().default([]),
  /** Derived fact: something the excise engines need is missing. */
  needsReview: boolean("needs_review").notNull().default(false),
  /**
   * A person's acknowledgement, kept SEPARATE from needsReview. Reviewing a SKU
   * says "I have looked at this", not "the data is now complete" - the gap is
   * still reported to excise, and the Missing cost / Missing mL tabs still
   * count it. Otherwise a bulk review would quietly hide an understated return.
   */
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Monthly purchases/receipts - the basis for RECEIPTS-basis excise (KS EC-2). */
export const purchases = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),
    uploadId: integer("upload_id").references(() => uploads.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    state: text("state"),
    sku: text("sku"),
    description: text("description"),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default("0"),
    mlTotal: numeric("ml_total", { precision: 18, scale: 4 }).notNull().default("0"),
    unitsTotal: numeric("units_total", { precision: 18, scale: 4 }).notNull().default("0"),
    wholesaleCost: numeric("wholesale_cost", { precision: 18, scale: 4 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("purch_period_idx").on(t.period, t.state)],
);

/** PACT Act shipment feed - customer PII. Restricted, never logged. */
export const shipments = pgTable(
  "shipments",
  {
    id: serial("id").primaryKey(),
    uploadId: integer("upload_id").references(() => uploads.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    state: text("state").notNull(),
    customerName: text("customer_name"),
    shipToAddress: text("ship_to_address"),
    shipToCity: text("ship_to_city"),
    shipToState: text("ship_to_state"),
    shipToZip: text("ship_to_zip"),
    invoiceDate: date("invoice_date"),
    invoiceNumber: text("invoice_number"),
    product: text("product"),
    brand: text("brand"),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default("0"),
    mlTotal: numeric("ml_total", { precision: 18, scale: 4 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ship_period_state_idx").on(t.period, t.state)],
);

/* ------------------------------------------------------------------ */
/* Filing lifecycle                                                    */
/* ------------------------------------------------------------------ */

export const filings = pgTable(
  "filings",
  {
    id: serial("id").primaryKey(),
    state: text("state").notNull(),
    taxType: text("tax_type").notNull(),
    period: text("period").notNull(), // YYYY-MM | YYYY-Qn | YYYY
    status: text("status").notNull().default("not_started"), // not_started | ready | filed
    dueDate: date("due_date"),
    gross: numeric("gross", { precision: 18, scale: 4 }),
    exempt: numeric("exempt", { precision: 18, scale: 4 }),
    taxable: numeric("taxable", { precision: 18, scale: 4 }),
    taxComputed: numeric("tax_computed", { precision: 18, scale: 4 }),
    taxCollected: numeric("tax_collected", { precision: 18, scale: 4 }),
    delta: numeric("delta", { precision: 18, scale: 4 }),
    result: jsonb("result").$type<Record<string, unknown>>(),
    filedAt: timestamp("filed_at", { withTimezone: true }),
    filedBy: text("filed_by"),
    confirmationNumber: text("confirmation_number"),
    amountPaid: numeric("amount_paid", { precision: 18, scale: 4 }),
    notes: text("notes"),
    computedAt: timestamp("computed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("filing_unique_idx").on(t.state, t.taxType, t.period)],
);

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export const changeLog = pgTable("change_log", {
  id: serial("id").primaryKey(),
  actor: text("actor"),
  tableName: text("table_name").notNull(),
  rowId: integer("row_id"),
  action: text("action").notNull(), // create | update | delete
  before: jsonb("before"),
  after: jsonb("after"),
  effectiveFrom: date("effective_from"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runLog = pgTable("run_log", {
  id: serial("id").primaryKey(),
  period: text("period").notNull(),
  actor: text("actor"),
  status: text("status").notNull().default("running"),
  summary: jsonb("summary"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/**
 * A month, stored as a thing in its own right - not just a date filter over
 * filings. Closing a month writes the snapshot: what every state owed, what was
 * collected, what needed attention, and who computed it when. The month page
 * reads this, so it stays stable even as later uploads change the underlying
 * transactions.
 */
export const monthlySnapshots = pgTable(
  "monthly_snapshots",
  {
    id: serial("id").primaryKey(),
    month: text("month").notNull(), // YYYY-MM
    status: text("status").notNull().default("open"), // open | closed
    totals: jsonb("totals").$type<Record<string, unknown>>(),
    states: jsonb("states").$type<Record<string, unknown>[]>(),
    statesWithActivity: integer("states_with_activity").notNull().default(0),
    gross: numeric("gross", { precision: 18, scale: 4 }).notNull().default("0"),
    taxable: numeric("taxable", { precision: 18, scale: 4 }).notNull().default("0"),
    salesTax: numeric("sales_tax", { precision: 18, scale: 4 }).notNull().default("0"),
    exciseTax: numeric("excise_tax", { precision: 18, scale: 4 }).notNull().default("0"),
    totalTax: numeric("total_tax", { precision: 18, scale: 4 }).notNull().default("0"),
    collected: numeric("collected", { precision: 18, scale: 4 }).notNull().default("0"),
    delta: numeric("delta", { precision: 18, scale: 4 }).notNull().default("0"),
    pactShipments: integer("pact_shipments").notNull().default(0),
    warnings: integer("warnings").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }),
    computedBy: text("computed_by"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by"),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("monthly_snapshot_month_idx").on(t.month)],
);

/* ------------------------------------------------------------------ */
/* Integrations                                                        */
/* ------------------------------------------------------------------ */

/**
 * Credentials for a system Quantum talks to on your behalf - currently Medusa.
 *
 * This is NOT the same as a state-portal password, which must never be stored
 * anywhere: this is an integration key the app needs to hold in order to work
 * at all. It is encrypted at rest with a key derived from AUTH_SECRET, never
 * returned to the browser, and never written to a log. Only the last four
 * characters are shown, so you can tell which key is loaded.
 */
export const integrations = pgTable(
  "integrations",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(), // medusa
    baseUrl: text("base_url").notNull(),
    secretCipher: text("secret_cipher"),
    secretLast4: text("secret_last4"),
    authScheme: text("auth_scheme"), // basic-colon | basic-raw | bearer
    status: text("status").notNull().default("unconfigured"), // unconfigured | ok | error
    lastError: text("last_error"),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    stats: jsonb("stats").$type<Record<string, unknown>>(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("integration_provider_idx").on(t.provider)],
);

/**
 * A mirror of the Medusa catalog. Kept separate from `products` on purpose:
 * `products` is what the tax engines read and is keyed on the item code Avalara
 * reports, while this is whatever Medusa happens to hold. Matching the two is
 * an explicit, reviewable step rather than a silent merge.
 */
export const medusaProducts = pgTable(
  "medusa_products",
  {
    id: serial("id").primaryKey(),
    variantId: text("variant_id").notNull(),
    productId: text("product_id"),
    productTitle: text("product_title"),
    variantTitle: text("variant_title"),
    sku: text("sku"),
    barcode: text("barcode"),
    ean: text("ean"),
    upc: text("upc"),
    wholesaleCost: numeric("wholesale_cost", { precision: 18, scale: 4 }),
    liquidMl: numeric("liquid_ml", { precision: 12, scale: 4 }),
    systemType: text("system_type"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** The `products.sku` this variant was matched to, and how. */
    matchedSku: text("matched_sku"),
    matchMethod: text("match_method"), // barcode | upc | ean | sku | none
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("medusa_variant_idx").on(t.variantId),
    index("medusa_barcode_idx").on(t.barcode),
    index("medusa_sku_idx").on(t.sku),
    index("medusa_matched_idx").on(t.matchedSku),
  ],
);
