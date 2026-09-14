import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAccount } from "@/lib/config";
import { computeAndPersist } from "@/lib/compute";
import { buildWorkbook, workbookFilename } from "@/lib/excel/workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ state: string; taxType: string; period: string }> },
) {
  const session = await getSession();
  // A download is a browser navigation, so an expired session should land
  // on the sign-in page rather than dumping raw JSON into the tab.
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { state, taxType, period } = await params;

  try {
    const result = await computeAndPersist(state.toUpperCase(), taxType, period);

    // Never emit a worksheet that fails the reconciliation invariant.
    if (result.taxType === "sales" && !result.reconciles) {
      return NextResponse.json(
        {
          error: "Reconciliation failed - Taxable + Exempt does not equal Gross.",
          difference: result.reconcileDiff,
          hint: "Re-check the upload for duplicate rows or a partially covered period before filing.",
        },
        { status: 409 },
      );
    }

    const account = await getAccount(state.toUpperCase(), taxType);
    const buffer = await buildWorkbook(result, {
      company: process.env.COMPANY_NAME ?? "Maximum Vapor Inc.",
      fein: process.env.COMPANY_FEIN ?? "82-1098441",
      accountNumber: account?.accountNumber ?? null,
      licenseNumber: account?.licenseNumber ?? null,
      loginField: account?.loginField ?? null,
      accountNotes: account?.notes ?? null,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${workbookFilename(result)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
