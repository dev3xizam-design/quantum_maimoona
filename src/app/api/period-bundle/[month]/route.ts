import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getSession } from "@/lib/auth";
import { computePeriodEverything } from "@/lib/period";
import { buildWorkbook, workbookFilename } from "@/lib/excel/workbook";
import { buildPeriodWorkbook, periodWorkbookFilename } from "@/lib/excel/period-workbook";
import { STATE_NAMES } from "@/lib/states";
import { periodLabel } from "@/lib/periods";
import { fmtMoney } from "@/lib/money";
import type { FormCtx } from "@/lib/excel/forms/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Every state as its OWN workbook, each with the full five-tab set - Filing
 * Sheet, Return, Jurisdiction Detail, Reconciliation, Notes - plus the
 * consolidated all-states workbook, zipped into one folder per state.
 */
export async function GET(req: Request, { params }: { params: Promise<{ month: string }> }) {
  const session = await getSession();
  // A download is a browser navigation, so an expired session should land
  // on the sign-in page rather than dumping raw JSON into the tab.
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Month must be YYYY-MM, e.g. 2026-08." }, { status: 400 });
  }

  const company = process.env.COMPANY_NAME ?? "Maximum Vapor Inc.";
  const fein = process.env.COMPANY_FEIN ?? "82-1098441";

  try {
    const comp = await computePeriodEverything(month, { persist: true });
    const zip = new JSZip();

    zip.file(
      periodWorkbookFilename(month),
      await buildPeriodWorkbook(comp, { company, fein }),
    );

    const index: string[] = [];

    for (const b of comp.bundles) {
      if (!b.hasActivity) continue;
      const folder = zip.folder(`${b.state} - ${STATE_NAMES[b.state] ?? b.state}`)!;
      const ctx: FormCtx = {
        company,
        fein,
        accountNumber: b.account?.accountNumber ?? null,
        licenseNumber: b.account?.licenseNumber ?? b.exciseAccount?.licenseNumber ?? null,
        loginField: null,
        accountNotes: null,
      };

      const parts: string[] = [];
      if (b.sales) {
        folder.file(workbookFilename(b.sales), await buildWorkbook(b.sales, ctx));
        parts.push(`sales ${fmtMoney(b.sales.taxComputed)} due ${b.sales.dueDate}`);
      }
      if (b.excise) {
        folder.file(workbookFilename(b.excise), await buildWorkbook(b.excise, ctx));
        parts.push(`excise ${fmtMoney(b.excise.taxComputed)} due ${b.excise.dueDate}`);
      }
      if (b.pact && b.pact.shipmentCount > 0) {
        folder.file(workbookFilename(b.pact), await buildWorkbook(b.pact, ctx));
        parts.push(`PACT ${b.pact.shipmentCount} lines due ${b.pact.dueDate}`);
      }
      index.push(`${b.state}  ${(STATE_NAMES[b.state] ?? "").padEnd(22)} ${parts.join("  |  ")}`);
    }

    zip.file("READ ME FIRST.txt", readme(month, comp.totals, index));

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Quantum_${month}_all_states.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function readme(
  month: string,
  totals: Awaited<ReturnType<typeof computePeriodEverything>>["totals"],
  index: string[],
): string {
  return [
    `QUANTUM TAX AUTOMATION - ${periodLabel(month)}`,
    "=".repeat(66),
    "",
    "WHAT IS IN HERE",
    "",
    `  ${periodWorkbookFilename(month)}`,
    "      Every state in one workbook - a tab per state, plus Summary and",
    "      Action Items. Start here.",
    "",
    "  One folder per state",
    "      That state's returns as separate workbooks, each with the full",
    "      five-tab set: Filing Sheet, Return, Jurisdiction Detail,",
    "      Reconciliation, Notes.",
    "",
    "HOW TO WORK THROUGH IT",
    "",
    "  1. Open the all-states workbook and read the Action Items tab.",
    "     Resolve everything on it before filing anything.",
    "  2. Take one state at a time. Open its folder, open the sales workbook,",
    "     and use the Filing Sheet tab - it lists the portal, the form and the",
    "     numbers in the order the portal asks for them.",
    "  3. File the excise return separately. It is a different account with a",
    "     different base - it is never part of the sales tax return.",
    "  4. File the PACT report by the 10th. That is earlier than sales tax.",
    "  5. Mark each return as filed in Quantum with its confirmation number.",
    "",
    "TOTALS FOR THE PERIOD",
    "",
    `  States with activity   ${totals.statesWithActivity} of ${totals.states} registered`,
    `  Gross sales            ${fmtMoney(totals.gross)}`,
    `  Taxable sales          ${fmtMoney(totals.taxable)}`,
    `  Sales tax due          ${fmtMoney(totals.salesTax)}`,
    `  Vapor excise due       ${fmtMoney(totals.exciseTax)}`,
    `  TOTAL TAX DUE          ${fmtMoney(totals.totalTax)}`,
    `  Collected by Avalara   ${fmtMoney(totals.collected)}`,
    `  Under/over-collection  ${fmtMoney(totals.delta)}`,
    `  PACT shipment lines    ${totals.pactShipments}`,
    `  Items needing action   ${totals.warnings}`,
    totals.reconcileFailures.length
      ? `  RECONCILIATION FAILED  ${totals.reconcileFailures.join(", ")} - do not file these`
      : "  Reconciliation         all states passed",
    "",
    "STATE INDEX",
    "",
    ...index.map((l) => `  ${l}`),
    "",
    "=".repeat(66),
    "Quantum prepares returns; a person files them. Every figure is a formula",
    "or a lookup against an editable rate table - nothing is estimated. This is",
    "an accounting tool, not tax advice.",
    "",
    "Never record a portal password, PIN, card number or bank login here.",
  ].join("\n");
}
