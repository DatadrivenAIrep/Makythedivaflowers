# Métricas con insights — diseño

**Fecha:** 2026-10-12 · **Rama:** `feat/metrics-insights` · **Estado:** aprobado por el dueño (boceto en el companion visual)

## Objetivo

La sección `/admin/metrics` hoy muestra 5 números sueltos, una línea sin ejes y dos tablas. Debe
responder de un vistazo en el iPad: *¿cómo voy?*, *¿de dónde vienen las ventas?*, *¿cuándo hay
más trabajo?* y *¿a qué clientes/fechas debo atender?* — y decir qué hacer (insights con enlace).

## Decisiones del dueño

- Layout **B**: resumen fijo arriba + pestañas **Ventas · Operación · Clientes**.
- Gráfica principal **A**: ingresos de este año (rosa) vs el mismo período del año anterior (gris),
  con selector **Ingresos | Órdenes**. La gráfica apilada por canal (**C**) va en la pestaña Ventas.

## Pantalla

**Barra de período** (una fila, arriba de todo): `7 días · 30 días · 90 días · Año · Todo`. Todo lo
de abajo se recalcula para ese período. Al recargar, la pantalla conserva el render anterior con
opacidad reducida (sin parpadeo).

**Resumen (siempre visible)**
1. Fila de 5 tarjetas, cada una con valor y delta contra el período anterior de igual duración
   (para *Año*: mismo tramo del año anterior; *Todo*: sin delta):
   ingresos cobrados · órdenes · ticket promedio · clientes nuevos · por cobrar (órdenes con saldo
   pendiente + saldo de cuentas por cobrar; sin delta).
2. Gráfica de ventas (A): eje X por día (7/30 días), semana (90 días) o mes (Año/Todo, máx. 12 meses
   visibles). Línea 2px rosa `#B8345E` + área al 10%; año anterior en gris `#BAB1A2`; etiqueta solo
   en el último punto; crosshair + tooltip con ambos valores. Un solo eje Y.
3. "Lo que hay que saber": 3–5 frases de las reglas de insights (abajo), ordenadas por prioridad,
   cada una con enlace cuando hay acción.

**Pestaña Ventas**
- Ventas por canal (C): columnas por mes/semana apiladas por `orders.source` (web, teléfono,
  WhatsApp, tienda, eventos) con leyenda + participación del período y su cambio en puntos.
- Productos que más facturan: unidades, ingresos y ▲▼ vs período anterior (personalizados agrupados).
- Promos y gift cards: descuentos dados, códigos usados, gift cards emitidas (valor), canjeadas
  (`orders.gift_card_cents`), % de ventas que son funerales.
- Ventas por zona (lo que ya existe).

**Pestaña Operación**
- Mapa de calor día de la semana × franja (mañana/mediodía/tarde/noche) de pedidos con fecha de
  entrega/recogida en el período (por `window_date`/`window_slot`; si hay hora exacta, su franja).
  Escala secuencial de un solo tono (rosa, claro→oscuro); el número va en cada celda.
- Próximos 14 días: barras de pedidos ya agendados por día (excluye cancelados); los días pico
  resaltados.

**Pestaña Clientes**
- Nuevos vs que repiten en el período (barra apilada de 2, con montos).
- Mejores clientes del período (top 10 por ingresos cobrados, enlace al perfil).
- Por recuperar: clientes *en riesgo* según `lib/customer-metrics` (recurrentes sin pedido hace
  90+ días), ordenados por lo que han gastado; enlace a su perfil y a Campañas.
- Fechas importantes que vienen (próximos 14 días, `listUpcomingOccasions`) con "Nuevo pedido"
  prellenado (`?phone=&rphone=&rname=`).

## Insights (reglas, sin IA)

Módulo puro `lib/metrics-insights.ts`: recibe el payload ya calculado y devuelve hasta 5
`{ id, priority, icon, key, params, href? }` (texto vía i18n `admin_metrics.insight_*`). Reglas:

| id | Condición | Ejemplo |
|---|---|---|
| `revenue_trend` | delta de ingresos ≥ +10% o ≤ −10% | "Los ingresos van 18% arriba de los 30 días anteriores." |
| `upcoming_dates` | ≥1 fecha importante en 7 días | "12 fechas importantes en los próximos 7 días." → Clientes |
| `holiday_ahead` | feriado de flores en ≤30 días (San Valentín, Día de las Madres, Halloween, Thanksgiving, Navidad) y hubo ventas esa semana el año pasado | "Halloween en 19 días. El año pasado esa semana vendiste $2,300." |
| `at_risk` | ≥1 cliente en riesgo | "14 clientes que compraban seguido no vuelven hace 90+ días." → Campañas |
| `pending_payments` | ≥1 orden con saldo pendiente | "7 órdenes con pago pendiente ($1,840)." → Libro de órdenes |
| `peak_day` | ≥20 pedidos en el período | "El sábado es tu día más fuerte (31% de los pedidos)." |
| `channel_shift` | un canal cambia ≥5 puntos de participación | "Web subió 6 puntos." |

Prioridad: acción con dinero/fecha cercana primero (pending_payments, upcoming_dates, holiday_ahead,
at_risk), luego tendencia (revenue_trend, channel_shift, peak_day). Si no aplica ninguna: una frase
neutra ("Sin novedades en este período").

## Datos y cálculo

- Ingresos = `amount_paid_cents` (cobrado), igual que hoy; órdenes canceladas fuera de órdenes y
  ticket; reembolsadas fuera de ingresos.
- **Zona horaria de la tienda** (`America/New_York`, `shopDateStr`) para días, semanas, meses y día
  de la semana. Hoy se agrupa por UTC (un pedido de 9 pm cae al día siguiente) — se corrige.
- Período anterior: mismo largo inmediatamente antes; "año pasado" en la gráfica: las mismas fechas
  desplazadas 1 año.
- Una sola consulta de órdenes desde `min(inicio del período anterior, inicio del año pasado)`; todo
  lo demás es cálculo puro en memoria (el volumen de la tienda lo permite).
- Un único endpoint `GET /api/admin/metrics?range=&locale=` devuelve el payload completo (resumen +
  3 pestañas); la página lo renderiza en servidor para la primera carga, como hoy.

## Componentes

- `lib/metrics.ts` → se divide en módulos puros: `lib/metrics/period.ts` (rangos, buckets en hora
  local, período anterior), `sales.ts`, `operations.ts`, `customers.ts`, más
  `lib/metrics-insights.ts`. `lib/metrics-storage.ts` arma el payload.
- UI: `MetricsView` (barra de período, KPIs, gráfica, insights, pestañas) + `KpiCard` (con delta),
  `SalesTrendChart` (A), `ChannelColumns` (C), `Heatmap`, `UpcomingLoad`, `InsightList`, tablas.
  SVG propio, sin librerías nuevas; tooltip por hover y por foco de teclado; cada gráfica tiene su
  tabla accesible (oculta visualmente, disponible para lectores de pantalla).
- Paleta de canales (validada con `validate_palette.js` sobre `#FAF6F0`, todas PASS; el ámbar
  necesita leyenda/tabla): web `#B8345E`, teléfono `#1F78C8`, WhatsApp `#C9850F`,
  tienda `#1E8A5E`, eventos `#7A4FB0` — asignación fija por canal, nunca por ranking.

## Errores y vacíos

- Sin órdenes en el período: tarjetas en $0 / "—" para deltas, gráficas con estado vacío, insights
  con la frase neutra.
- Falla al recargar: se mantiene lo anterior y aparece el aviso actual de error.
- Deltas con base 0: se muestran como "nuevo" en vez de ∞%.

## Pruebas

- Unitarias (vitest) por módulo puro: buckets en hora de Nueva York (incluye el caso 9 pm), período
  anterior/año pasado, deltas con base 0, canales, mapa de calor, próximos 14 días, clientes
  nuevos vs que repiten, cada regla de insight y su prioridad.
- Ruta API con SQLite en memoria; componentes con Testing Library (selector de período, pestañas,
  selector Ingresos/Órdenes, tooltip).
- Verificación en el navegador con datos sembrados y `next build` limpio antes de publicar.

## Fuera de alcance

Exportar a CSV/PDF, metas mensuales, comparación por empleado, datos de tráfico web.
