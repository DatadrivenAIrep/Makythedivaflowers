import type { CartLine } from "@/types/order";

/**
 * The digital card as something a customer buys: a gift extra (`data/products.ts`)
 * offered on every celebration bouquet through `lib/product-add-ons.ts`. What the
 * team does with it after the order lives in the admin's Digital card block
 * (`lib/digital-cards.ts`): a QR printed in the card that opens the animated card.
 */
export const DIGITAL_CARD_ID = "x-card-digital";

/** Every live demo, on the card platform's own index page. */
export const DEMOS_URL = "https://tarjetas.makythedivaflowers.com";

/** True when the lines carry a digital card, as their own line or as a bouquet's add-on. */
export function hasDigitalCard(lines: CartLine[]): boolean {
  return lines.some(
    (l) => l.kind === "catalog" && (l.productId === DIGITAL_CARD_ID || l.addOnIds.includes(DIGITAL_CARD_ID)),
  );
}
