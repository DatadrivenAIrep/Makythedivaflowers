// What the admin UI and API see of an order's digital card.
export type DigitalCardView = {
  code: string;
  shortUrl: string;
  targetUrl: string | null;
};
