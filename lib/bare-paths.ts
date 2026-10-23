// Single source of truth for pages that run full-screen, without site chrome.

/** Admin and the shop TV (/vitrina) render without the site chrome. */
export function isBarePath(pathname: string): boolean {
  return /^\/[^/]+\/(admin|vitrina)(\/|$)/.test(pathname);
}

/** The shop TV slideshow, where nobody can click a banner. */
export function isShopTvPath(pathname: string): boolean {
  return /^\/[^/]+\/vitrina(\/|$)/.test(pathname);
}
