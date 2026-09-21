import Link from "next/link";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guide" };

const SECTIONS = [
  { id: "overview", label: "What this is" },
  { id: "monthly", label: "The monthly run" },
  { id: "files", label: "Files it reads" },
  { id: "workbook", label: "The workbook" },
  { id: "rules", label: "Rules it enforces" },
  { id: "rates", label: "Changing a rate" },
  { id: "excise", label: "Excise & PACT" },
  { id: "trouble", label: "If something looks wrong" },
  { id: "security", label: "Security" },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-[15px] font-semibold tracking-tight">
      {children}
    </h2>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="panel space-y-3 p-5">{children}</section>;
}

export default function GuidePage() {
  return (
    <div className="space-y-5">
      <div className="pagehead">
        <div className="pagehead-row">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div>
              <h1 className="page-title">How Quantum works</h1>
              <p className="page-sub mt-0.5">
                Read this once. Everything the system does is a formula or a lookup — there is no
                estimation anywhere, and anything it cannot know it refuses to invent and tells you
                about instead.
              </p>
            </div>
          </div>
        </div>
        <nav className="tabs">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="tab">
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <Card>
        <H id="overview">What this is</H>
        <p className="text-[13px] text-[var(--ink-2)]">
          You upload the period&rsquo;s Avalara export. Quantum applies each state&rsquo;s own
          rules — rate, filing frequency, jurisdiction breakdown, rounding, form quirks — and
          produces filled, ready-to-file worksheets for <strong>sales / use tax</strong>,{" "}
          <strong>vapor excise</strong> and <strong>PACT Act</strong> reports across all 50 states
          and DC.
        </p>
        <div className="help">
          <strong>It prepares; a person files.</strong> Most states have no filing API, portal
          automation breaks constantly, and some portals&rsquo; terms forbid it. The worksheet plus
          the filing sheet is where essentially all the time saving is — the last step is you
          typing six numbers into a portal from a sheet that already has them in the right order.
        </div>
        <p className="text-[13px] text-[var(--ink-2)]">
          It is an accounting tool, not tax advice. A CPA should sign off on the rule set and
          spot-check filings each quarter.
        </p>
      </Card>

      <Card>
        <H id="monthly">The monthly run — do it in this order</H>
        <ol className="steps mt-2">
          <li>
            <strong><Link className="text-[var(--accent)]" href="/upload">Upload</Link> the month&rsquo;s Avalara export.</strong>{" "}
            .xlsx, .csv or a ZIP of several. It is parsed in your browser, so size is not a limit
            and the file never leaves your machine. Check the validation table that appears: every
            state must show <em>Taxable + Exempt = Gross → OK</em>.
          </li>
          <li>
            <strong>Add what the export cannot contain.</strong> For excise you need wholesale cost
            (upload the purchase file, or type it per SKU) and mL for pods. Go to{" "}
            <Link className="text-[var(--accent)]" href="/products">Products</Link> — it is ordered
            by revenue, so work top-down and stop when the rest is noise. For PACT you need the
            shipment feed from the order system, because the sales export has no customer names.
          </li>
          <li>
            <strong><Link className="text-[var(--accent)]" href="/period">Close the month</Link>.</strong>{" "}
            One button computes every registered state — sales, excise and PACT — stores the
            results, and hands you the workbook.
          </li>
          <li>
            <strong>Work the Action Items tab.</strong> Anything that would make a return wrong is
            listed there, per state, with the SKUs or jurisdictions named.
          </li>
          <li>
            <strong>File each return</strong> from its own tab, then come back and press{" "}
            <em>Mark filed</em> on the return with the confirmation number. That is what keeps the{" "}
            <Link className="text-[var(--accent)]" href="/calendar">Calendar</Link> honest.
          </li>
        </ol>
      </Card>

      <Card>
        <H id="files">The four files it reads</H>
        <div className="overflow-x-auto">
          <table className="qtable">
            <thead>
              <tr>
                <th>File</th>
                <th>Needed for</th>
                <th>Where it comes from</th>
                <th>What happens without it</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold">Avalara export</td>
                <td>Sales tax, and the product catalog</td>
                <td>Avalara &rarr; SalesTaxDocumentLineDetail</td>
                <td>Nothing computes at all</td>
              </tr>
              <tr>
                <td className="font-semibold">Product master</td>
                <td>Excise: wholesale cost, mL, open/closed</td>
                <td>Optional — mostly builds itself from the export</td>
                <td>% -of-wholesale and per-mL states under-report</td>
              </tr>
              <tr>
                <td className="font-semibold">Purchase import</td>
                <td>Receipts-basis excise (Kansas EC-2)</td>
                <td>Your purchasing records</td>
                <td>Kansas EC-2 cannot be computed at all</td>
              </tr>
              <tr>
                <td className="font-semibold">Shipment feed</td>
                <td>PACT Act customer detail</td>
                <td>Order / shipping system</td>
                <td>PACT lists ship-to state and ZIP but no names</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="help">
          <strong>Re-uploading a period is safe.</strong> Rows are keyed on document, line,
          jurisdiction and item, so a duplicate upload is ignored rather than doubling the month.
        </div>
      </Card>

      <Card>
        <H id="workbook">The workbook — what each tab is for</H>
        <div className="overflow-x-auto">
          <table className="qtable">
            <thead>
              <tr>
                <th>Tab</th>
                <th>What it holds</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="font-semibold">Instructions</td><td>How to use the workbook, and what each colour means</td></tr>
              <tr><td className="font-semibold">Summary</td><td>Every state on one row: gross, taxable, tax due, collected, delta, excise, PACT, due date</td></tr>
              <tr><td className="font-semibold">Action Items</td><td>Every warning across every state, in one list</td></tr>
              <tr><td className="font-semibold">One tab per state</td><td>That state&rsquo;s form lines in the order its portal asks for them, its jurisdiction breakdown with official filing codes, its excise, its PACT count, and numbered filing steps</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-[var(--ink-2)]">
          A <strong>yellow</strong> cell is a number you type into the portal. A{" "}
          <strong>red</strong> cell is something that must be resolved before filing. There is also
          a per-state download that gives each state its own separate workbook with the full five-tab
          set — Filing Sheet, Return, Jurisdiction Detail, Reconciliation and Notes.
        </p>
      </Card>

      <Card>
        <H id="rules">The rules the engine enforces</H>
        <ul className="space-y-2.5 text-[13px] text-[var(--ink-2)]">
          <li>
            <strong>The export is pre-exploded by jurisdiction.</strong> Each sale line repeats once
            per State / County / City / Special row. Sale figures are taken from the State row only
            and deduped; tax is summed across <em>every</em> row. Get this wrong and revenue
            multiplies by three or four.
          </li>
          <li>
            <strong>Taxable + Exempt must equal Gross,</strong> to the cent, for every state. When
            it does not, the worksheet is refused rather than emitted.
          </li>
          <li>
            <strong>Returns always reduce the period,</strong> whether or not the export already
            signed them negative.
          </li>
          <li>
            <strong>Collected vs computed.</strong> What Avalara charged is compared against what
            the state&rsquo;s official rate assesses. A positive delta means you under-collected and
            the difference comes out of margin.
          </li>
          <li>
            <strong>Frequency is per state per tax type.</strong> Kansas sales tax is annual while
            its EC-2 excise is monthly. Indiana sales is annual while PACT stays monthly.
          </li>
          <li>
            <strong>Nothing is invented.</strong> Puff counts are never converted to mL; wholesale
            cost is never back-solved from retail. Missing data is reported, never estimated.
          </li>
        </ul>
      </Card>

      <Card>
        <H id="rates">When a state changes a rate</H>
        <p className="text-[13px] text-[var(--ink-2)]">
          Go to <Link className="text-[var(--accent)]" href="/config">Config</Link>, find the row,
          press Edit, set the new rate and — this is the important part — set the{" "}
          <strong>effective date</strong> to the first day it applies. Save.
        </p>
        <div className="help">
          That closes the old row and opens a new one. Every future return uses the new rate;
          everything already filed keeps the rate that applied then, and an amended prior period
          still gets the old one. No code change, no redeploy.
        </div>
        <p className="text-[13px] text-[var(--ink-2)]">
          The same applies to jurisdiction codes, excise structures and filing frequencies. Every
          edit is recorded in <Link className="text-[var(--accent)]" href="/audit">Audit</Link> with
          who changed what, from what to what, and effective when.
        </p>
      </Card>

      <Card>
        <H id="excise">Excise and PACT — the two that trip people up</H>
        <p className="text-[13px] text-[var(--ink-2)]">
          <strong>Excise is a different tax on a different base with a different return.</strong>{" "}
          Five structures: % of wholesale, % of retail, per mL, per cartridge, or bifurcated
          open/closed. And two <em>bases</em> — most states tax what you sold, but some tax what you{" "}
          <strong>purchased into inventory</strong>. Kansas EC-2 line 1a is mL purchased, not sold,
          so it reads the purchase import and ignores sales data entirely.
        </p>
        <p className="text-[13px] text-[var(--ink-2)]">
          <strong>PACT is not a tax at all</strong> — it is a per-shipment disclosure, due on the
          10th rather than the 20th, and it attaches from your very first interstate shipment with
          no threshold. It applies even in the states with no sales tax. The cigarette sections of
          those forms stay blank.
        </p>
      </Card>

      <Card>
        <H id="trouble">If something looks wrong</H>
        <div className="overflow-x-auto">
          <table className="qtable">
            <thead>
              <tr><th>Symptom</th><th>Almost always means</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Revenue looks 3&ndash;4&times; too high</td>
                <td>Something bypassed the dedupe. Check the upload validation table, and that the export really is the line-detail report.</td>
              </tr>
              <tr>
                <td>&ldquo;Reconciliation failed&rdquo;</td>
                <td>The period is partly covered, or two overlapping exports were loaded. Look at the date range shown after the upload.</td>
              </tr>
              <tr>
                <td>Excise tax is zero or far too low</td>
                <td>Wholesale cost or mL is missing for the SKUs that period. The return page names them, ranked by revenue.</td>
              </tr>
              <tr>
                <td>A big positive delta</td>
                <td>Avalara collected less than the state&rsquo;s official rate. Real, and it is a margin hit — fix the Avalara rate config.</td>
              </tr>
              <tr>
                <td>A state shows &ldquo;no activity&rdquo;</td>
                <td>No transactions for it that period. Nothing to file.</td>
              </tr>
              <tr>
                <td>A jurisdiction shows &ldquo;MISSING&rdquo; code</td>
                <td>That county or city has no official filing code loaded yet. Add it in Config &rarr; Jurisdiction codes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <H id="security">Security</H>
        <ul className="space-y-2 text-[13px] text-[var(--ink-2)]">
          <li>
            <strong>Never put a portal password, PIN, card number, CVV or bank login in this
            system</strong> — not in a notes field either. Those belong in a password manager. Only
            non-secret identifiers (FEIN, account and license numbers) live here, because the
            returns need them.
          </li>
          <li>
            PACT shipment rows contain customer names and addresses. They are written to the
            workbook only — never rendered in the dashboard and never logged.
          </li>
          <li>Sessions are signed, http-only cookies that expire after 12 hours.</li>
        </ul>
      </Card>
    </div>
  );
}
