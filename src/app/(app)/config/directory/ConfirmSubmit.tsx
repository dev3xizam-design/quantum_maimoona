"use client";

import { useFormStatus } from "react-dom";

/** A submit button that asks first, and says it is working - the bulk add takes a while. */
export function ConfirmSubmit({
  label,
  pendingLabel,
  message,
  className = "btn",
}: {
  label: string;
  pendingLabel: string;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
