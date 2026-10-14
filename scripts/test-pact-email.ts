/**
 * PACT email learning: which sent emails are PACT reports, which state each was
 * for, and the templates taken from them.
 *
 *   npx tsx --test scripts/test-pact-email.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { detectState, isPactEmail, learnRecipients, ownText, render, reportedPeriod, templatize, type SentEmail } from "../src/lib/pact-email/learn";

const mail = (over: Partial<SentEmail>): SentEmail => ({
  messageId: "<m1@mail>",
  date: "2026-09-06T15:00:00Z",
  to: [],
  cc: [],
  subject: "",
  text: "",
  attachments: [],
  ...over,
});

test("a PACT report with a file is recognised; a CV is not", () => {
  assert.equal(isPactEmail(mail({ subject: "PACT Act Report - August 2026", attachments: ["PACT_TX_2026-08.xlsx"] })), true);
  assert.equal(isPactEmail(mail({ subject: "Jenkins Act monthly report", attachments: ["report.pdf"] })), true);
  assert.equal(isPactEmail(mail({ subject: "Ajwa Malik - Updated CV", attachments: ["cv.pdf"] })), false);
  assert.equal(isPactEmail(mail({ subject: "PACT report", attachments: [] })), false, "no attachment, no report");
});

test("state from the agency's mail domain, including sub-domains and <xx>.gov", () => {
  assert.deepEqual(detectState(mail({ to: ["PACTAct@cpa.texas.gov"] })), { state: "TX", by: "recipient domain" });
  assert.deepEqual(detectState(mail({ to: ["tobacco@dor.wa.gov"] })), { state: "WA", by: "recipient domain" });
  assert.deepEqual(detectState(mail({ to: ["pact@tax.ny.gov"] })), { state: "NY", by: "recipient domain" });
  assert.deepEqual(detectState(mail({ to: ["excise@ct.gov"] })), { state: "CT", by: "recipient domain" });
  assert.deepEqual(detectState(mail({ to: ["x@state.mn.us"] })), { state: "MN", by: "recipient domain" });
});

test("state from the words when the address is not a government domain", () => {
  assert.equal(detectState(mail({ to: ["someone@gmail.com"], subject: "West Virginia PACT report September 2026" }))?.state, "WV");
  assert.equal(detectState(mail({ to: ["x@gmail.com"], subject: "Monthly report", attachments: ["PACT_NC_2026-09.xlsx"] }))?.state, "NC");
  assert.equal(detectState(mail({ to: ["x@gmail.com"], subject: "Monthly report", attachments: ["report.xlsx"] })), null);
});

test("the reported month: named, numeric, or the month before sending", () => {
  assert.equal(reportedPeriod(mail({ subject: "PACT Report - August 2026" })), "2026-08");
  assert.equal(reportedPeriod(mail({ attachments: ["PACT_TX_2026-08.xlsx"] })), "2026-08");
  // Sent late (October) for August: the file name decides, not the send date.
  assert.equal(reportedPeriod(mail({ date: "2026-10-02T00:00:00Z", attachments: ["PACT_TX_2026-08.xlsx"] })), "2026-08");
  assert.equal(reportedPeriod(mail({ subject: "PACT 08/2026" })), "2026-08");
  assert.equal(reportedPeriod(mail({ subject: "PACT report", date: "2026-09-06T00:00:00Z" })), "2026-08");
  assert.equal(reportedPeriod(mail({ subject: "PACT December report", date: "2027-01-05T00:00:00Z" })), "2026-12");
});

test("templates take the month out and put the next one in", () => {
  const subj = templatize("Maximum Vapor - PACT Act Report - August 2026", "2026-08", { loose: true });
  assert.equal(subj, "Maximum Vapor - PACT Act Report - {{month}} {{year}}");
  assert.equal(render(subj, "2026-10"), "Maximum Vapor - PACT Act Report - October 2026");

  const file = templatize("PACT_TX_2026-08", "2026-08", { loose: true });
  assert.equal(render(file, "2026-10"), "PACT_TX_2026-10");

  assert.equal(render(templatize("PACT 08/2026 AUG", "2026-08", { loose: true }), "2026-11"), "PACT 11/2026 NOV");
});

test("in a message body, 'may' stays a word; 'May 2026' becomes the month", () => {
  const body = "Hello,\nPlease find our May 2026 PACT report attached. You may contact us with questions.";
  const t = templatize(body, "2026-05");
  assert.equal(render(t, "2026-10"), "Hello,\nPlease find our October 2026 PACT report attached. You may contact us with questions.");
});

test("quoted history is dropped from the learned message", () => {
  const text = "Please see attached.\n\nThanks,\nAjwa\n\nOn Mon, Sep 1, 2026 at 9:00 AM Clerk <c@tx.gov> wrote:\n> Send it again";
  assert.equal(ownText(text), "Please see attached.\n\nThanks,\nAjwa");
});

test("learnRecipients groups by state, takes the latest email, and drops our own address", () => {
  const own = "reports@maxvapor.com";
  const emails = [
    mail({ messageId: "a", date: "2026-08-05T00:00:00Z", to: ["PACTAct@cpa.texas.gov"], cc: [own], subject: "PACT Report - July 2026", attachments: ["PACT_TX_2026-07.xlsx"], text: "Attached is our July 2026 report." }),
    mail({ messageId: "b", date: "2026-09-05T00:00:00Z", to: ["PACTAct@cpa.texas.gov"], cc: [own, "boss@maxvapor.com"], subject: "PACT Report - August 2026", attachments: ["PACT_TX_2026-08.xlsx"], text: "Attached is our August 2026 report." }),
    mail({ messageId: "c", date: "2026-09-05T00:00:00Z", to: ["tobacco@dor.wa.gov"], subject: "PACT Act report August 2026", attachments: ["WA August.pdf"], text: "See attached." }),
    mail({ messageId: "d", date: "2026-09-05T00:00:00Z", to: ["friend@gmail.com"], subject: "Lunch", attachments: ["menu.pdf"] }),
  ];
  const { learned } = learnRecipients(emails, own);
  assert.deepEqual(learned.map((l) => l.state), ["TX", "WA"]);
  const tx = learned[0];
  assert.deepEqual(tx.to, ["PACTAct@cpa.texas.gov"]);
  assert.deepEqual(tx.cc, ["boss@maxvapor.com"]);
  assert.equal(render(tx.subjectTemplate, "2026-10"), "PACT Report - October 2026");
  assert.equal(render(tx.bodyTemplate, "2026-10"), "Attached is our October 2026 report.");
  assert.equal(render(tx.attachmentTemplate!, "2026-10"), "PACT_TX_2026-10");
  assert.equal(tx.learnedFrom[0].messageId, "b");
  assert.deepEqual(learned[1].pastAttachmentTypes, ["pdf"]);
});
