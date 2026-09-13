import { desc } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  avalara: "Avalara export",
  products: "Product master",
  purchases: "Purchases",
  shipments: "PACT shipments",
};

export default async function UploadHistoryPage() {
  const recent = await db.select().from(uploads).orderBy(desc(uploads.createdAt)).limit(100);

  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">Recent uploads</div>
      <table className="grid">
        <thead>
          <tr>
            <th>File</th>
            <th>Kind</th>
            <th className="num">Rows</th>
            <th>Status</th>
            <th>Uploaded by</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((u) => (
            <tr key={u.id} className={u.status === "failed" ? "flagged" : ""}>
              <td className="max-w-[380px] truncate font-medium">{u.filename}</td>
              <td>{KIND_LABEL[u.kind] ?? u.kind}</td>
              <td className="num">{u.rowCount.toLocaleString()}</td>
              <td>
                <span
                  className={`badge ${
                    u.status === "complete"
                      ? "badge-filed"
                      : u.status === "failed"
                        ? "badge-overdue"
                        : "badge-not_started"
                  }`}
                >
                  {u.status}
                </span>
              </td>
              <td className="text-[12px] text-[var(--muted)]">{u.uploadedBy}</td>
              <td className="whitespace-nowrap text-[12px] text-[var(--muted)]">
                {u.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {recent.length === 0 && <div className="empty">Nothing uploaded yet.</div>}
    </div>
  );
}
