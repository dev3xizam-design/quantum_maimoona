import type { ExciseResult, PactResult, SalesResult } from "@/lib/engine/types";

export type LineFormat = "money" | "money0" | "pct" | "qty" | "text";

export type ReturnLine =
  | { kind: "section"; label: string }
  | { kind: "blank" }
  | {
      kind: "line";
      line?: string;
      label: string;
      value: number | string | null;
      format?: LineFormat;
      highlight?: boolean;
      note?: string;
    };

export type FormCtx = {
  company: string;
  fein: string;
  accountNumber: string | null;
  licenseNumber: string | null;
  loginField: string | null;
  accountNotes: string | null;
};

export type SalesFormSpec = {
  id: string;
  title: string;
  lines: (r: SalesResult, ctx: FormCtx) => ReturnLine[];
  steps: (r: SalesResult, ctx: FormCtx) => string[];
};

export type ExciseFormSpec = {
  id: string;
  title: string;
  lines: (r: ExciseResult, ctx: FormCtx) => ReturnLine[];
  steps: (r: ExciseResult, ctx: FormCtx) => string[];
};

export type PactFormSpec = {
  id: string;
  title: string;
  steps: (r: PactResult, ctx: FormCtx) => string[];
};
