/**
 * In-memory store for the current dispute letter.
 * Used so we don't pass long letter text via URL params (which can hit length limits).
 */

let letter: string | null = null;

export function setLetter(value: string | null): void {
  letter = value;
}

export function getLetter(): string | null {
  return letter;
}

export function clearLetter(): void {
  letter = null;
}
