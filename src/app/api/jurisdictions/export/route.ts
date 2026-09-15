import { NextResponse } from "next/server";
import { and, asc, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { jurisdictionDirectory } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { STATE_NAMES } from "@/lib/states";
import { JURISDICTION_TYPES, buildDirectoryWorkbook, directoryToCsv } from "@/lib/jurisdictions/directory";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * One state's slice of the directory. Nationwide files are static in
 * public/downloads - the whole country is larger than a Vercel function may return.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const sp = new URL(req.url).searchParams;
  const state = (sp.get("state") ?? "").toUpperCase();
  if (!STATE_NAMES[state]) {
    return NextResponse.json(
      { error: "Pick a state. The nationwide files are at /downloads/us-jurisdictions.xlsx and .csv." },
      { status: 400 },
    );
  }
  const cat = sp.get("cat") === "government" || sp.get("cat") === "all" ? sp.get("cat") : "tax";
  const type = sp.get("type") ?? "";
  const q = (sp.get("q") ?? "").trim();
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";

  const filters = [
    eq(jurisdictionDirectory.state, state),
    cat !== "all" ? eq(jurisdictionDirectory.category, cat as string) : undefined,
    (JURISDICTION_TYPES as readonly string[]).includes(type) ? eq(jurisdictionDirectory.jurisdictionType, type) : undefined,
    q
      ? dsql`(${jurisdictionDirectory.jurisdictionName} ILIKE ${"%" + q + "%"} OR ${jurisdictionDirectory.officialCode} ILIKE ${q + "%"} OR ${jurisdictionDirectory.countyName} ILIKE ${"%" + q + "%"})`
      : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(jurisdictionDirectory)
    .where(and(...filters))
    .orderBy(asc(jurisdictionDirectory.category), asc(jurisdictionDirectory.jurisdictionType), asc(jurisdictionDirectory.jurisdictionName));

  const name = `${state}-jurisdictions-${cat}`;
  if (format === "csv") {
    return new NextResponse(directoryToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const buffer = await buildDirectoryWorkbook(rows, {
    title: `${STATE_NAMES[state]} jurisdictions - Quantum`,
    builtOn: new Date().toISOString().slice(0, 10),
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
