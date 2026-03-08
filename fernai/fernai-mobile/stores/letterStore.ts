/**
 * In-memory store for the current dispute letter and clean-bill explanation.
 * Used so we don't pass long text via URL params (which can hit length limits).
 */

let letter: string | null = null;
let cleanBillExplanation: string | null = null;

export function setLetter(value: string | null): void {
  letter = value;
}

export function getLetter(): string | null {
  return letter;
}

export function setCleanBillExplanation(value: string | null): void {
  cleanBillExplanation = value;
}

export function getCleanBillExplanation(): string | null {
  return cleanBillExplanation;
}

export function clearLetter(): void {
  letter = null;
  cleanBillExplanation = null;
  appealUsed = false;
}

/** When user taps "Appeal" on the letter/explanation screen, analysis will re-run on focus. */
let appealRequested = false;

export function setAppealRequested(value: boolean): void {
  appealRequested = value;
}

export function getAndClearAppealRequested(): boolean {
  const v = appealRequested;
  appealRequested = false;
  return v;
}

/** True after the user has appealed once for this result; hide Appeal button and show post-appeal explanation. */
let appealUsed = false;

export function setAppealUsed(value: boolean): void {
  appealUsed = value;
}

export function getAppealUsed(): boolean {
  return appealUsed;
}

export function clearAppealUsed(): void {
  appealUsed = false;
}
