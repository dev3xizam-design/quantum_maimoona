import { db } from "@/db";
import { uploads } from "@/db/schema";
import { UploadTabs } from "./UploadTabs";

export const dynamic = "force-dynamic";

export default async function UploadLayout({ children }: { children: React.ReactNode }) {
  let historyCount = 0;
  try {
    historyCount = (await db.select({ id: uploads.id }).from(uploads)).length;
  } catch {
    historyCount = 0;
  }

  return (
    <div>
      <UploadTabs historyCount={historyCount} />
      {children}
    </div>
  );
}
