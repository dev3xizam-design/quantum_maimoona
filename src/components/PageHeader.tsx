import Link from "next/link";

export type TabItem = {
  href: string;
  label: string;
  count?: number;
  tone?: "warn";
};

/**
 * Every page opens the same way: title, one line of context, actions on the
 * right, and the section's tabs underneath. It stays pinned while the content
 * scrolls so you never lose track of where you are.
 */
export function PageHeader({
  title,
  description,
  actions,
  tabs,
  activeHref,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: TabItem[];
  activeHref?: string;
}) {
  return (
    <div className="pagehead">
      <div className="pagehead-row">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-sub mt-0.5">{description}</p>}
        </div>
        {actions && <div className="pagehead-actions">{actions}</div>}
      </div>

      {tabs && tabs.length > 0 && (
        <nav className="tabs">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className="tab" data-active={t.href === activeHref}>
              {t.label}
              {t.count !== undefined && (
                <span className="tab-count" data-tone={t.tone}>
                  {t.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}
      {!tabs && <div className="h-4" />}
    </div>
  );
}
