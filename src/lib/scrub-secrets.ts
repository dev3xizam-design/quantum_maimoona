/**
 * A portal directory is exactly the place someone is tempted to paste a
 * password, so every free-text field written to it goes through here first.
 *
 * It drops the WHOLE clause a secret keyword appears in, not just the
 * keyword. Stripping only the label leaves the value behind - "Password:
 * hunter2" would become "hunter2", the exact opposite of the intent. A
 * legitimate note like "updated password 02/06/24" is lost too; losing a
 * note is the cheaper mistake.
 */
const SECRET =
  /\b(pass(word|wd)?|pwd|pin|passcode|cvv|security\s*(code|answer|question)|activation\s*code|authorization\s*code|access\s*code|favou?rite|maiden\s*name)\b/i;

/**
 * A clause carrying a question mark is a recovery question and its answer -
 * "What was the name of your first dog? (Chino)" names no keyword at all,
 * but hands over an account just as completely.
 */
const RECOVERY_QUESTION = /\?/;

/** Clause boundaries: ; · — – " - " ". " and newlines. */
const CLAUSE = /\s*(?:[;·—–]|\s-\s|\.\s|\n)\s*/;

export function scrubSecrets(value: string | null): string | null {
  if (!value) return value;
  const kept = value
    .split(CLAUSE)
    .filter((clause) => !SECRET.test(clause) && !RECOVERY_QUESTION.test(clause));
  return kept.join(" · ").replace(/\s{2,}/g, " ").trim() || null;
}
