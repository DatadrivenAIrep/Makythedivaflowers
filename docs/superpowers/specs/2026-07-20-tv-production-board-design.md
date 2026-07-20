# Tablero de producción en Smart TV — Diva the Flowers

**Fecha:** 2026-07-20
**Estado:** Diseño aprobado (pendiente revisión del spec escrito)
**Autor:** Santiago (con Claude)

---

## 1. Resumen

Una pantalla de **solo lectura, a pantalla completa y siempre encendida**, pensada para proyectarse en un Smart TV dentro del taller de Diva the Flowers. Su fin: que las diseñadoras vean, sin tocar nada, **qué órdenes hay que producir hoy, en qué orden (por hora de entrega) y su estado**, más un resumen de lo que está en ruta y entregado.

Es una **capa de visualización sobre los datos y estados que ya existen** en el sistema. No cambia el modelo de datos, ni cómo se toman/pagan/despachan las órdenes. Cero migraciones de base de datos.

Forma elegida (tras brainstorming visual): **"Cola de producción por hora de entrega"** (arquetipo B), con la **Dirección A · Bone claro** de marca.

---

## 2. Objetivos y no-objetivos

### Objetivos (v1)
- Mostrar la **cola "Por hacer" de hoy** ordenada por cercanía de entrega, con cuenta regresiva.
- Mostrar por cada orden: **foto del producto**, número, destinatario, producto, **canal de origen**, estado, método/zona y avisos (tarjeta, notas de diseño).
- **Alerta sonora** al entrar una **orden nueva ya pagada**.
- Resumen lateral de **En ruta** y **Entregadas hoy**, y una tira de **Mañana**.
- **Actualización en vivo** sin intervención (no se pausa al ocultar la pestaña).
- Legible a 3–4 m: tipografía grande y contrastada.
- **Rotación automática de páginas** cuando hay más órdenes de las que caben.

### No-objetivos (fuera de v1 — YAGNI)
- Carriles/asignación por diseñadora ("quién hace qué"). Hoy no existe ese modelo de datos (`Order.takenBy` es solo "quién tomó la orden en el intake"). → posible **fase 2**.
- Avance **automático** de estados por tiempo. Siguen siendo manuales desde el admin.
- GPS/ETA del domiciliario.
- **Editar** órdenes desde el TV. Es exclusivamente visualización.
- Corregir la inconsistencia de horarios de franja en todo el código (ver §12); el tablero fija su propia fuente única.

---

## 3. Usuarios y contexto

- **Espectadores:** diseñadoras/floristas en el taller (mono-operador hoy, Maky).
- **Idioma:** español (pantalla interna). Ruta por defecto `/es/admin/tv`.
- **Dispositivo:** **mini-PC o laptop conectada por HDMI** al TV, navegador en pantalla completa (kiosco). Es lo más confiable para audio y para dejarlo 24/7.
- **Sesión:** el mini-PC inicia sesión **una vez** en el admin; la cookie dura 30 días y sobrevive reinicios/deploys.

---

## 4. Diseño visual (Dirección A · Bone claro)

Coherente con la identidad (`styles/tokens.css`):

- **Fondo:** bone `#FAF6F0` con un leve degradado petal en la esquina superior.
- **Texto:** ink `#0E0D0C`; secundarios en mute (`#6F685B` / `#968D7E`).
- **Acento:** rouge `#B8345E`; secundario rouge-glow `#D24E78`.
- **Titulares:** Fraunces (serif). **Texto:** Cabinet Grotesk. **Números/mono:** JetBrains Mono.
- **Formas:** esquinas suaves, sombras difusas (`--shadow-diffusion`).
- Tamaños **generosos** para lectura a distancia (mayores que en el admin).

### Estructura (16:9)
```
┌───────────────────────────────────────────────────────────┐
│ HEADER: Diva the Flowers · Producción de hoy   [5·2·8]  🔔  10:15 │
├──────────────────────────────────────────┬────────────────┤
│ POR HACER · ordenadas por entrega  (5)    │  EN RUTA (2)    │
│ ┌───┐ #1048 Ramo "Rouge" · 24 rosas       │  #1046 Roslyn   │
│ │IMG│ Para Emily Carter        1:45  🟠    │  #1047 Great Nk │
│ │   │ 🌐Web ·EnPrep· 🚚GreatNeck ·💌  hoy·mediodía          │
│ └───┘                                     │  ┌──────────┐   │
│ ... (hasta ~6 tarjetas por página)        │  │    8     │   │
│                                           │  │ Entregadas│   │
│                                           │  └──────────┘   │
│                                           │  Últimas: ...   │
├──────────────────────────────────────────┴────────────────┤
│ MAÑANA · 6 órdenes   🌅2  ☀️1  🌇2  🌙1   · ir preparando   │
└───────────────────────────────────────────────────────────┘
```

Mockups aprobados en `.superpowers/brainstorm/.../board-B-brand.html` (Dirección A).

### Tarjeta "Por hacer"
- **Miniatura** del producto (izq., cuadrada). Si la orden no tiene foto (personalizado / "Designer's Choice") → recuadro punteado "sin foto".
- **Línea 1:** `#<orderNumber>` + nombre del producto (elipsis si es largo).
- **Línea 2:** "Para **<destinatario>**".
- **Meta (chips):** canal de origen (color propio) · estado · método+zona · avisos (💌 con tarjeta, 📝 notas de diseño).
- **Cuenta regresiva** (der., grande) al inicio de la franja + etiqueta "hoy · <franja>". Color por urgencia; borde izquierdo del mismo color.

### Canales de origen (`OrderSource`)
| source | icono | etiqueta | color |
|---|---|---|---|
| `web` | 🌐 | Web | rouge |
| `phone` | 📞 | Teléfono | azul |
| `whatsapp` | 💬 | WhatsApp | verde |
| `walk-in` | 🏬 | En tienda | marrón |
| `event` | 🎀 | Evento | morado |

### Urgencia (cuenta regresiva)
- 🔴 **Rojo:** faltan ≤ 60 min **o** vencida.
- 🟠 **Ámbar:** ≤ 180 min.
- 🟢 **Verde:** > 180 min.
- Vencida: muestra "Vencida" (o cuenta en negativo) en rojo.
- (Umbrales configurables: `URGENCY_RED_MIN=60`, `URGENCY_AMBER_MIN=180`.)

---

## 5. Franjas horarias (fuente única del tablero)

Confirmadas con el negocio. El tablero define **una sola** constante de inicio de franja (zona horaria de la tienda, **America/New_York**):

| Franja | `slot` | Inicio | Label ES |
|---|---|---|---|
| Mañana | `morning` | 09:00 | Mañana |
| Mediodía | `midday` | 12:00 | Mediodía |
| Tarde | `afternoon` | 15:00 | Tarde |
| Noche | `evening` | 18:00 | Noche |

- Etiquetas ES reusadas de i18n `slot.*` (`messages/es.json`).
- **Cuenta regresiva** = `inicio_de_franja_hoy(slot) − ahora`, calculado en zona horaria de la tienda.
- ⚠️ El código actual define estos rangos de forma **inconsistente** en 4 lugares (`lib/format.ts`, `lib/order-dispatch.ts`, dos bloques de `messages/*.json`). El tablero **no** los usa; fija su propia constante `SLOT_START`. Consolidar el resto queda como deuda (ver §12).

---

## 6. Arquitectura

Tres piezas nuevas + reuso de lo existente.

### 6.1 Ruta / kiosco (Server Components)
- `app/[locale]/admin/tv/layout.tsx` — layout **de pantalla completa** propio (sin `DashboardShell`, sin menú admin). Contiene la **compuerta de auth**:
  ```ts
  import { cookies } from "next/headers";
  import { redirect } from "next/navigation";
  import { verifySession, SESSION_COOKIE } from "@/lib/admin-auth";
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!verifySession(token)) redirect(`/${locale}/admin/login?next=/${locale}/admin/tv`);
  ```
- `app/[locale]/admin/tv/page.tsx` — Server Component que hace `setRequestLocale(locale)` y renderiza el Client Component `<TvBoard/>`.
  > ⚠️ Consultar `node_modules/next/dist/docs/` (Next 16.2.4) para el patrón exacto de `params: Promise<{locale}>`, `setRequestLocale`, etc. (ver `AGENTS.md`).

### 6.2 Endpoint de datos del tablero (nuevo)
`GET /api/admin/tv/board` — Node runtime, `dynamic="force-dynamic"`. Protegido con `requireAdmin(req)` (de `lib/admin-auth.ts`). Devuelve **todo** lo que el tablero necesita, ya calculado en el servidor:

```ts
type TvBoardResponse = {
  generatedAt: string;              // ISO
  shopDate: string;                 // YYYY-MM-DD en tz tienda
  todo: TvCard[];                   // ordenadas por inicio de franja, luego zona
  enRuta: { orderId: string; orderNumber?: number; zoneLabel: string | null; since: string }[];
  deliveredToday: number;
  tomorrow: { bySlot: Record<DeliverySlot, number>; total: number };
  paidEvents: { orderId: string; at: string; recipientName: string }[]; // eventos 'paid' recientes (~10 min)
};

type TvCard = {
  orderId: string;
  orderNumber?: number;
  recipientName: string;
  productLabel: string;             // primer producto (+ "+N" si hay más líneas)
  extraCount: number;
  thumb: string | null;             // firstThumb(order); null → placeholder
  source: OrderSource;
  fulfillmentStatus: "pending" | "preparing";
  method: "delivery" | "pickup" | "in-store";
  zoneLabel: string | null;
  slot: DeliverySlot | null;        // in-store no tiene ventana
  windowDate: string | null;
  hasCardMessage: boolean;
  hasDesignerNotes: boolean;
};
```

Lógica (nuevo módulo `lib/tv-board.ts`, `buildTvBoard(now)`):
- **`todo`** = órdenes con `paymentStatus === "paid"` **y** `status ∈ {pending, preparing}` **y**:
  - método `delivery`/`pickup` con `window.date === shopToday`, **o**
  - método `in-store` creada hoy (sin ventana).
  - Excluye `delivered`, `out-for-delivery`, `failed`, `canceled`, y no pagadas.
- **Orden:** clave primaria = inicio de franja (`SLOT_START[slot]`); secundaria = `deliveryZoneRank` (deliveries primero, reusando `lib/delivery-zones.ts` como el run-sheet); in-store/pickup sin zona al final de su franja, por `createdAt`.
- **`enRuta`** = `status === "out-for-delivery"`.
- **`deliveredToday`** = count `status === "delivered"` con ventana/entrega hoy (tz tienda).
- **`tomorrow`** = conteo por slot de las órdenes con ventana mañana.
- **`paidEvents`** = del feed existente (`lib/order-feed.ts`, `kind === "paid"`) en los últimos ~10 min.
- Imágenes: `firstThumb(order)` + `resolveOrderLines(order).length` (de `components/admin/dashboard/product-lookup.ts`).
- Acceso a datos vía capa de storage; se recomienda una consulta acotada (paid + estado + ventana entre hoy y mañana) en `lib/order-storage.ts` en vez de cargar todo con `listOrders`.

> Nota de correctitud: usar **tz de la tienda (America/New_York)** para "hoy" y para los inicios de franja. El `run-sheet` actual usa UTC (`toISOString().slice(0,10)`), lo que es un bug latente tras las 8pm ET; el tablero **no** hereda eso.

### 6.3 Cliente del tablero (Client Component)
`components/admin/tv/TvBoard.tsx` (+ subcomponentes: `TvCardRow`, `TvRail`, `TvTomorrow`, `SoundGate`, `Countdown`).
- Hook nuevo `useTvPolling` (adaptado de `useDashboardPolling.ts`):
  - Intervalo `POLL_INTERVAL_MS = 15000`.
  - `fetch("/api/admin/tv/board", { cache: "no-store" })`.
  - **No se pausa** al ocultar la pestaña (se elimina el listener `visibilitychange`).
  - En error de red: conserva el último dato bueno y marca un indicador sutil "reconectando…".
- **Cuenta regresiva:** se recalcula en cliente cada segundo desde `slot` + `SLOT_START` + `shopDate` (no depende del poll).

---

## 7. Alerta sonora (orden nueva pagada)

- **Detección:** al recibir la respuesta del board, se comparan los `paidEvents` con un conjunto **visto** (`Set<orderId>` en `sessionStorage`, reiniciado por día). Tras el **primer poll de cebado** (para no sonar con el histórico), cualquier `paidEvent` nuevo:
  1. reproduce el **chime** (`public/sounds/new-order.mp3`, ~1–2 s, campana suave),
  2. marca la tarjeta correspondiente como **NUEVA** (brillo rouge) durante `NEW_FLASH_MS = 30000`,
  3. si la tarjeta está en otra página, la rotación salta a esa página.
- **Desbloqueo de audio (política de autoplay):** al montar, si el audio no está desbloqueado en esta sesión, se muestra un **overlay "Toca para activar sonido"**. El primer gesto desbloquea el `Audio`/`AudioContext` y se guarda `unlocked` en `sessionStorage`. Indicador permanente en el header: `🔔 Sonido activo` / si falla, `🔕 Toca para activar`.
- Un solo gesto por mañana basta mientras la pestaña no se recargue.

---

## 8. Desborde y rotación de páginas

- La columna "Por hacer" pagina en bloques de `PAGE_SIZE = 6`.
- Auto-avanza cada `PAGE_ROTATE_MS = 12000`, en carrusel; header, rail y tira de Mañana quedan **fijos**.
- Indicador de página (puntos o "2/3").
- Al llegar una orden **NUEVA**, salta a su página y reinicia el temporizador de rotación.
- Si `todo.length <= PAGE_SIZE`, no rota.

---

## 9. Mapeo de estados

| `FulfillmentStatus` | Dónde aparece | Chip |
|---|---|---|
| `pending` | Cola "Por hacer" | "Por empezar" (lilac) |
| `preparing` | Cola "Por hacer" | "● En preparación" (petal) |
| `out-for-delivery` | Panel "En ruta" | — |
| `delivered` | Contador "Entregadas hoy" | — |
| `failed` / `canceled` | Excluidas del tablero | — |

Pago: solo entran a "Por hacer" las `paid`. (Las no pagadas son gestión del admin, no producción.)

---

## 10. Constantes de configuración

```
SHOP_TZ            = "America/New_York"
POLL_INTERVAL_MS   = 15000
PAGE_SIZE          = 6
PAGE_ROTATE_MS     = 12000
NEW_FLASH_MS       = 30000
URGENCY_RED_MIN    = 60
URGENCY_AMBER_MIN  = 180
SLOT_START         = { morning:"09:00", midday:"12:00", afternoon:"15:00", evening:"18:00" }
```

---

## 11. Manejo de errores y casos borde

- **Fallo de fetch:** conservar último dato bueno + indicador "reconectando…". Nunca pantalla en blanco.
- **Sin órdenes hoy:** estado vacío amable ("Sin órdenes por producir 🌿"), con En ruta/Entregadas/Mañana igualmente visibles.
- **Orden sin `orderNumber`** (órdenes antiguas): mostrar id corto como respaldo.
- **Producto sin imagen / producto borrado del catálogo:** placeholder "sin foto".
- **Orden multi-línea:** foto de la primera línea + "+N".
- **Ventana en zona horaria:** todo cálculo de "hoy"/"mañana"/cuenta regresiva en `SHOP_TZ`.
- **Audio bloqueado:** el tablero sigue funcionando visualmente; el badge invita a reactivar sonido.
- **Reloj:** hora del cliente (mini-PC); asumir que está sincronizado.

---

## 12. Deuda / seguimiento (fuera de alcance, documentado)

1. **Horarios de franja inconsistentes** en `lib/format.ts`, `lib/order-dispatch.ts`, `messages/en.json` y `messages/es.json` (2 bloques c/u). El tablero fija `SLOT_START` propio; recomendado consolidar todo a una sola fuente después.
2. **Páginas del `/admin` sin compuerta de auth** (solo ~4/37 rutas API verifican sesión; no hay `middleware.ts`). **Ya creado como tarea aparte.** El TV **sí** añade su propia compuerta.
3. **`run-sheet` usa UTC** para "hoy" en vez de tz de la tienda (bug latente nocturno). El TV usa tz tienda.
4. **Asignación por diseñadora** (fase 2): requeriría un modelo de asignee nuevo.
5. **Estados no auto-avanzan**: el tablero refleja lo que el admin mueve.

---

## 13. Pruebas

**Unitarias (`lib/tv-board.ts`):**
- Filtro "Por hacer": incluye paid+pending/preparing con ventana hoy; excluye no-pagadas, delivered, out-for-delivery, canceled, y de otros días.
- Orden: por inicio de franja, luego rank de zona; pickup/in-store al final de su franja.
- Cuenta regresiva/urgencia: bucketing rojo/ámbar/verde y "vencida" en fronteras (60, 180 min; vencida).
- `deliveredToday` y `tomorrow.bySlot` correctos en tz tienda (incluye caso de cruce de medianoche UTC/ET).
- Imagen: catálogo → `thumb`; custom → `null`; multi-línea → `extraCount`.

**Componente (`TvBoard`):**
- Detección de "nueva pagada": no suena en el poll de cebado; suena con un `paidEvent` nuevo; no repite el mismo `orderId`.
- Rotación de páginas: avanza; salta a la página de la orden NUEVA.
- Estado sin datos / error: conserva último dato bueno.

Framework/patrón según `tests/unit` existente.

---

## 14. Resumen de archivos

**Nuevos**
- `app/[locale]/admin/tv/layout.tsx` (auth + full-screen)
- `app/[locale]/admin/tv/page.tsx`
- `app/api/admin/tv/board/route.ts`
- `lib/tv-board.ts`
- `components/admin/tv/TvBoard.tsx` (+ subcomponentes) y `useTvPolling.ts`
- `public/sounds/new-order.mp3`
- Claves i18n `tv.*` en `messages/{en,es}.json`
- Tests en `tests/unit`

**Reusados (sin cambios)**
- `lib/admin-auth.ts` (`verifySession`, `SESSION_COOKIE`, `requireAdmin`)
- `components/admin/dashboard/product-lookup.ts` (`firstThumb`, `resolveOrderLines`)
- `lib/order-feed.ts` (eventos `paid`), `lib/order-storage.ts`, `lib/delivery-zones.ts`
- `styles/tokens.css`, fuentes, `messages/*` (`slot.*`)

**Posible cambio menor**
- `lib/order-storage.ts`: agregar consulta acotada para el board (recomendado por rendimiento).
