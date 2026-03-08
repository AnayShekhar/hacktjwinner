/**
 * Simple in-memory auth state for login gate.
 * Replace with real auth (e.g. token, API) when needed.
 */

let isLoggedIn = false;

export function getIsLoggedIn(): boolean {
  return isLoggedIn;
}

export function setLoggedIn(value: boolean): void {
  isLoggedIn = value;
}

export function logout(): void {
  isLoggedIn = false;
}
