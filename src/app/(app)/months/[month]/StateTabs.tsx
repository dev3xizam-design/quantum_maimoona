"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { StateMonth } from "@/lib/months";
import { stateName } from "@/lib/states";

/**
 * One tab per state for the month - the same shape as the workbook, so the
 * screen and the spreadsheet read the same way.
 */
export function StateTabs({ month, states }: { month: string; states: StateMonth[] }) {
  const pathname = usePathname();
  const [showQuiet, setShowQuiet] = useState(false);

  const active = states.filter((s) => s.hasActivity);
  const quiet = states.filter((s) => !s.hasActivity);
  const shown = showQuiet ? [...active, ...quiet] : active;

  return (
    <div>
      <nav className="tabs">
        <Link
          href={`/months/${month}`}
          className="tab"
          data-active={pathname === `/months/${month}`}
        >
          All states
          <span className="tab-count">{active.length}</span>
        </Link>

        {shown.map((s) => {
          const href = `/months/${month}/${s.state}`;
          const flagged = s.warnings > 0 || !s.reconciles;
          return (
            <Link
              key={s.state}
              href={href}
              className="tab"
              data-active={pathname === href}
              title={`${stateName(s.state)}${s.hasActivity ? "" : " — no activity"}`}
            >
              <span className={s.hasActivity ? "" : "opacity-55"}>{s.state}</span>
              {flagged && (
                <span className="tab-count" data-tone="warn">
                  {s.warnings || "!"}
                </span>
              )}
            </Link>
          );
        })}

        {quiet.length > 0 && (
          <button className="tab" onClick={() => setShowQuiet((v) => !v)}>
            {showQuiet ? "Hide quiet states" : `+${quiet.length} with no activity`}
          </button>
        )}
      </nav>
    </div>
  );
}
