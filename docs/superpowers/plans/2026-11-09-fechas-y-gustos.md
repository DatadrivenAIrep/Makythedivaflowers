# Fechas y gustos a cambio de sellos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los clientes de Diva guarden fechas y gustos de quienes quieren a cambio de hasta 2 sellos, y que esas fechas generen un aviso a 7 días y un SMS de venta a 3 días.

**Architecture:** El programa de fidelización gana un endpoint `POST /api/v1/customers/:id/bonus` que suma sellos sin contar visita. Diva guarda fechas y gustos por persona, encola los sellos en `loyalty_bonus` (reintentados por el cron de `loyalty-sync`), pregunta en la confirmación y en `/account/dates`, y el cron de recordatorios envía `d3` y `d7` con un registro por etapa. Todo queda tras dos variables apagadas por defecto.

**Tech Stack:** Programa: Node 22, Express 5, `node:sqlite`, `node:test`. Diva: Next.js 16 (App Router), TypeScript, `node:sqlite`, zod 4, next-intl, vitest + Testing Library, Twilio.

**Spec:** `docs/superpowers/specs/2026-11-09-fechas-y-gustos-design.md` (aprobado el 2026-11-09, con 1 sello de bienvenida).

**Repos:** Tarea 1 en `/Volumes/Datadriven/02_PROYECTOS/programa-fidelizacion`. Tareas 2 a 12 en `/Volumes/Datadriven/02_PROYECTOS/Diva Flowers`.

## Global Constraints

- Variables, apagadas si no valen `"1"` o `"true"`: `DATE_REWARDS_ENABLED` (pregunta, Mis fechas, sellos, panel nuevo y el cambio de permiso de `dueReminders`) y `DATE_REMINDER_D3_ENABLED` (mensaje de 3 días). Sin ellas, Diva se comporta igual que hoy; solo corren la migración y el registro de `sms_stopped_at`.
- Máximo 2 sellos por datos por cliente, para siempre: cupos `fecha` y `gustos`, 1 sello cada uno. Requieren tarjeta y al menos un pedido pagado y no cancelado en Diva.
- "Evitar" nunca da sello y nunca aparece en un SMS. No se guardan alergias ni datos de salud: solo códigos de listas fijas, sin texto libre.
- Las fechas que carga el personal en el panel no dan sello.
- Los SMS van solo al comprador, nunca al destinatario.
- Sellos por datos: `orderId` = `diva-dato-<slot>-<id de la tarjeta>`; nunca cuentan como visita ni acreditan referidos.
- Nada del camino de sellos puede bloquear ni hacer fallar el guardado de una fecha.
- Todo texto nuevo de interfaz va en `messages/es.json` y `messages/en.json`. Las plantillas de SMS viven en `lib/`, como `renderReminder` hoy.
- `messaging_channel` solo cambia donde ya cambia: STOP y el error 21610.
- Commits: uno por tarea, nunca `git add` de `.DS_Store` ni `.claude/`, sin push. Cada mensaje termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pruebas de Diva: `npm test -- <archivo>`; todas: `npm test`. Tipos: `npx tsc --noEmit`. Programa: `npm test`.

## Review Focus

1. **Doble toque en Guardar** (dos POST simultáneos del mismo pedido): una sola fecha, una sola respuesta, un solo sello. Prueba en la Tarea 7.
2. **Un cliente con dos registros en Diva y una sola tarjeta**: los dos intentos usan el mismo `orderId` y el programa responde `duplicate`. Prueba en la Tarea 5.
3. **Nombre de persona con emoji, enlace o más de 40 letras**: el SMS sale sin el nombre, nunca con el texto raro. Prueba en la Tarea 10.
4. **Fecha imposible** (30 de febrero, mes 13): 400 sin consumir la respuesta del pedido, que se puede reintentar. El 29 de febrero sí vale. Prueba en la Tarea 7.
5. **Programa caído al guardar**: la fecha se guarda y responde rápido, el sello queda `pending` y el cron lo completa. Prueba en las Tareas 5 y 7.

---

### Task 1: Programa — sellos de regalo por API

**Files:**
- Modify: `src/loyalty.js:644-663` (`adjust`)
- Modify: `src/api.js` (ruta nueva junto a `/customers/:id/stamps`, línea 129)
- Modify: `public/api.md` (documentación pública que sirve `/ayuda/api`)
- Test: `test/api-v1.test.js`

**Interfaces:**
- Produces: `L.adjust(db, business, customerId, delta, note, { actor = 'dueño', within = null, orderId = null } = {})`. `within(eventId, { earned })` corre dentro de la transacción; `orderId` se pasa a `earnMilestones`. Devuelve `{ customer, changes, eventId, earned }`.
- Produces: `POST /api/v1/customers/:id/bonus`, cuerpo `{ orderId: string(1..100), count?: entero 1..10 (por defecto 1), note?: string hasta 120 }` → `200 { eventId, earned, customer }`; repetido → `200 { eventId, earned, customer, duplicate: true }`. Errores: `400 invalid`, `404 customer_not_found`, `409 order_customer_mismatch`, `409 order_reversed`, `paused` como las demás rutas.

- [ ] **Step 1: Escribir las pruebas que fallan**, usando `start()` del archivo:

```js
test('bonus suma sellos sin visita ni referido', async () => {
  // referidor A y amigo B que se une con el código de A (referral_status 'pending')
  // POST /api/v1/customers/<B>/bonus { orderId: 'diva-dato-fecha-1', count: 2, note: 'Diva: fecha guardada' }
  assert.equal(r.status, 200);
  assert.equal(r.json.customer.stamps, before + 2);
  assert.equal(r.json.customer.visits, 0);
  const row = db.get('SELECT last_visit_at, referral_status FROM customers WHERE id = ?', B);
  assert.equal(row.last_visit_at, null);
  assert.equal(row.referral_status, 'pending');
  assert.equal(db.get('SELECT referrals FROM customers WHERE id = ?', A).referrals, 0);
  const ev = db.get("SELECT * FROM events WHERE customer_id = ? ORDER BY id DESC LIMIT 1", B);
  assert.deepEqual([ev.type, ev.actor, ev.note], ['adjust', 'api:Prueba', 'Diva: fecha guardada']);
});
test('bonus repetido responde duplicate y no suma', ...);           // 2.º POST igual → duplicate: true, stamps sin cambio
test('bonus gana el premio intermedio y avisa con la orden', ...);  // cliente en 2 sellos, hito en 3; webhook configurado como en test/webhooks.test.js
                                                                     // → earned.length === 1 y una fila 'reward.earned' en webhook_deliveries cuyo body tiene orderId 'diva-dato-fecha-1'
test('bonus valida count y note', ...);                             // count 0, 11 y 'a' → 400 invalid; note de 121 caracteres → 400 invalid
test('bonus no se revierte por la orden', ...);                     // POST /api/v1/orders/diva-dato-fecha-1/reverse → 404 order_not_found; stamps sin cambio
test('bonus no alcanza clientes de otro negocio', ...);             // clave del negocio B sobre cliente del A → 404 customer_not_found
test('el ajuste del panel sigue firmando como dueño', ...);         // L.adjust(db, b, id, 1, 'x').customer y el evento con actor 'dueño'
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test`
Expected: FAIL en las pruebas nuevas (404 en la ruta).

- [ ] **Step 3: Ampliar `adjust` con el sexto parámetro y agregar la ruta**

La ruta sigue el patrón de `/stamps`: `orderIdOf`, `customerFromPath`, `knownOrder(req, orderId, 'bonus', c)` (si existe responde lo guardado con `duplicate: true`), `L.assertActive`, valida `count` con `Number.isInteger` en 1..10 y `note` string de hasta 120 (`UserError(..., 'invalid', 400)`), llama a `L.adjust(db, req.business, c.id, count, note, { actor: actorOf(req), orderId, within: recorder(req, orderId, 'bonus', c, null) })` y `wallet.syncChanges`. No se toca `CODES` ni `reverseOrder`.

- [ ] **Step 4: Documentar en `public/api.md`** una sección "Sellos de regalo" con el cuerpo, la respuesta, que no suma visita ni acredita referidos, que es idempotente por `orderId` y que `/orders/:orderId/reverse` no la deshace.

- [ ] **Step 5: Correr y ver que pasan**

Run: `npm test`
Expected: PASS, todas.

- [ ] **Step 6: Commit**

```bash
git add src/loyalty.js src/api.js public/api.md test/api-v1.test.js
git commit -m "API pública: sellos de regalo sin visita (POST /customers/:id/bonus)"
```

---

### Task 2: Diva — esquema y variables

**Files:**
- Create: `db/migrations/042_date_rewards.sql`
- Create: `lib/date-rewards-flags.ts`
- Create: `tests/helpers/migrate-up-to.ts`
- Test: `tests/unit/date-rewards-schema.test.ts`
- Modify: `.env.example` si existe; si no, documentar las variables en la Tarea 12

**Interfaces:**
- Produces: `dateRewardsEnabled(): boolean`, `d3RemindersEnabled(): boolean` (leen `DATE_REWARDS_ENABLED` y `DATE_REMINDER_D3_ENABLED`; verdadero solo con `"1"` o `"true"`).
- Produces (tablas): las de abajo, con estos nombres exactos. `date_reminder_sends` cambia `sent_at` por `recorded_at`.
- Produces (pruebas): `applyMigrationsUpTo(db: DatabaseSync, lastFile: string): void` en `tests/helpers/migrate-up-to.ts`, que aplica en orden los `.sql` de `db/migrations` hasta `lastFile` inclusive y los anota en `schema_migrations`, igual que `runMigrations`.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
it("pasa los avisos ya enviados como d7/sent", () => {
  // getDb() con SQLITE_FILE=":memory:", applyMigrationsUpTo(db, "041_loyalty_card.sql")
  // INSERT INTO date_reminder_sends (date_id, occurrence_date, sent_at) VALUES ('cid_1', '2026-12-01', '2026-11-24T14:15:00Z')
  runMigrations();
  expect(db.prepare("SELECT date_id, occurrence_date, stage, status, skip_reason, recorded_at FROM date_reminder_sends").all())
    .toEqual([{ date_id: "cid_1", occurrence_date: "2026-12-01", stage: "d7", status: "sent", skip_reason: null, recorded_at: "2026-11-24T14:15:00Z" }]);
});
it("permite d3 y d7 de la misma fecha y año", ...);        // dos INSERT con stage distinto → 2 filas; repetir (date, occ, 'd3') → error de clave
it("las fechas existentes quedan con source 'admin'", ...);
it("date_prompt_answers admite una sola respuesta por pedido", ...);
it("las variables están apagadas por defecto", ...);       // sin env → false; "1" y "true" → true; "yes" → false
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm test -- tests/unit/date-rewards-schema.test.ts`
Expected: FAIL (no existe la migración ni el helper).

- [ ] **Step 3: Escribir la migración**

```sql
ALTER TABLE customer_important_dates ADD COLUMN source TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE customers ADD COLUMN sms_stopped_at TEXT;

CREATE TABLE IF NOT EXISTS date_preferences (
  date_id TEXT NOT NULL,
  kind    TEXT NOT NULL CHECK(kind IN ('favorite_flower','favorite_color','avoid')),
  value   TEXT NOT NULL,
  PRIMARY KEY (date_id, kind, value)
);
CREATE TABLE IF NOT EXISTS date_prompt_answers (
  order_id   TEXT PRIMARY KEY,
  answer     TEXT NOT NULL CHECK(answer IN ('date','likes','dismiss')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS loyalty_bonus (
  customer_id TEXT NOT NULL,
  slot        TEXT NOT NULL CHECK(slot IN ('fecha','gustos')),
  status      TEXT NOT NULL CHECK(status IN ('pending','done','failed')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (customer_id, slot)
);
CREATE TABLE IF NOT EXISTS marketing_consent_log (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL,
  action       TEXT NOT NULL CHECK(action IN ('grant','revoke')),
  source       TEXT NOT NULL CHECK(source IN ('date_prompt','account')),
  ip           TEXT,
  text_version TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE TABLE date_reminder_sends_new (
  date_id         TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  stage           TEXT NOT NULL CHECK(stage IN ('d7','d3')),
  status          TEXT NOT NULL CHECK(status IN ('sent','skipped')),
  skip_reason     TEXT,
  recorded_at     TEXT NOT NULL,
  PRIMARY KEY (date_id, occurrence_date, stage)
);
INSERT INTO date_reminder_sends_new (date_id, occurrence_date, stage, status, recorded_at)
  SELECT date_id, occurrence_date, 'd7', 'sent', sent_at FROM date_reminder_sends;
DROP TABLE date_reminder_sends;
ALTER TABLE date_reminder_sends_new RENAME TO date_reminder_sends;
```

- [ ] **Step 4: Crear `lib/date-rewards-flags.ts` y el helper de pruebas**

- [ ] **Step 5: Correr las pruebas de la tarea y las de recordatorios**

Run: `npm test -- tests/unit/date-rewards-schema.test.ts tests/unit/date-reminders.test.ts tests/unit/api-cron-reminders.test.ts`
Expected: la prueba nueva pasa. Si `markReminderSent` falla por `sent_at`, cambiar solo su `INSERT` a `(date_id, occurrence_date, stage, status, recorded_at) VALUES (?, ?, 'd7', 'sent', ?)` y su consulta de duplicados a `AND stage = 'd7'`; la Tarea 10 lo reemplaza.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/042_date_rewards.sql lib/date-rewards-flags.ts lib/date-reminders.ts tests/helpers/migrate-up-to.ts tests/unit/date-rewards-schema.test.ts
git commit -m "feat(fechas): esquema para fechas y gustos a cambio de sellos"
```

---

### Task 3: Fechas por persona, listas fijas y gustos por fecha

**Files:**
- Create: `lib/date-preference-options.ts`
- Create: `lib/date-preferences-storage.ts`
- Modify: `lib/customer-dates-storage.ts` (`source`, `findRecipientDate`, borrado en cascada, `rememberRecipientDate` usa el buscador)
- Test: `tests/unit/date-preferences-storage.test.ts`, `tests/unit/date-preference-options.test.ts`; ampliar `tests/unit/customer-dates-storage.test.ts`

**Interfaces:**
- Produces en `lib/customer-dates-storage.ts`:
  - `type DateSource = "admin" | "customer"`; `ImportantDate.source: DateSource`; `ImportantDateInput.source?: DateSource` (por defecto `"admin"`).
  - `findRecipientDate(customerId: string, who: { name: string; phone?: string }, kinds?: DateKind[]): ImportantDate | null`: misma regla que hoy usa `rememberRecipientDate` (últimos 10 dígitos del celular, o `label` igual sin mayúsculas ni espacios de borde); la más antigua si hay varias.
  - `removeImportantDate` borra también sus filas de `date_preferences`.
- Produces en `lib/date-preference-options.ts`:
  - `FLOWERS = ["roses","hydrangeas","peonies","tulips","sunflowers","orchids","lilies","carnations","gerberas","lisianthus"] as const`; `type FlowerCode`.
  - `COLORS = ["red","pink","white","lavender","yellow","orange","pastel"] as const`; `type ColorCode`.
  - `AVOID = [...FLOWERS, "strong_scent", "heavy_pollen"] as const`; `type AvoidCode`.
  - `flowersPhrase(flower: FlowerCode | undefined, color: ColorCode | undefined, locale: "es" | "en"): string | null`.
- Produces en `lib/date-preferences-storage.ts`:
  - `type DatePreferences = { flowers: FlowerCode[]; colors: ColorCode[]; avoid: AvoidCode[] }`.
  - `getDatePreferences(dateId: string): DatePreferences` (vacío si no hay).
  - `setDatePreferences(dateId: string, prefs: DatePreferences): DatePreferences`: reemplaza todo; descarta códigos que no están en la lista y repetidos; recorta a 3 flores y 3 colores, en el orden recibido.
  - `preferencesForRecipient(customerId: string, who: { name: string; phone?: string }): DatePreferences | null`: los gustos de la fecha más reciente de esa persona que tenga alguno.
- Produces (mensajes de interfaz): `messages/{es,en}.json` → `date_prefs.flowers.<code>`, `date_prefs.colors.<code>`, `date_prefs.avoid.strong_scent`, `date_prefs.avoid.heavy_pollen` (las flores a evitar reutilizan `date_prefs.flowers.<code>`).

Primera versión de las listas (Maky la revisa antes de encender). Etiquetas de botón y forma para el SMS:

| Código | Botón es / en | SMS es | SMS en |
|---|---|---|---|
| roses | Rosas / Roses | rosas | roses |
| hydrangeas | Hortensias / Hydrangeas | hortensias | hydrangeas |
| peonies | Peonías / Peonies | peonías | peonies |
| tulips | Tulipanes / Tulips | tulipanes | tulips |
| sunflowers | Girasoles / Sunflowers | girasoles | sunflowers |
| orchids | Orquídeas / Orchids | orquídeas | orchids |
| lilies | Lirios / Lilies | lirios | lilies |
| carnations | Claveles / Carnations | claveles | carnations |
| gerberas | Gerberas / Gerberas | gerberas | gerberas |
| lisianthus | Lisianthus / Lisianthus | lisianthus | lisianthus |
| red | Rojo / Red | rojos | red |
| pink | Rosa / Pink | rosados | pink |
| white | Blanco / White | blancos | white |
| lavender | Lavanda / Lavender | lavanda | lavender |
| yellow | Amarillo / Yellow | amarillos | yellow |
| orange | Naranja / Orange | naranjas | orange |
| pastel | Pastel / Pastel | pastel | pastel |
| strong_scent | Perfume fuerte / Strong scent | — | — |
| heavy_pollen | Mucho polen / Lots of pollen | — | — |

`flowersPhrase`: es `"{flor} en tonos {color}"`, solo flor `"{flor}"`, solo color `"flores en tonos {color}"`; en `"{color} {flower}"`, solo flor `"{flower}"`, solo color `"{color} flowers"`; sin ninguno `null`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
expect(flowersPhrase("hydrangeas", "lavender", "es")).toBe("hortensias en tonos lavanda");
expect(flowersPhrase("hydrangeas", "lavender", "en")).toBe("lavender hydrangeas");
expect(flowersPhrase(undefined, "pink", "es")).toBe("flores en tonos rosados");
expect(flowersPhrase(undefined, undefined, "en")).toBeNull();
// cada código de FLOWERS, COLORS y AVOID tiene etiqueta en messages/es.json y messages/en.json

it("setDatePreferences descarta códigos desconocidos y recorta a 3", ...); // flowers ["roses","x","roses","tulips","peonies","orchids"] → ["roses","tulips","peonies"]
it("borrar la fecha borra sus gustos", ...);
it("preferencesForRecipient trae los gustos de la misma persona por celular o nombre", ...);
it("findRecipientDate encuentra por los últimos 10 dígitos y por nombre sin mayúsculas", ...);
it("addImportantDate guarda source 'customer' cuando se pide y 'admin' por defecto", ...);
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/date-preference-options.test.ts tests/unit/date-preferences-storage.test.ts tests/unit/customer-dates-storage.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar** los dos módulos, las etiquetas en `messages/*.json` y los cambios en `customer-dates-storage.ts`. `rememberRecipientDate` pasa a usar `findRecipientDate(customerId, { name, phone }, [input.kind])`, sin cambiar su resultado.

- [ ] **Step 4: Correr y ver que pasan**, más `tests/unit/intake-remember-date.test.ts`

Run: `npm test -- tests/unit/date-preference-options.test.ts tests/unit/date-preferences-storage.test.ts tests/unit/customer-dates-storage.test.ts tests/unit/intake-remember-date.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/date-preference-options.ts lib/date-preferences-storage.ts lib/customer-dates-storage.ts messages/es.json messages/en.json tests/unit/date-preference-options.test.ts tests/unit/date-preferences-storage.test.ts tests/unit/customer-dates-storage.test.ts
git commit -m "feat(fechas): gustos por fecha con listas fijas"
```

---

### Task 4: Permiso de SMS promocionales

**Files:**
- Create: `lib/promo-consent.ts`
- Modify: `app/api/twilio/inbound/route.ts:60-68`, `lib/campaign-sender.ts:82-86`, `lib/date-reminders.ts` (consulta de `dueReminders`)
- Test: `tests/unit/promo-consent.test.ts`; ampliar `tests/unit/api-twilio-inbound.test.ts` y `tests/unit/date-reminders.test.ts`

**Interfaces:**
- Produces:
  - `type SmsPermission = "granted" | "stopped" | "none"`.
  - `smsPermission(customerId: string): SmsPermission`: `"stopped"` si `sms_stopped_at` no es nulo; si no, `"granted"` con la etiqueta `sms-marketing`; si no, `"none"`.
  - `grantPromoConsent(customerId: string, ctx: { source: "date_prompt" | "account"; ip: string }): SmsPermission`: con `"stopped"` no hace nada y lo devuelve; si no, agrega la etiqueta y una fila `grant` en `marketing_consent_log`, y devuelve `"granted"`. No toca `messaging_channel`.
  - `revokePromoConsent(customerId: string, ctx: { source: "account"; ip: string }): void`: quita la etiqueta y registra `revoke`.
  - `markSmsStopped(customerId: string, now?: Date): void`, `clearSmsStopped(customerId: string): void`.
  - `PROMO_CONSENT_TEXT_VERSION = "2026-11-09"`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it("grant agrega la etiqueta y deja constancia", ...);    // smsPermission → "granted"; 1 fila con source, ip, text_version "2026-11-09"
it("grant con STOP no hace nada", ...);                   // markSmsStopped → grant devuelve "stopped", sin etiqueta, sin fila
it("revoke quita la etiqueta y registra", ...);
// api-twilio-inbound:
it("STOP marca sms_stopped_at además de lo de hoy", ...);
it("START limpia sms_stopped_at y no devuelve la etiqueta", ...); // también con messaging_channel ya en 'sms'
// campaign-sender: un 21610 marca sms_stopped_at
// date-reminders:
it("con DATE_REWARDS_ENABLED, quien solo aceptó promociones recibe el aviso", ...); // messaging_channel 'none' + etiqueta → 1 aviso
it("sin la variable, todo sigue igual", ...);                                     // mismo caso → 0 avisos
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/promo-consent.test.ts tests/unit/api-twilio-inbound.test.ts tests/unit/date-reminders.test.ts tests/unit/campaign-sender.test.ts`
Expected: FAIL en las nuevas (si no existe `campaign-sender.test.ts`, la prueba del 21610 va en `promo-consent.test.ts` con `sendSms` simulado).

- [ ] **Step 3: Implementar** `lib/promo-consent.ts` y los tres cambios. En `dueReminders`, la condición `messaging_channel` se aplica solo cuando `dateRewardsEnabled()` es falso.

- [ ] **Step 4: Correr y ver que pasan**

Run: el mismo comando del Step 2
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/promo-consent.ts app/api/twilio/inbound/route.ts lib/campaign-sender.ts lib/date-reminders.ts tests/unit/promo-consent.test.ts tests/unit/api-twilio-inbound.test.ts tests/unit/date-reminders.test.ts
git commit -m "feat(fechas): permiso de promociones independiente y registro de STOP"
```

---

### Task 5: Cola de sellos por datos

**Files:**
- Create: `lib/loyalty-bonus.ts`
- Modify: `lib/loyalty-client.ts` (`addBonus`, `rewards.next`), `app/api/cron/loyalty-sync/route.ts`
- Test: `tests/unit/loyalty-bonus.test.ts`; ampliar `tests/unit/loyalty-client.test.ts` y `tests/unit/api-cron-loyalty-sync.test.ts`

**Interfaces:**
- Consumes: `dateRewardsEnabled()` (Tarea 2); `lookupCustomer`, `loyaltyEnabled`, `LoyaltyApiError` (existentes).
- Produces en `lib/loyalty-client.ts`:
  - `LoyaltyCustomer.rewards.next?: { at: number; reward: string; remaining: number }` (opcional: si falta o no tiene esa forma, `parseCustomer` lo deja `undefined` y no falla).
  - `addBonus(customerId: number, orderId: string, note: string, opts: CallOpts): Promise<void>` → `POST /customers/:id/bonus` con `{ orderId, count: 1, note }`.
- Produces en `lib/loyalty-bonus.ts` (nada exportado lanza):
  - `type BonusSlot = "fecha" | "gustos"`.
  - `bonusSlotFree(customerId: string, slot: BonusSlot): boolean` (no hay fila para ese cupo).
  - `claimBonus(customerId: string, slot: BonusSlot): boolean`: `false` si la función o la tarjeta están apagadas, el cupo ya tiene fila, o el cliente no tiene un pedido con `payment_status = 'paid'` y `fulfillment_status <> 'canceled'`; si no, inserta `pending` con `INSERT OR IGNORE` y devuelve si insertó.
  - `runBonus(customerId: string, slot: BonusSlot): Promise<void>`.
  - `runDueBonuses(now?: Date): Promise<{ done: number; pending: number; failed: number }>`.

`runBonus`: busca la tarjeta con `lookupCustomer(e164(teléfono del cliente), { timeoutMs: 10_000 })`. Con tarjeta, `addBonus(card.id, \`diva-dato-${slot}-${card.id}\`, nota, ...)` y `done`; la nota es `"Diva: fecha guardada"` o `"Diva: gustos guardados"`. Sin tarjeta: si hay una fila `loyalty_sync` `kind='sync'`, `status='pending'` de un pedido de ese cliente, sigue `pending`; si no, borra la fila. Error: `attempts + 1` y `last_error` = código, como `recordFailure` en `lib/loyalty-sync.ts`. `runDueBonuses` pasa a `failed`, solo con log, lo que tenga más de 72 horas.

- [ ] **Step 1: Escribir las pruebas que fallan** (simulando `lib/loyalty-client` como `tests/unit/loyalty-sync.test.ts`)

```ts
it("sin pedido pagado no reclama el cupo", ...);                 // claimBonus → false y sin fila
it("el mismo cupo no se reclama dos veces", ...);                // 2.º claimBonus → false
it("envía el sello con el orderId de la tarjeta", ...);          // card id 77 → addBonus(77, "diva-dato-fecha-77", "Diva: fecha guardada", ...) y status 'done'
it("dos registros de Diva con la misma tarjeta usan el mismo orderId", ...);
it("sin tarjeta y con un pedido por registrar, espera", ...);    // status sigue 'pending'
it("sin tarjeta y sin nada pendiente, libera el cupo", ...);     // fila borrada; claimBonus vuelve a dar true
it("un error deja el intento contado y pendiente", ...);         // attempts 1, last_error 'unavailable'
it("más de 72 horas pasa a failed", ...);
it("runBonus no lanza aunque lookup lance", ...);
// loyalty-client: addBonus hace POST /customers/5/bonus con { orderId, count: 1, note }; parseCustomer acepta y lee rewards.next
// api-cron-loyalty-sync: con DATE_REWARDS_ENABLED la respuesta agrega `bonus: { done, pending, failed }`; sin ella, igual que hoy
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/loyalty-bonus.test.ts tests/unit/loyalty-client.test.ts tests/unit/api-cron-loyalty-sync.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** el módulo, los cambios del cliente y la llamada a `runDueBonuses()` en el cron después de `runDuePending()`, solo con `dateRewardsEnabled()`.

- [ ] **Step 4: Correr y ver que pasan**

Run: el mismo comando del Step 2
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/loyalty-bonus.ts lib/loyalty-client.ts app/api/cron/loyalty-sync/route.ts tests/unit/loyalty-bonus.test.ts tests/unit/loyalty-client.test.ts tests/unit/api-cron-loyalty-sync.test.ts
git commit -m "feat(fechas): cola de sellos por datos con tope de 2"
```

---

### Task 6: Qué preguntar después de la compra

**Files:**
- Create: `lib/date-prompt.ts`
- Modify: `lib/product-add-ons.ts:38` (exportar `isSympathyProduct`, hoy `isSympathy`), `lib/date-suggestions.ts:86` (exportar `inHoliday`)
- Test: `tests/unit/date-prompt.test.ts`

**Interfaces:**
- Consumes: `findRecipientDate`, `getDatePreferences`, `preferencesForRecipient`, `DatePreferences` (Tarea 3); `bonusSlotFree`, `BonusSlot`, `rewards.next` (Tarea 5); `dateRewardsEnabled` (Tarea 2).
- Produces:
  - `type DatePromptQuestion = { kind: "date"; recipientName: string; prefill: { month: number; day: number } | null } | { kind: "likes"; dateId: string; recipientName: string; prefill: DatePreferences | null }`.
  - `orderQualifiesForPrompt(order: Order, now?: Date): boolean`.
  - `promptQuestion(order: Order, now?: Date): DatePromptQuestion | null`.
  - `type PromptReward = { kind: "reward"; reward: string } | { kind: "stamp" } | null`.
  - `promptReward(order: Order, slot: BonusSlot, opts?: { timeoutMs?: number }): Promise<PromptReward>` (por defecto 3000 ms; nunca lanza).

Reglas de `orderQualifiesForPrompt` (todas deben cumplirse): `dateRewardsEnabled()`; `paymentStatus === "paid"` y `status !== "canceled"`; `createdAt` de hace 30 días o menos; `customerId`; `source === "web"`; `!order.funeral`; ninguna línea de catálogo cuyo producto cumpla `isSympathyProduct`; no todas las líneas de catálogo son de producto con `occasions` solo `"get-well"` o `category === "get-well"`; ninguna línea con producto de `subscription` definido o `category === "subscriptions"`; sin fila en `date_prompt_answers`. Productos con `getPricedProducts()`.

`promptQuestion`: destinatario `order.fulfillment.recipient`; sin nombre → `null`. `findRecipientDate(customerId, recipient, ["birthday","anniversary"])`: sin fecha → `date` con `prefill` de `window.date` salvo `in-store` o `inHoliday(mes, día)` → `null`; con fecha y sin flores ni colores → `likes` con `prefill` de `preferencesForRecipient`; si no, `null`.

`promptReward`: cupo ocupado o `loyaltyEnabled()` falso → `null`. Con tarjeta: `restan = next.remaining - (fila loyalty_sync de este pedido en 'pending' ? 1 : 0)`; `restan === 1` → `{ kind: "reward", reward: next.reward }`; si no o sin `next` → `{ kind: "stamp" }`. Sin tarjeta: `order.loyaltyJoin` y su `loyalty_sync` pendiente → `{ kind: "stamp" }`; si no → `null`. Error o tiempo agotado → `null`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// una por exclusión: sin pagar, cancelado, 31 días, sin customerId, source "phone", funeral, producto de condolencias,
// solo get-well, suscripción, ya respondido, variable apagada → false; pedido normal → true
it("pide la fecha con la entrega precargada", ...);       // window.date "2026-03-18" → { kind: "date", recipientName: "Laura", prefill: { month: 3, day: 18 } }
it("no precarga en temporada", ...);                      // "2026-02-14" → prefill null
it("no precarga en tienda", ...);                         // method "in-store" → prefill null
it("con fecha y sin gustos pide gustos", ...);            // kind "likes", dateId de esa fecha
it("con fecha y gustos no pregunta", ...);
it("promete el premio cuando este sello lo alcanza", ...); // next { remaining: 2, reward: "15%" } y sync pendiente → { kind: "reward", reward: "15%" }
it("si el pedido ya se registró, promete solo el sello", ...); // remaining 2, sync 'done' → { kind: "stamp" }
it("tarjeta en camino con este pedido → sello", ...);
it("sin tarjeta ni inscripción → nada", ...);
it("cupo usado → nada", ...);
it("programa que no responde → nada", ...);               // lookup rechaza → null
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/date-prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `lib/date-prompt.ts` y los dos `export`.

- [ ] **Step 4: Correr y ver que pasan**, junto con las pruebas de los módulos tocados

Run: `npm test -- tests/unit/date-prompt.test.ts tests/unit/date-suggestions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/date-prompt.ts lib/product-add-ons.ts lib/date-suggestions.ts tests/unit/date-prompt.test.ts
git commit -m "feat(fechas): qué preguntar tras la compra y qué premio prometer"
```

---

### Task 7: API de la pregunta

**Files:**
- Create: `app/api/orders/[id]/date-prompt/route.ts`
- Test: `tests/unit/api-date-prompt.test.ts`

**Interfaces:**
- Consumes: Tareas 3 a 6; `rateLimit`, `ipFromRequest`; `isValidMonthDay`; `getOrder`.
- Produces:
  - `GET /api/orders/:id/date-prompt` → `404 { error: "not_found" }` si el pedido no existe o no califica, o si `promptQuestion` es `null`; si no, `200 { question: DatePromptQuestion, reward: PromptReward, permission: SmsPermission }`.
  - `POST /api/orders/:id/date-prompt`, cuerpo (zod, unión por `action`): `{ action: "date"; kind: "birthday" | "anniversary"; month: number; day: number; smsOptIn: boolean }` | `{ action: "likes"; flowers: FlowerCode[]; colors: ColorCode[]; avoid: AvoidCode[]; smsOptIn: boolean }` | `{ action: "dismiss" }` → `200 { ok: true, permission: SmsPermission, stamp: boolean }`.
  - Errores: `400 invalid` (cuerpo o fecha), `404 not_found`, `409 already_answered`, `409 stale_question` (la acción no corresponde a la pregunta actual), `429 rate_limited` (`date-prompt:<ip>`, 30 por 10 minutos, GET y POST juntos).

Orden del POST: validar el cuerpo y `isValidMonthDay`; comprobar que califica; `INSERT INTO date_prompt_answers` (si choca la clave → 409, sin hacer nada más); después guardar. `date`: `addImportantDate(customerId, { kind, label: recipientName, month, day, recipientPhone, source: "customer" })`, copiar `preferencesForRecipient` a la nueva fecha si hay, `claimBonus(customerId, "fecha")`. `likes`: `setDatePreferences(question.dateId, ...)`; `claimBonus(customerId, "gustos")` solo si hay flores o colores. Si `smsOptIn`, `grantPromoConsent(customerId, { source: "date_prompt", ip })`. Si se reclamó, `void runBonus(...)` sin esperar. `stamp` en la respuesta es el resultado de `claimBonus`.

- [ ] **Step 1: Escribir las pruebas que fallan** (llamando a los handlers con `new Request`, como `tests/unit/api-checkout-loyalty.test.ts`)

```ts
it("404 si el pedido no califica", ...);
it("guarda la fecha como del cliente con el nombre del destinatario", ...); // source "customer", label "Laura"
it("una sola respuesta por pedido", ...);                 // 2.º POST → 409 already_answered y una sola fecha
it("dos POST simultáneos dejan una sola fecha", ...);     // Promise.all → un 200 y un 409
it("30 de febrero → 400 y se puede reintentar", ...);     // luego 2/29 → 200
it("la casilla marcada da permiso y deja constancia", ...);
it("con STOP la casilla no da permiso", ...);             // permission "stopped", sin etiqueta
it("solo evitar no reclama sello", ...);                  // likes { avoid: ["lilies"] } → stamp false
it("No, gracias cierra la pregunta", ...);                // dismiss → 200; GET → 404
it("con el programa caído guarda y responde", ...);       // runBonus simulado que rechaza → 200, fecha guardada, fila 'pending'
it("límite por IP", ...);                                 // la llamada 31 → 429
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/api-date-prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** la ruta (`runtime = "nodejs"`, `dynamic = "force-dynamic"`).

- [ ] **Step 4: Correr y ver que pasan**

Run: `npm test -- tests/unit/api-date-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/orders/[id]/date-prompt/route.ts" tests/unit/api-date-prompt.test.ts
git commit -m "feat(fechas): API para guardar la fecha o los gustos tras la compra"
```

---

### Task 8: Tarjeta en la confirmación

**Files:**
- Create: `components/dates/PreferencePicker.tsx` (botones de las listas fijas, con tope por grupo)
- Create: `components/checkout/DatePromptCard.tsx` (componente de cliente)
- Modify: `components/checkout/ConfirmationView.tsx:131` (insertar `<DatePromptCard orderId={order.id} locale={locale} />` antes de `ReciprocityCard`, solo con `dateRewardsEnabled()`)
- Modify: `messages/es.json`, `messages/en.json` (espacio `date_prompt`)
- Test: `tests/unit/DatePromptCard.test.tsx`

**Interfaces:**
- Consumes: la API de la Tarea 7; las etiquetas `date_prefs.*` (Tarea 3).
- Produces: `PreferencePicker({ value: DatePreferences; onChange: (v: DatePreferences) => void; locale })`, con 3 flores, 3 colores y "evitar" sin tope. La Tarea 9 lo reutiliza.

Estilo: el de `ReciprocityCard` (`rounded-2xl border border-ink/10 bg-bone/40 p-6`, rótulo `font-mono text-[10px] uppercase`, título `font-display text-xl`), como en la maqueta aprobada. Botones elegidos con fondo `ink`; Guardar en `rouge`; línea de premio en `rouge`.

Textos (`date_prompt.*`):

| Clave | es | en |
|---|---|---|
| eyebrow | Para que no se te pase | So you never miss it |
| date_title | ¿Quieres que te recordemos una fecha importante de {name}? | Want us to remind you of an important date for {name}? |
| kind_birthday / kind_anniversary | Cumpleaños / Aniversario | Birthday / Anniversary |
| day / month | Día / Mes | Day / Month |
| likes_eyebrow | Para acertar con {name} | To get it right for {name} |
| likes_title | ¿Qué le gusta? | What do they like? |
| flowers_label / colors_label / avoid_label | Flores favoritas / Colores / Mejor evitar | Favorite flowers / Colors / Best to avoid |
| consent_label | Avísame por SMS de esta fecha y envíame ofertas | Text me about this date and send me offers |
| consent_fine | Al marcar la casilla, aceptas recibir mensajes de texto automatizados y recurrentes con avisos y ofertas de Diva Flowers a este número. El consentimiento no es condición de compra. Pueden aplicar tarifas de mensajes y datos. La frecuencia varía. Responde STOP para cancelar, HELP para ayuda. | By checking the box, you agree to receive recurring automated texts with reminders and offers from Diva Flowers at this number. Consent is not a condition of purchase. Msg & data rates may apply. Message frequency varies. Reply STOP to cancel, HELP for help. |
| stopped_note | Para recibir avisos, envía START a nuestro número. | To get reminders, text START to our number. |
| reward_date | Guarda esta fecha y llévate {reward} en tu próxima compra | Save this date and get {reward} off your next order |
| reward_likes | Guárdalo y llévate {reward} en tu próxima compra | Save it and get {reward} off your next order |
| reward_stamp | Gana 1 sello | Earn 1 stamp |
| promise | Te avisamos antes para que no se te pase. | We'll remind you ahead of time. |
| save / dismiss | Guardar / No, gracias | Save / No, thanks |
| saved_sms | Listo. Te avisaremos antes de la fecha. | Done. We'll text you before the date. |
| saved_no_sms | Listo. Guardamos la fecha, pero sin permiso de SMS no te avisaremos. | Done. We saved the date, but without SMS permission we won't text you. |
| saved_likes | Listo. Lo tendremos en cuenta. | Done. We'll keep it in mind. |
| saved_stamp | Tu sello va en camino a tu tarjeta. | Your stamp is on its way to your card. |
| error | No se pudo guardar. Intenta de nuevo. | Couldn't save. Try again. |

Comportamiento: pide el GET al montarse y no muestra nada mientras carga, con 404 o con error. La casilla aparece sin marcar solo con `permission === "none"`; con `"stopped"` se ve `stopped_note`; con `"granted"`, nada. Línea de premio: `reward_date`/`reward_likes` con `{reward}`, `reward_stamp`, o `promise` si `reward` es `null`. Mes con nombres de `Intl.DateTimeFormat(locale, { month: "long" })`; días según `DAYS_IN_MONTH`. "No, gracias" envía `dismiss` y oculta la tarjeta. Tras guardar, el mensaje según el tipo y el permiso, más `saved_stamp` si `stamp`.

- [ ] **Step 1: Escribir las pruebas que fallan** (con `fetch` simulado)

```tsx
it("no muestra nada con 404", ...);
it("muestra la pregunta con el nombre y la fecha precargada", ...); // título con "Laura", 18 y marzo elegidos
it("muestra la promesa correcta según el premio", ...);             // "Guarda esta fecha y llévate 15% en tu próxima compra" / "Gana 1 sello" / promesa
it("la casilla empieza sin marcar y no aparece con permiso", ...);
it("con STOP muestra la instrucción de START", ...);
it("Guardar envía smsOptIn false por defecto", ...);                 // body { action: "date", kind: "birthday", month: 3, day: 18, smsOptIn: false }
it("No, gracias envía dismiss y oculta la tarjeta", ...);
it("no deja elegir una cuarta flor", ...);
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/DatePromptCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar** los dos componentes, los textos y la inserción en `ConfirmationView`.

- [ ] **Step 4: Correr y ver que pasan**, más tipos

Run: `npm test -- tests/unit/DatePromptCard.test.tsx && npx tsc --noEmit`
Expected: PASS, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add components/dates/PreferencePicker.tsx components/checkout/DatePromptCard.tsx components/checkout/ConfirmationView.tsx messages/es.json messages/en.json tests/unit/DatePromptCard.test.tsx
git commit -m "feat(fechas): pregunta de fecha y gustos en la confirmación"
```

---

### Task 9: Mis fechas en la cuenta

**Files:**
- Create: `lib/account-dates.ts`
- Create: `app/api/account/dates/route.ts`, `app/api/account/dates/[id]/route.ts`, `app/api/account/sms-permission/route.ts`
- Create: `app/[locale]/account/dates/page.tsx`, `components/account/MyDates.tsx`
- Modify: `components/account/AccountShell.tsx` (pestaña `dates` → `/${locale}/account/dates`, solo con `dateRewardsEnabled()`; `activeTab` admite `"dates"`), `messages/{es,en}.json` (`account.tabs.dates` = "Mis fechas" / "My dates", y `account.dates.*`)
- Test: `tests/unit/api-account-dates.test.ts`, `tests/unit/MyDates.test.tsx`

**Interfaces:**
- Consumes: Tareas 3 a 5 y 8 (`PreferencePicker`); `currentCustomerId(req)`; `recipientsForSender`, `dateSuggestionsFor`, `dismissSuggestion`, `listOrdersByCustomer`; `isSympathyProduct`.
- Produces en `lib/account-dates.ts`:
  - `MAX_DATES = 12`.
  - `type AccountDate = ImportantDate & { prefs: DatePreferences }`.
  - `accountDatesView(customerId: string, now?: Date): { dates: AccountDate[]; suggestions: DateSuggestion[]; permission: SmsPermission }`. Las sugerencias excluyen a los destinatarios (por celular o nombre) de pedidos con `funeral` o con un producto de condolencias.
  - `addCustomerDate(customerId: string, input: { kind: "birthday" | "anniversary"; name: string; month: number; day: number }, now?: Date): { ok: true; date: ImportantDate; stamp: boolean } | { ok: false; error: "too_many_dates" | "invalid" }`. Nombre recortado, de 1 a 40 caracteres que cumplan `/^\p{L}[\p{L} .'-]*$/u`; `source: "customer"`; copia `preferencesForRecipient(customerId, { name })` a la nueva fecha si hay; reclama `fecha`.
- Produces (rutas; todas con sesión del cliente o `401 { error: "unauthorized" }`, `404` con la variable apagada, límite `account-dates:<customerId>` de 60 por 10 minutos):
  - `GET /api/account/dates` → `accountDatesView`.
  - `POST /api/account/dates`, cuerpo `{ action: "add"; kind; name; month; day }` | `{ action: "dismiss_suggestion"; key: string }` → `200 { ok: true, stamp?: boolean }`; `400 invalid`; `409 too_many_dates`.
  - `DELETE /api/account/dates/:id` → borra solo si es del cliente (`404` si no); sin confirmación.
  - `PUT /api/account/dates/:id`, cuerpo `{ flowers, colors, avoid }` → `setDatePreferences`; reclama `gustos` si hay flores o colores.
  - `POST /api/account/sms-permission`, cuerpo `{ grant: boolean }` → `200 { permission }`; con STOP y `grant: true` → `409 { permission: "stopped" }`.

Página: comprueba la sesión como `app/[locale]/account/orders/page.tsx` y redirige a `/${locale}/account` si no hay; con la variable apagada, `notFound()`. Muestra la lista (persona, ocasión, fecha con `formatMonthDay`, gustos con `flowersPhrase` y "Agregar gustos" si no hay), botón de borrar inmediato, formulario "Agregar fecha", sugerencias con Guardar / Ahora no, y la fila de permiso de SMS ("activos" con Quitar; sin permiso, una casilla sin marcar con el mismo `consent_fine` de la Tarea 8; con STOP, `stopped_note`). Textos nuevos en `account.dates.*`, en el tono de la Tarea 8.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it("401 sin sesión", ...);
it("agregar guarda como del cliente y reclama el cupo fecha", ...);
it("la fecha 13 da 409 too_many_dates", ...);
it("no borra fechas de otro cliente", ...);                 // 404 y la fecha sigue
it("borrar y volver a crear no da otro sello", ...);         // 2.º add → stamp false
it("los gustos con flor reclaman gustos; solo evitar, no", ...);
it("las sugerencias no incluyen destinatarios de condolencias", ...);
it("dar permiso deja constancia; con STOP responde 409", ...);
it("nombre con enlace o de 41 letras → 400", ...);
// MyDates.test.tsx: borra sin confirmar; muestra START con STOP; la casilla empieza sin marcar
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/api-account-dates.test.ts tests/unit/MyDates.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar** módulo, rutas, página, componente, pestaña y textos.

- [ ] **Step 4: Correr y ver que pasan**, más las pruebas de la cuenta y tipos

Run: `npm test -- tests/unit/api-account-dates.test.ts tests/unit/MyDates.test.tsx tests/unit/api-account-auth.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/account-dates.ts app/api/account/dates app/api/account/sms-permission "app/[locale]/account/dates" components/account/MyDates.tsx components/account/AccountShell.tsx messages/es.json messages/en.json tests/unit/api-account-dates.test.ts tests/unit/MyDates.test.tsx
git commit -m "feat(fechas): pestaña Mis fechas en la cuenta del cliente"
```

---

### Task 10: Mensaje de 3 días y registro por etapa

**Files:**
- Create: `lib/date-sale-message.ts`
- Modify: `lib/date-reminders.ts`, `app/api/cron/reminders/route.ts`
- Test: `tests/unit/date-sale-message.test.ts`; ampliar `tests/unit/date-reminders.test.ts` y `tests/unit/api-cron-reminders.test.ts`

**Interfaces:**
- Consumes: `getDatePreferences`, `flowersPhrase` (Tarea 3); `markSmsStopped` (Tarea 4); `d3RemindersEnabled` (Tarea 2); `lookupCustomer`, `applicableRewards`, `smsSegments`, `removeTag`, `updateCustomer`.
- Produces en `lib/date-reminders.ts`:
  - `type ReminderStage = "d7" | "d3"`.
  - `dueReminders({ leadDays, stage = "d7", now })`: con `d3`, solo `birthday` y `anniversary`; excluye lo ya registrado para `(date_id, occurrence_date, stage)`, enviado u omitido.
  - `recordReminder(dateId: string, occurrenceDate: string, stage: ReminderStage, status: "sent" | "skipped", skipReason?: "recent_order" | "daily_cap" | "21610"): void`. `markReminderSent(dateId, occurrenceDate)` queda como atajo de `d7`/`sent`.
  - `hasRecentPaidOrder(customerId: string, now: Date, days = 7): boolean` (pagado, no cancelado, `created_at` en los últimos `days` días).
- Produces en `lib/date-sale-message.ts`:
  - `safePersonName(label?: string): string | null`: recortado, `/^[\p{L} ]{1,40}$/u`.
  - `renderSaleReminder(input: { customerName: string; kind: "birthday" | "anniversary"; label?: string; locale: "es" | "en"; prefs: DatePreferences | null; rewardPercent: number | null }): string`.

Plantilla (partes entre corchetes opcionales; `{Nombre}` es el primer nombre, y si falta se omite `"{Nombre}, "`):

- es, ocasión: cumpleaños con persona `"en 3 días es el cumpleaños de {persona}."`, sin persona `"en 3 días es un cumpleaños que guardaste."`; aniversario con persona `"en 3 días es tu aniversario con {persona}."`, sin persona `"en 3 días es tu aniversario."`
- en, ocasión: `"{person}'s birthday is in 3 days."` / `"a birthday you saved is in 3 days."` / `"your anniversary with {person} is in 3 days."` / `"your anniversary is in 3 days."`
- es: `Diva Flowers: {Nombre}, {ocasión} [Le preparamos {flores}, sus favoritas. | ¿Te lo preparamos?] [Tienes {N}% en tu tarjeta.] Pídelo: {enlace} Responde STOP para cancelar.`
- en: `Diva Flowers: {Name}, {occasion} [We can make {flowers}, their favorites. | Want us to make something?] [You have {N}% off on your card.] Order: {link} Reply STOP to opt out.` (en inglés, la ocasión empieza con mayúscula si no hay nombre).
- `{flores}` = `flowersPhrase(prefs.flowers[0], prefs.colors[0], locale)`; si es `null`, la pregunta.
- `{enlace}` = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "")}/${locale}/ocasiones/${kind}`.
- Si `smsSegments(body) > 4`, se cambia la frase de gustos por la pregunta; si aún pasa, se envía igual.

Cron (`POST /api/cron/reminders`), en este orden: `d3` (solo con `d3RemindersEnabled()`), después `d7`. Un SMS de fechas por cliente y corrida: se lleva un `Set` de clientes ya escritos. Con `d3`: compra reciente → omitido `recent_order`; cliente ya escrito → omitido `daily_cap`; si no, porcentaje = mayor `percent` de `applicableRewards(card.rewards.available)` con `lookupCustomer(e164(phone), { timeoutMs: 5000 })`, o `null` si falla o la tarjeta está apagada; se envía y se registra `sent`. Con `d7`: cliente ya escrito → `daily_cap`; si no, `renderReminder` como hoy. Un 21610 en cualquiera: `updateCustomer(id, { messagingChannel: "none" })`, `removeTag(id, "sms-marketing")`, `markSmsStopped(id)` y omitido `21610`. El modo de prueba registra `sent`, como hoy. Respuesta: `{ due, sent, failed, skipped, dryRun }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
expect(renderSaleReminder({ customerName: "Andrea Gómez", kind: "birthday", label: "Laura", locale: "es",
  prefs: { flowers: ["hydrangeas"], colors: ["lavender"], avoid: ["strong_scent"] }, rewardPercent: 15 }))
  .toBe("Diva Flowers: Andrea, en 3 días es el cumpleaños de Laura. Le preparamos hortensias en tonos lavanda, sus favoritas. Tienes 15% en tu tarjeta. Pídelo: https://makythedivaflowers.com/es/ocasiones/birthday Responde STOP para cancelar.");
it("sin gustos pregunta", ...);              // contiene "¿Te lo preparamos?"
it("sin premio omite la frase", ...);        // no contiene "%"
it("nunca menciona evitar", ...);            // con avoid ["lilies"] no contiene "lirios"
it("nombre con emoji o enlace se omite", ...); // label "Laura 🎂" y "www.x.com" → "un cumpleaños que guardaste"
it("aniversario en inglés", ...);
it("cabe en 4 segmentos con nombres normales en es y en", ...);
it("si pasa de 4, quita los gustos y sigue enviando", ...); // primer nombre de 60 letras
// date-reminders / cron:
it("d3 omitido por compra reciente", ...);   // fila d3 'skipped' 'recent_order'
it("un solo SMS por cliente al día; va primero d3", ...); // d7 'skipped' 'daily_cap'
it("sin DATE_REMINDER_D3_ENABLED solo sale d7", ...);
it("un d7 ya registrado no impide el d3", ...);
it("d3 no se envía para fechas custom", ...);
it("21610 marca STOP y quita la etiqueta", ...);
it("si la tarjeta falla, sale sin premio", ...);
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/date-sale-message.test.ts tests/unit/date-reminders.test.ts tests/unit/api-cron-reminders.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** el módulo de mensaje, los cambios del registro y el cron.

- [ ] **Step 4: Correr y ver que pasan**

Run: el mismo comando del Step 2
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/date-sale-message.ts lib/date-reminders.ts app/api/cron/reminders/route.ts tests/unit/date-sale-message.test.ts tests/unit/date-reminders.test.ts tests/unit/api-cron-reminders.test.ts
git commit -m "feat(fechas): SMS de venta 3 días antes y registro por etapa"
```

---

### Task 11: Panel de Maky

**Files:**
- Create: `app/api/admin/customers/[id]/dates/[dateId]/preferences/route.ts`
- Create: `lib/date-results.ts`, `components/admin/occasions/DateResults.tsx`
- Modify: `lib/customer-profile.ts` (`dates` pasa a `AccountDate[]` de la Tarea 9, con `prefs`), `components/admin/customers/ImportantDates.tsx` (origen, gustos, evitar, edición), `app/api/admin/orders/[id]/route.ts` (GET agrega `recipientAvoid: AvoidCode[]`), `components/admin/dashboard/OrderDetailDrawer.tsx` ("Evitar: …"), `app/[locale]/admin/occasions/page.tsx` (bloque de resultados con la variable encendida), `messages/{es,en}.json`
- Test: `tests/unit/date-results.test.ts`, `tests/unit/api-admin-date-preferences.test.ts`, `tests/unit/api-admin-order-avoid.test.ts`; ampliar `tests/unit/ImportantDates.test.tsx`

**Interfaces:**
- Consumes: Tareas 3, 4 y 10.
- Produces:
  - `PUT /api/admin/customers/:id/dates/:dateId/preferences`, cuerpo `{ flowers, colors, avoid }`, con la misma autenticación que `app/api/admin/customers/[id]/dates/route.ts`; nunca reclama sellos.
  - `dateResults(now?: Date, days = 90): { customersWithOwnDates: number; withSms: number; stages: Record<ReminderStage, { sent: number; skipped: number; orders: number; revenueCents: number }>; stopsWithin48h: number }`.

Atribución: cada pedido pagado y no cancelado de los últimos `days` días cuenta una sola vez, para la etapa del último registro `sent` de una fecha de ese cliente con `recorded_at` en los 10 días previos. `stopsWithin48h`: clientes con `sms_stopped_at` dentro de las 48 horas siguientes a un `sent` del periodo. `customersWithOwnDates` solo cuenta fechas con `source = 'customer'`; `withSms`, cuántos de ellos tienen la etiqueta. Pantalla: tres cifras y una tabla de dos filas, con la nota "Coincidencia, no causa" (en/es en `messages`).

Perfil: cada fecha muestra "Cliente" o "Panel" según `source`, sus gustos con las etiquetas de `date_prefs.*`, "Evitar: …" y un botón Editar que abre `PreferencePicker`. Pedido: si `findRecipientDate(order.customerId, recipient)` tiene "evitar", el cajón muestra un aviso "Evitar: perfume fuerte" en tono de advertencia junto al destinatario.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it("atribuye al último mensaje dentro de 10 días", ...);   // d7 día 1, d3 día 5, pedido día 6 → d3 { orders: 1, revenueCents: total }
it("no atribuye a los 11 días ni pedidos cancelados", ...);
it("cuenta STOP dentro de 48 horas", ...);                 // STOP a las 30 h → 1; a las 50 h → 0
it("solo cuenta fechas del cliente", ...);                 // un cliente con solo fechas 'admin' no suma
it("el personal edita gustos sin sello", ...);             // PUT → 200, sin fila en loyalty_bonus
it("el pedido trae lo que hay que evitar", ...);           // recipientAvoid ["strong_scent"]
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm test -- tests/unit/date-results.test.ts tests/unit/api-admin-date-preferences.test.ts tests/unit/api-admin-order-avoid.test.ts tests/unit/ImportantDates.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar** ruta, resultados, componentes y textos.

- [ ] **Step 4: Correr y ver que pasan**, más tipos

Run: `npm test -- tests/unit/date-results.test.ts tests/unit/api-admin-date-preferences.test.ts tests/unit/api-admin-order-avoid.test.ts tests/unit/ImportantDates.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/customers/[id]/dates/[dateId]/preferences/route.ts" lib/date-results.ts components/admin/occasions/DateResults.tsx lib/customer-profile.ts components/admin/customers/ImportantDates.tsx "app/api/admin/orders/[id]/route.ts" components/admin/dashboard/OrderDetailDrawer.tsx "app/[locale]/admin/occasions/page.tsx" messages/es.json messages/en.json tests/unit/date-results.test.ts tests/unit/api-admin-date-preferences.test.ts tests/unit/api-admin-order-avoid.test.ts tests/unit/ImportantDates.test.tsx
git commit -m "feat(fechas): gustos y resultados en el panel"
```

---

### Task 12: Encendido y prueba de punta a punta

**Files:**
- Create: `docs/ops/date-rewards.md`
- Modify: `docs/ops/loyalty-card.md` (con `DATE_REWARDS_ENABLED`, el cron de `loyalty-sync` agrega `bonus`), `.env.example` si existe

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Escribir `docs/ops/date-rewards.md`**: las dos variables; los seis requisitos de "Encendido" del diseño, copiados tal cual; despliegue (copia de `diva.sqlite` en `/home/u283940187/domains/makythedivaflowers.com/diva-data/`, primero el programa y comprobar `POST /api/v1/customers/1/bonus` sin clave → 401; luego Diva y comprobar `POST /api/cron/loyalty-sync` sin clave → 401); cómo leer los resultados en `/admin/occasions` a los 90 días.

- [ ] **Step 2: Correr todo**

Run: en el programa `npm test`; en Diva `npm test && npx tsc --noEmit && npm run build`
Expected: todo en verde; el build termina.

- [ ] **Step 3: Probar de punta a punta en local**, contra el programa real corriendo en local con una clave de prueba, como la conexión de la tarjeta, con `DATE_REWARDS_ENABLED=1`, `DATE_REMINDER_D3_ENABLED=1` y Twilio en modo de prueba:
  1. Pedido web pagado con la tarjeta de prueba de Stripe para un destinatario nuevo: la confirmación muestra la pregunta con la fecha de entrega precargada y la línea de premio correcta.
  2. Guardar sin la casilla: aparece en `/account/dates` como del cliente; en el programa la tarjeta suma 1 sello con evento `adjust`, `visits` sin cambio.
  3. Segundo pedido al mismo destinatario: pregunta gustos; elegir flor, color y "evitar": 1 sello más; un tercer intento no suma.
  4. Mover la fecha a 3 días, marcar el permiso en Mis fechas y llamar a `POST /api/cron/reminders`: el log de modo de prueba muestra el `d3` con flores y porcentaje, y `date_reminder_sends` tiene la fila `d3`/`sent`.
  5. El pedido en el panel muestra "Evitar: …" y `/admin/occasions` muestra el bloque de resultados.

- [ ] **Step 4: Commit**

```bash
git add docs/ops/date-rewards.md docs/ops/loyalty-card.md
git commit -m "docs(fechas): encendido de fechas y gustos a cambio de sellos"
```
