import "@testing-library/jest-dom/vitest";

// Polyfill IntersectionObserver for jsdom (needed by Framer Motion's whileInView)
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds = [];
}
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}
