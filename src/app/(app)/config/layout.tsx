import { ConfigTabs } from "./ConfigTabs";

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ConfigTabs />
      <div className="callout callout-warn mb-4">
        <strong>Identifiers only.</strong> Never record a portal password, PIN, card number or bank
        login here — not in a notes field either. Account and license numbers are fine; the returns
        need them.
      </div>
      {children}
    </div>
  );
}
