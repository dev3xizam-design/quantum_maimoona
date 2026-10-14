"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that shows it is working: reading a mailbox or sending
 * reports can take a minute, and a button that looks idle invites more clicks.
 */
export function PendingButton({
  children,
  pendingText,
  className = "btn",
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={disabled || pending} name={name} value={value} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
