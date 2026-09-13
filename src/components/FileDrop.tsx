"use client";

import { useRef, useState } from "react";

const cloud = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M20 16.6A4 4 0 0 0 18 9h-1.3A7 7 0 1 0 5 15.7" />
  </svg>
);

/**
 * A real drop target with a visible button - the browser's bare
 * "Choose file / No file chosen" gives no affordance and no feedback.
 */
export function FileDrop({
  accept,
  multiple = false,
  disabled = false,
  hint,
  buttonLabel = "Choose file",
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  hint: string;
  buttonLabel?: string;
  onFiles: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);

  const take = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setChosen(Array.from(files).map((f) => f.name));
    onFiles(files);
  };

  return (
    <div>
      <div
        className="dropzone"
        data-dragging={dragging}
        data-busy={disabled}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files);
        }}
      >
        <span className="dropzone-icon">{cloud}</span>
        <div>
          <div className="text-[13px] font-semibold text-[var(--ink)]">
            {dragging ? "Drop it here" : "Drag a file here, or click to browse"}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">{hint}</div>
        </div>
        <span className="btn btn-primary btn-sm pointer-events-none">{buttonLabel}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => take(e.target.files)}
        />
      </div>

      {chosen.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chosen.map((name) => (
            <span key={name} className="filechip">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span className="truncate">{name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
