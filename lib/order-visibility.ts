// A web order only becomes operationally real once the customer has paid.
// Failed and abandoned web checkouts persist as source='web' with a non-paid
// payment_status (each attempt creates its own row), so they pile up as noise
// in the active work views. Intake orders (phone/walk-in/whatsapp/event) are
// created by staff and may be legitimately unpaid (pay-on-delivery), so they
// always stay visible. A refunded web order WAS paid once, so it remains real.
//
// This is intentionally NOT applied to the ledger ("Libro de órdenes"), which
// keeps the full record — including failed web attempts — for reconciliation.
//
// Returns a SQL boolean predicate. Pass the table alias used in the query
// (e.g. "o") or leave empty for an unaliased `orders` query.
export function activeOrderVisibilitySql(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `NOT (${p}source = 'web' AND ${p}payment_status NOT IN ('paid', 'refunded'))`;
}
