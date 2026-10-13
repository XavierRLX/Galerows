import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'

// jsdom provides getRandomValues but not SubtleCrypto. G4-lite hashes the public
// short room code in production Android's secure WebView; future Vitest runs need
// an equivalent deterministic digest, without changing the application build.
if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    configurable: true,
    value: webcrypto.subtle,
  })
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})
