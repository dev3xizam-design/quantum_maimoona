import { redirect } from "next/navigation";
import { monthKey } from "@/lib/periods";

/** Close-month lives under Months now - one place per month, not two. */
export default async function PeriodRedirect({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const now = new Date();
  const fallback = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  redirect(`/months/${month ?? fallback}`);
}
