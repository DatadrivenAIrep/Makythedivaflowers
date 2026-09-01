// data/elfsight.ts

/**
 * Elfsight widget ids, straight from the Elfsight dashboard. Each id is the
 * suffix of the `elfsight-app-…` class in the embed snippet Elfsight hands
 * out; everything about how a widget looks is configured on their side.
 */
export const ELFSIGHT_APPS = {
  /** "Untitled Google Reviews" — the reviews section on the home page. */
  siteReviews: "2a7b85e5-9e2e-4a7b-9f90-d575222e97ae",
  /** "reviews pagina productos" — the reviews section on every product page. */
  productReviews: "bb3a0cb4-2255-48a6-9f51-128095757b1d",
} as const;
