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

// Polyfill ResizeObserver for jsdom (needed by ImageStack's viewport-width
// measurement). jsdom has no layout engine, so clientWidth is always 0
// regardless — this just supplies the constructor/observe/disconnect API
// so components that call `new ResizeObserver(...)` don't throw.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}
