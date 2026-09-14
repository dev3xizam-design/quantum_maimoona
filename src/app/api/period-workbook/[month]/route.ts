import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { computePeriodEverything } from "@/lib/period";
import { buildPeriodWorkbook, periodWorkbookFilename } from "@/lib/excel/period-workbook";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * The whole month, every state, one workbook - a tab per state.
 * Computing and persisting happen here too, so downloading the workbook and
 * "the month is done and stored" are the same action.
 */
export async function GET(req: Request, { params }: { params: Promise<{ month: string }> }) {
  const session = await getSession();
  // A download is a browser navigation, so an expired session should land
  // on the sign-in page rather than dumping raw JSON into the tab.
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Month must be in YYYY-MM form, e.g. 2026-08." }, { status: 400 });
  }

  const includeQuietStates = new URL(req.url).searchParams.get("all") === "1";

  try {
    const comp = await computePeriodEverything(month, { persist: true });
    const buffer = await buildPeriodWorkbook(comp, {
      company: process.env.COMPANY_NAME ?? "Maximum Vapor Inc.",
      fein: process.env.COMPANY_FEIN ?? "82-1098441",
      includeQuietStates,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${periodWorkbookFilename(month)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
