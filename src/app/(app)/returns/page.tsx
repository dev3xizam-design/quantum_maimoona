import { desc } from "drizzle-orm";
import { db } from "@/db";
import { filings } from "@/db/schema";
import { num } from "@/lib/money";
import { ReturnsTable, type ReturnRow } from "./ReturnsTable";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const raw = await db.select().from(filings).orderBy(desc(filings.period), filings.state).limit(1000);
  const today = new Date().toISOString().slice(0, 10);

  const rows: ReturnRow[] = raw.map((f) => ({
    id: f.id,
    state: f.state,
    taxType: f.taxType,
    period: f.period,
    dueDate: f.dueDate,
    status:
      f.status === "filed"
        ? "filed"
        : f.dueDate && f.dueDate < today
          ? "overdue"
          : (f.status ?? "ready"),
    taxable: f.taxable === null ? null : num(f.taxable),
    taxComputed: f.taxComputed === null ? null : num(f.taxComputed),
    taxCollected: f.taxCollected === null ? null : num(f.taxCollected),
    delta: f.delta === null ? null : num(f.delta),
    confirmationNumber: f.confirmationNumber,
  }));

  return <ReturnsTable rows={rows} />;
}
