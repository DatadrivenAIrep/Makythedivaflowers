# Tarjeta de fidelización en la tienda web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el checkout web de Diva muestre y aplique los premios de la tarjeta, y que cada pedido web pagado sume su sello en el programa de fidelización.

**Architecture:** Un cliente `server-only` habla con la API del programa. El checkout consulta premios y los protege con un código SMS que produce una constancia firmada; el servidor recalcula el descuento al crear el pago. Después del pago, una tabla de pendientes garantiza que entrega y sello lleguen al programa, con reintentos por cron.

**Tech Stack:** Next.js 16, TypeScript, `node:sqlite`, Stripe, Twilio, next-intl, vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-tarjeta-fidelizacion-design.md`. API: `/Volumes/Datadriven/02_PROYECTOS/programa-fidelizacion/public/api.md`.

## Global Constraints

- Sin dependencias nuevas.
- Variables: `LOYALTY_API_URL` (base hasta `/api/v1`, sin barra final) y `LOYALTY_API_KEY`. La conexión está activa solo con las dos definidas.
- Sin las dos variables, el comportamiento actual no cambia en nada, incluido el `$15` de la quinta compra.
- Tiempo máximo por llamada: 2500 ms durante el checkout, 10000 ms después del pago.
- Celular hacia la API y en constancias, siempre con `e164()` de `lib/twilio-server.ts`.
- Número de orden hacia la API: `diva-<orderNumber>`, o `diva-<id>` si no tiene número.
- Nada de lo posterior al pago puede lanzar errores hacia el webhook de Stripe.
- El checkout nunca devuelve nombre, sellos ni visitas.
- Comentarios del código en inglés, como el resto del proyecto. Textos al usuario en `messages/es.json` y `messages/en.json`, bajo `checkout`.
- Pruebas: `npm test -- <archivo>`. Rutas con mocks al estilo de `tests/unit/checkout-intent-promo.test.ts`; base en memoria al estilo de `tests/unit/promo-grants.test.ts`.
- Trabajar en la rama `feat/tarjeta-fidelizacion`. Nunca hacer push.
- Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Stripe repite el webhook cuando la orden ya tiene `customerId` y el sello sigue pendiente: no se duplica la fila y el pendiente sigue vivo (Tarea 5).
- La persona verifica con un número y cambia el celular antes de pagar: el servidor rechaza la constancia aunque el navegador la envíe (Tarea 4).
- El mismo checkout se vuelve a calcular (propina, dirección) y el premio ya no está: la orden reescrita no conserva el premio ni el descuento (Tarea 4).
- El mismo número escrito como `(516) 555-0100` y `+15165550100`: la constancia lo reconoce como el mismo (Tarea 3).
- El proveedor responde HTML o un 502 en lugar de JSON: se trata como programa no disponible, sin romper (Tarea 1).

---

### Task 1: Cliente de la API y lectura del porcentaje

**Files:**
- Create: `lib/loyalty-client.ts`, `lib/loyalty-rewards.ts`
- Test: `tests/unit/loyalty-client.test.ts`, `tests/unit/loyalty-rewards.test.ts`

**Interfaces:**
- Produces (`lib/loyalty-rewards.ts`, sin `server-only`):
  - `type LoyaltyReward = { id: string; percent: number; label: string }`
  - `rewardPercent(text: string): number | null`
  - `applicableRewards(available: { id: string; reward: string }[]): LoyaltyReward[]`, ordenados de mayor a menor porcentaje
  - `rewardDiscountCents(subtotalCents: number, percent: number): number`
- Produces (`lib/loyalty-client.ts`, `server-only`):
  - `loyaltyEnabled(): boolean`
  - `class LoyaltyApiError extends Error { code: string; status: number }`; `code` es el de la API, o `"unavailable"` para tiempo agotado, red o respuesta que no sea JSON
  - `type LoyaltyCustomer = { id: number; cardUrl: string; rewards: { available: { id: string; reward: string; final: boolean }[] } }`
  - `lookupCustomer(phone: string, opts: { timeoutMs: number }): Promise<LoyaltyCustomer | null>`; `null` con `customer_not_found`
  - `createCustomer(input: { name: string; phone: string }, opts): Promise<{ customer: LoyaltyCustomer; existing: boolean }>`, siempre con `consent: true`
  - `redeemReward(customerId: number, rewardId: string, orderId: string, opts): Promise<void>`
  - `addStamp(customerId: number, orderId: string, opts): Promise<void>`
  - `reverseOrder(orderId: string, opts): Promise<{ rewardsAlreadyUsed: { reward: string }[] }>`

- [ ] **Step 1: Write the failing tests**

```ts
// loyalty-rewards.test.ts
expect(rewardPercent("15% de descuento")).toBe(15);
expect(rewardPercent("15 % off")).toBe(15);
expect(rewardPercent("Un ramo gratis")).toBeNull();
expect(rewardPercent("10% + 5% extra")).toBeNull();
expect(rewardPercent("100%")).toBeNull();
expect(rewardPercent("0%")).toBeNull();
expect(applicableRewards([{id:"a",reward:"15%"},{id:"b",reward:"Café"},{id:"final",reward:"50%"}]).map(r=>r.id)).toEqual(["final","a"]);
expect(rewardDiscountCents(10001, 15)).toBe(1500);
// loyalty-client.test.ts, con fetch simulado
it("sends Bearer key and phone in the body, never in the URL");
it("lookupCustomer returns null on 404 customer_not_found");
it("maps a non-JSON 502 to LoyaltyApiError code unavailable");
it("maps an abort at timeoutMs to code unavailable");
it("loyaltyEnabled is false when either variable is missing");
it("reverseOrder percent-encodes the order id");
```

- [ ] **Step 2: Run them to verify they fail.** Run: `npm test -- tests/unit/loyalty-client.test.ts tests/unit/loyalty-rewards.test.ts`. Expected: FAIL, módulos inexistentes.
- [ ] **Step 3: Implement both modules.** La API envuelve el cliente en `{ customer }`; las formas exactas están en `public/api.md` del programa. Usar `AbortSignal.timeout`. `rewardPercent` exige exactamente una coincidencia de `/(\d{1,3})\s*%/g` y un valor de 1 a 99.
- [ ] **Step 4: Run them to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit** con `git add lib/loyalty-client.ts lib/loyalty-rewards.ts tests/unit/loyalty-client.test.ts tests/unit/loyalty-rewards.test.ts` y mensaje `feat(loyalty): cliente de la API y lectura de porcentajes`.

### Task 2: Datos: columnas, tablas y el premio en recibos

**Files:**
- Create: `db/migrations/041_loyalty_card.sql`
- Modify: `types/order.ts`, `lib/order-row.ts`, `lib/invoice.ts:115`, `lib/print-render-html.tsx:222`, `components/admin/dashboard/OrderDetailDrawer.tsx:393`, y cada lugar que `grep -rn promo_code lib` muestre escribiendo órdenes
- Test: `tests/unit/loyalty-order-row.test.ts`

**Interfaces:**
- Produces, en `Order`: `loyaltyRewardId?: string`, `loyaltyRewardLabel?: string`, `loyaltyRewardPercent?: number`, `loyaltyJoin?: boolean`.
- Produces, columnas en `orders`: `loyalty_reward_id TEXT`, `loyalty_reward_label TEXT`, `loyalty_reward_percent INTEGER`, `loyalty_join INTEGER NOT NULL DEFAULT 0`.
- Produces, tablas:
  - `loyalty_sms_codes(phone TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)`
  - `loyalty_sync(order_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('sync','reverse')), loyalty_order_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','done','noop','failed','canceled')), attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(order_id, kind))`, con índice en `status`.

- [ ] **Step 1: Write the failing test**

```ts
it("round-trips the reward fields through orderToRow/rowToOrder");
it("leaves all four fields absent on an order without a reward");
it("invoice shows the reward label on the discount line when there is no promo code");
it("migration creates loyalty_sync and rejects an unknown status");
```

- [ ] **Step 2: Run it to verify it fails.** Run: `npm test -- tests/unit/loyalty-order-row.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** La etiqueta de la línea de descuento pasa a ser `order.promoCode ?? order.loyaltyRewardLabel` en los tres lugares de presentación.
- [ ] **Step 4: Run it and the existing order tests.** Run: `npm test -- tests/unit/loyalty-order-row.test.ts tests/unit/api-checkout-intent.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** los archivos listados, mensaje `feat(loyalty): datos de premio en la orden y tabla de pendientes`.

### Task 3: Ver premios y verificar por SMS

**Files:**
- Create: `lib/loyalty-proof.ts`, `app/api/checkout/loyalty/lookup/route.ts`, `app/api/checkout/loyalty/send-code/route.ts`, `app/api/checkout/loyalty/verify/route.ts`
- Test: `tests/unit/loyalty-proof.test.ts`, `tests/unit/api-checkout-loyalty.test.ts`

**Interfaces:**
- Consumes: Task 1 y `loyalty_sms_codes` de Task 2.
- Produces (`lib/loyalty-proof.ts`, `server-only`):
  - `createCode(phone: string): string`; guarda el hash y reemplaza cualquier código anterior
  - `checkCode(phone: string, code: string): "ok" | "wrong" | "expired"`; `"ok"` borra el código; el quinto intento fallido también
  - `signProof(phone: string, rewards: LoyaltyReward[], now?: Date): string`
  - `readProof(token: string, phone: string, now?: Date): { rewards: LoyaltyReward[] } | null`
- Produces, rutas `POST` (`runtime = "nodejs"`):
  - `lookup` `{ phone }` → `{ status: "unavailable" } | { status: "no_card" } | { status: "card", rewards: LoyaltyReward[] }`. Límite: 20 por minuto por IP.
  - `send-code` `{ phone, locale }` → `{ sent: true }`, o 429 `{ reason: "rate_limited" }`. Límites: 3 por hora por celular y 10 por minuto por IP.
  - `verify` `{ phone, code }` → `{ proof, rewards }`, o 400 `{ reason: "wrong" | "expired" }`, o 503 `{ reason: "unavailable" }`.

Valores: código de 6 dígitos con `crypto.randomInt`, 10 minutos, 5 intentos; constancia de 15 minutos. La constancia es `base64url(JSON).firma`, con HMAC-SHA256 usando una clave derivada de `LOYALTY_API_KEY` y comparación en tiempo constante. `status` es `"unavailable"` si la conexión está apagada, si `twilioSmsEnabled()` es falso o si la API falla. `send-code` solo envía si ese número tiene premios aplicables. Con `twilioDryRun()`, el código va a `console.log` en vez de enviarse, con el mismo formato de `promo_reward_dry_run`.

Texto del SMS: `Tu código de Diva Flowers es {code}. Vence en 10 minutos.` / `Your Diva Flowers code is {code}. It expires in 10 minutes.`, según `locale` del cuerpo. `verify` llama a `lookupCustomer` para armar los premios de la constancia.

- [ ] **Step 1: Write the failing tests**

```ts
it("proof signed for +15165550100 reads back with phone '(516) 555-0100'");
it("proof is rejected for another phone, after 15 minutes, and when tampered");
it("code expires after 10 minutes and dies on the fifth wrong attempt");
it("a used code cannot be used twice");
it("lookup never includes name, stamps or visits");
it("lookup returns unavailable when SMS is off or the API is down");
it("lookup filters rewards with no percent");
it("send-code refuses the fourth send for one phone within the hour");
it("send-code sends nothing for a number with no rewards");
it("verify returns a proof containing only applicable rewards");
```

- [ ] **Step 2: Run them to verify they fail.** Run: `npm test -- tests/unit/loyalty-proof.test.ts tests/unit/api-checkout-loyalty.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the module and the three routes,** reutilizando `rateLimit` e `ipFromRequest`.
- [ ] **Step 4: Run them to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit** los archivos listados, mensaje `feat(loyalty): consulta de premios y verificación por SMS`.

### Task 4: Aplicar el premio al crear el pago

**Files:**
- Create: `lib/loyalty-checkout.ts`
- Modify: `app/api/checkout/intent/route.ts`, `schemas/checkout.ts:69`
- Test: `tests/unit/checkout-intent-loyalty.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `resolveRewardDiscount(input: { phone: string; rewardId: string; proof: string; subtotalCents: number }): Promise<{ ok: true; rewardId: string; label: string; percent: number; discountCents: number } | { ok: false; reason: "proof_invalid" | "reward_unavailable" }>`.
- Produces, en `requestSchema`: `loyaltyRewardId` y `loyaltyProof`, opcionales. En `checkoutSchema`: `joinLoyaltyCard: z.boolean().optional().default(false)`.
- Produces, errores 400: `{ errors: { formErrors: ["loyalty_proof_invalid"] } }`, `["loyalty_reward_unavailable"]`, `["loyalty_with_promo"]`.

Lógica de `resolveRewardDiscount`: leer la constancia y exigir que incluya `rewardId`. Consultar `lookupCustomer` con 2500 ms. Si responde y el premio sigue en `applicableRewards`, usar el porcentaje actual. Si responde y no está, `reward_unavailable`. Si `LoyaltyApiError` con `unavailable`, usar el porcentaje de la constancia.

- [ ] **Step 1: Write the failing test**

```ts
it("computes the discount on the server from the reward, ignoring anything the client sends");
it("rejects promoCode and loyaltyRewardId together with loyalty_with_promo");
it("rejects a proof issued to another phone");
it("returns loyalty_reward_unavailable when the program no longer lists it");
it("honours the proof percent when the program is unavailable");
it("re-pricing the same order without the reward clears reward fields and discount");
it("stores id, label, percent and loyaltyJoin on the order and leaves promoId empty");
it("works alongside a gift card, including full coverage");
it("with the connection off, a request with loyaltyRewardId gets loyalty_reward_unavailable");
```

- [ ] **Step 2: Run it to verify it fails.** Run: `npm test -- tests/unit/checkout-intent-loyalty.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** El bloque va justo después del de `promoCode` (línea 117), usa `discountCents` para `computeOrderTotals` y `order.loyaltyJoin = form.joinLoyaltyCard`.
- [ ] **Step 4: Run it and the existing checkout tests.** Run: `npm test -- tests/unit/checkout-intent-loyalty.test.ts tests/unit/checkout-intent-promo.test.ts tests/unit/api-checkout-intent.test.ts tests/unit/checkout-intent-gift-card.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** los archivos listados, mensaje `feat(loyalty): aplicar el premio al crear el pago`.

### Task 5: Registrar en la tarjeta después del pago

**Files:**
- Create: `lib/loyalty-sync.ts`
- Modify: `lib/on-web-order-paid.ts:31-35`
- Test: `tests/unit/loyalty-sync.test.ts`, `tests/unit/on-web-order-paid.test.ts`

**Interfaces:**
- Consumes: Tasks 1 y 2, `notifyOwner`, `sendSms`, `OPT_OUT_FOOTER`.
- Produces:
  - `enqueueOrderSync(order: Order): void`; `INSERT OR IGNORE`, solo si `loyaltyEnabled()`, `source === "web"` y `paymentStatus === "paid"`
  - `runSync(orderId: string): Promise<void>`, nunca lanza
  - `enqueueOrderReverse(orderId: string): void`, solo si existe una fila `sync` con estado distinto de `noop`
  - `runReverse(orderId: string): Promise<void>`, nunca lanza
  - `runDuePending(now?: Date): Promise<{ done: number; pending: number; failed: number }>`

Pasos de `runSync`, con 10000 ms por llamada:
1. Si existe fila `reverse`, marcar `canceled` y terminar.
2. `lookupCustomer`. Si es `null` y `order.loyaltyJoin` y hay nombre, `createCustomer`. Si es `null` y no, marcar `noop`.
3. Si la orden tiene `loyaltyRewardId`, `redeemReward`. Con `reward_unavailable`: `notifyOwner` y seguir.
4. `addStamp`. Marcar `done`.
5. Cualquier otro error: `attempts + 1`, `last_error`, sigue `pending`.

Tras crear una tarjeta nueva (`existing === false`) y con `order.smsConsent`, enviar una vez el enlace. Su fallo no afecta el sello. Respetar `twilioSmsEnabled()` y `twilioDryRun()` como en `lib/promo-rewards.ts`.

`runDuePending` recorre las filas `pending`. Si tienen más de 72 horas desde `created_at`, las marca `failed` y avisa una vez a Maky; si no, reintenta.

`runReverse`: `reverseOrder`; `order_not_found` cuenta como `done`. Si `rewardsAlreadyUsed` trae datos, `notifyOwner`.

Textos exactos:
- SMS es: `Ya tienes tu tarjeta de Diva Flowers: {url}`. SMS en: `Your Diva Flowers card is ready: {url}`. Más `OPT_OUT_FOOTER[locale]`.
- Maky, premio ya usado: `Orden {num}: el premio "{label}" ya se había usado al pagar. Se respetó el descuento. — Diva Flowers`
- Maky, fallido: `Tarjeta: la orden {num} no se pudo registrar en 72 horas. — Diva Flowers`
- Maky, cancelación: `Orden {num} cancelada: ya se usaron premios ganados con ella ({labels}). — Diva Flowers`

- [ ] **Step 1: Write the failing tests**

```ts
it("redeems before stamping and uses diva-<orderNumber>");
it("falls back to diva-<id> when the order has no number and keeps it across retries");
it("creates the card only with loyaltyJoin, then stamps the same order");
it("does nothing for a buyer with no card and no consent, status noop");
it("on reward_unavailable notifies the owner once and still stamps");
it("a failed stamp stays pending and the retry repeats both calls with the same orderId");
it("sends the card link once, only for a new card with smsConsent");
it("an SMS failure does not leave the sync pending");
it("marks failed and notifies once after 72 hours");
it("sync is canceled when a reverse row exists");
it("reverse treats order_not_found as done");
it("reverse notifies the owner when rewardsAlreadyUsed is not empty");
it("enqueueOrderReverse does nothing after a noop sync");
// on-web-order-paid.test.ts
it("enqueues before the customerId guard, so a repeated webhook keeps one row");
it("a rejected runSync never reaches the caller");
it("does not enqueue when the connection is off");
```

- [ ] **Step 2: Run them to verify they fail.** Run: `npm test -- tests/unit/loyalty-sync.test.ts tests/unit/on-web-order-paid.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** En `onWebOrderPaid`, justo después de `if (!order) return;`, llamar `enqueueOrderSync(order)` y lanzar `void runSync(order.id)` sin esperarlo, antes de la guarda de `customerId`.
- [ ] **Step 4: Run them to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit** los archivos listados, mensaje `feat(loyalty): registrar entrega y sello después del pago`.

### Task 6: Reintentos, cancelación y fin del $15

**Files:**
- Create: `app/api/cron/loyalty-sync/route.ts`, `docs/ops/loyalty-card.md`
- Modify: `app/api/admin/orders/[id]/cancel/route.ts:39-42`, `lib/promo-rewards.ts:110`, `.env.local.example`
- Test: `tests/unit/api-cron-loyalty-sync.test.ts`, `tests/unit/api-admin-orders-cancel.test.ts`, `tests/unit/promo-rewards-loyalty-switch.test.ts`

**Interfaces:**
- Consumes: Task 5 y `loyaltyEnabled()`.

Ruta del cron igual a `app/api/cron/reminders/route.ts` en secreto, 503 y 401, con `dynamic = "force-dynamic"`. Devuelve el resultado de `runDuePending()`. El documento de operaciones lleva: variables, cron cada 10 minutos y los seis pasos de "Puesta en marcha" del diseño.

- [ ] **Step 1: Write the failing tests**

```ts
it("cron returns 503 without CRON_SECRET and 401 with a wrong one");
it("cron returns the counts from runDuePending");
it("cancel enqueues and runs the reversal after cancelOrder");
it("a failing reversal does not fail the cancellation");
it("with the connection on, a fourth paid order grants no GRACIAS code");
it("with the connection off, a fourth paid order still grants the GRACIAS code");
it("referral credit still runs with the connection on");
```

- [ ] **Step 2: Run them to verify they fail.** Run: `npm test -- tests/unit/api-cron-loyalty-sync.test.ts tests/unit/api-admin-orders-cancel.test.ts tests/unit/promo-rewards-loyalty-switch.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** En `loyalty()`, primera línea: `if (loyaltyEnabled()) return;`. Los códigos ya emitidos no se tocan.
- [ ] **Step 4: Run them to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit** los archivos listados, mensaje `feat(loyalty): reintentos, cancelación y fin del premio de la quinta compra`.

### Task 7: La pantalla del checkout

**Files:**
- Create: `components/checkout/LoyaltyRewardField.tsx`
- Modify: `components/checkout/ContactStep.tsx`, `components/checkout/CheckoutShell.tsx:48-60,128,175,282`, `components/checkout/PromoCodeField.tsx`, `messages/es.json`, `messages/en.json`
- Test: `tests/unit/LoyaltyRewardField.test.tsx`, `tests/unit/ContactStep.test.tsx`

**Interfaces:**
- Consumes: rutas de Task 3, campos de Task 4, `rewardDiscountCents`.
- Produces: `AppliedLoyaltyReward = { id: string; percent: number; label: string; proof: string }`; props de `LoyaltyRewardField`: `{ phone: string; locale: Locale; applied: AppliedLoyaltyReward | null; onApply(r: AppliedLoyaltyReward): void; onClear(): void; onStatus(s: "unavailable" | "no_card" | "card"): void }`. `ContactStep` recibe `showJoinCard: boolean`. `PromoCodeField` recibe `clearSignal: number`, y aplicar un premio lo incrementa para vaciar el código.

Comportamiento: consultar `lookup` 400 ms después de que el celular tenga al menos 10 dígitos. El campo se muestra debajo de `ContactStep`, con el mayor porcentaje preseleccionado. Cambiar el celular borra el premio aplicado. Aplicar un código promocional borra el premio y viceversa. La casilla se muestra solo con estado `no_card`, sin marcar. Con `unavailable`, no se muestra ninguno. Si el pago devuelve `loyalty_reward_unavailable` o `loyalty_proof_invalid`, se quita el premio y se muestra el mensaje.

Textos, claves bajo `checkout`:

| Clave | es | en |
|---|---|---|
| `loyalty_has_reward` | Tienes premios en tu tarjeta | You have rewards on your card |
| `loyalty_use` | Usar premio | Use reward |
| `loyalty_send_code` | Te enviaremos un código por SMS | We'll text you a code |
| `loyalty_code_label` | Código de 6 dígitos | 6-digit code |
| `loyalty_confirm` | Confirmar | Confirm |
| `loyalty_applied` | Premio aplicado | Reward applied |
| `loyalty_remove` | Quitar | Remove |
| `loyalty_wrong_code` | Ese código no es correcto | That code isn't correct |
| `loyalty_expired_code` | El código venció. Pide otro | That code expired. Request a new one |
| `loyalty_rate_limited` | Demasiados intentos. Intenta más tarde | Too many attempts. Try again later |
| `loyalty_unavailable` | Ese premio ya no está disponible | That reward is no longer available |
| `join_card_label` | Quiero unirme a la tarjeta de fidelización de Diva Flowers y acumular sellos con mis compras. | I want to join the Diva Flowers loyalty card and earn stamps with my orders. |

- [ ] **Step 1: Write the failing tests**

```tsx
it("shows nothing when lookup is unavailable");
it("preselects the highest percent");
it("asks for a code before applying and calls onApply with the proof");
it("shows the wrong-code message and keeps the reward unapplied");
it("clears the applied reward when the phone changes");
it("join checkbox renders only with showJoinCard and starts unchecked");
it("the rendered text never contains a name or stamp count");
```

- [ ] **Step 2: Run them to verify they fail.** Run: `npm test -- tests/unit/LoyaltyRewardField.test.tsx tests/unit/ContactStep.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** El descuento visible es `promo?.discountCents`, o `rewardDiscountCents(subtotal, applied.percent)` si hay premio aplicado, o 0. `createIntent` envía `loyaltyRewardId` y `loyaltyProof`.
- [ ] **Step 4: Run them, the whole suite and the type check.** Run: `npm test` y `npx tsc --noEmit`. Expected: todo en verde.
- [ ] **Step 5: Commit** los archivos listados, mensaje `feat(loyalty): premios y casilla de la tarjeta en el checkout`.
