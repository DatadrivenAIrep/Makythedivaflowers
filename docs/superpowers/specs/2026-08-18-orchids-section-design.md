# Sección de orquídeas — diseño

Fecha: 2026-08-18
Estado: aprobado, pendiente de plan de implementación

## Qué se construye

Una página editorial en `/orchids` que vende phalaenopsis vivas en maceta, más un
producto comprable en la tienda con dos medidas: un tallo a $65 y dos tallos a $85.

El ángulo es "regalo que dura": un ramo de $75 dura entre cinco y siete días; una
orquídea de $65 florece entre ocho y doce semanas. Ese contraste es el argumento
de venta y ocupa su propio bloque en la página.

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Alcance | Página dedicada + productos en la tienda | La orquídea necesita explicación (duración, cuidado) que una ficha de producto no da, y `/orchids` capta búsquedas propias |
| Estructura de producto | Un producto, dos variantes | Sigue la convención del catálogo; las variantes no cambian la foto en este sitio, así que separar por color no aportaría claridad |
| Color | No es opción de compra | Se confirma por disponibilidad; la galería muestra los colores como referencia |
| Disponibilidad | Stock permanente, mismo día | Tag `same-day`, corte a las 2 pm, igual que el resto del catálogo |
| Audiencia | Regalo que dura | Housewarming, gracias, cumpleaños, "porque sí" |
| Enfoque de página | Completo, seis bloques | Hay fotos suficientes para llenarlo, y el bloque de cuidado paga en SEO y en llamadas evitadas |

## Contenido de la página

Seis bloques, en orden:

1. **Hero** — orquídea blanca de un tallo, titular sobre duración, "desde $65",
   botón de compra.
2. **El argumento** — comparación de duración: ramo de $75 → 5-7 días; orquídea
   de $65 → 8-12 semanas de floración.
3. **Las dos medidas** — un tallo $65 y dos tallos $85 lado a lado, con foto
   real, precio y enlace al producto.
4. **Colores** — las cuatro fotos como galería de referencia.
5. **Cuidado en cuatro pasos** — riego, luz, qué hacer cuando caen las flores, y
   qué no hacer (incluye el mito de regar con cubos de hielo).
6. **Entrega y cierre** — corte de las 2 pm, botón de compra y botón de llamar.

El bloque 5 no es relleno: es el contenido indexable para búsquedas de cuidado de
orquídeas, y reduce las llamadas de "se me murió" tres semanas después.

## Arquitectura

Sigue el patrón de `/corsages-boutonnieres`, que es el más limpio del repo: la
página solo compone, cada bloque es un componente con una responsabilidad, y el
texto vive en los mensajes de i18n.

```
app/[locale]/orchids/page.tsx        ~55 líneas, solo compone
components/orchids/OrchidsHero.tsx
components/orchids/OrchidsWhy.tsx        bloque 2
components/orchids/OrchidsSizes.tsx      bloque 3
components/orchids/OrchidsColors.tsx     bloque 4
components/orchids/OrchidsCare.tsx       bloque 5
components/orchids/OrchidsCTA.tsx        bloque 6
data/orchid-care.ts                      los 4 pasos, bilingües
messages/{en,es}.json                    namespace `orchids`
```

Cada componente recibe `locale` y nada más, igual que los de `corsages/` y
`sympathy/`. Ninguno lee productos directamente salvo `OrchidsSizes`, que importa
el producto por slug para no duplicar los precios.

URL `/en/orchids` y `/es/orchids`. El sitio usa slug en inglés para ambos
idiomas (`/es/sympathy`, `/es/corsages-boutonnieres`); esto lo respeta.

## Datos

### Producto nuevo

En `data/products.ts`:

```
id:          "p-pla-orc-01"
slug:        "phalaenopsis-orchid"
category:    "plants"
variants:    "single" → 6500 · "double" → 8500
tags:        ["same-day", "new"]
occasions:   ["just-because", "congrats", "birthday", "get-well"]
colorFamily: ["white", "pink"]
active:      true
```

Los precios son antes de impuesto, como todo el catálogo; el 8.625% se suma en el
checkout.

### Limpieza de los productos falsos

El catálogo ya tiene dos entradas que dicen ser orquídeas y no lo son:
`cattleya-orchid` (precios $75/$115/$155, foto de un arreglo tropical) y
`opal-orchid` (precios $115/$145/$185, foto de un arreglo mixto de rosas). Ambas
están activas, visibles en la tienda y en el feed de Google Merchant.

Tres cambios:

1. Ambos productos pasan a `active: false`. No se borran: `active: false` los
   saca de la tienda, del feed (`buildMerchantFeed` filtra por `p.active`) y del
   sitemap (`isAvailableNow`), pero deja intacto cualquier pedido histórico que
   los referencie.
2. `cattleya-orchid` sale de `EXOTIC_SLUGS` en `lib/shop-categories.ts`, para que
   la categoría "Exotic" no apunte a un producto inactivo.
3. La tarjeta de la categoría `plants` en `lib/shop-categories.ts` usa hoy
   `/products/opal-orchid.jpg` — o sea, el arreglo de rosas. Pasa a la foto real
   de la orquídea blanca.

## Imágenes

Cuatro fotos de origen en HEIC, convertidas a `public/products/` con el pipeline
qlmanage→cwebp (`sips` y `sharp` fallan con HEIC en esta máquina):

| Origen | Destino | Contenido |
|---|---|---|
| IMG_1957.HEIC | `phalaenopsis-white-single.webp` | Blanca, un tallo, maceta cuadrada |
| IMG_1962.heic | `phalaenopsis-pink-single.webp` | Rosa claro, un tallo, maceta acanalada |
| IMG_1959.HEIC | `phalaenopsis-pink-double.webp` | Rosa claro, dos tallos, maceta cuadrada |
| IMG_1968.heic | `phalaenopsis-fuchsia-double.webp` | Fucsia, dos tallos, maceta cilíndrica |

Las cuatro son verticales, fondo negro, encuadre casi idéntico — alinean bien en
una fila sin recorte. Aspecto `4/5` en el producto.

La galería del producto lleva las cuatro; la primera (blanca de un tallo) es la
que va al feed de Google como imagen principal.

## Enlaces

- `components/nav/NavLinks.tsx` — entrada nueva con `t("orchids")`
- `components/nav/MobileDrawer.tsx` — la misma entrada
- `components/nav/Footer.tsx` — en la fila de enlaces secundarios
- `app/sitemap.ts` — `"orchids"` en `STATIC_PATHS`
- `BreadcrumbListLD` dentro de la página, con `alternates.languages` en/es en el
  metadata

## Pruebas

En `tests/unit/`:

- `phalaenopsis-orchid` existe, está activo, y tiene exactamente dos variantes a
  6500 y 8500
- `cattleya-orchid` y `opal-orchid` tienen `active: false`
- Ninguno de los dos aparece en el XML que produce `buildMerchantFeed`
- `cattleya-orchid` no está en `EXOTIC_SLUGS`
- Los cuatro archivos `.webp` existen en `public/products/`
- El namespace `orchids` tiene las mismas claves en `en.json` y `es.json`

Nota: `npm test` completo tiene alrededor de siete fallos que también fallan en
main sin estos cambios (spawn de Chromium y checkout/preview). Verificar contra
la base antes de atribuirlos a este trabajo.

## Fuera de alcance

Estas quedan fuera a propósito. Cada una es defendible, ninguna se pidió:

- Bloque de cuentas comerciales o corporativas con formulario de cotización
- Enlace cruzado desde `/sympathy` ofreciendo la orquídea como alternativa viva
- Destacado en el bento del home (`BentoSignatureTile`)
- Categoría propia "Orquídeas" en la tienda, separada de `plants`
- Elección de color como opción de compra

## Deuda observada, no tocada

`app/sitemap.ts` lista `shop/sympathy` pero no las landings `/sympathy`,
`/corsages-boutonnieres` ni `/mothers-day`. Es un hueco anterior a este trabajo.
Aquí solo se agrega `orchids`; arreglar el resto es una tarea aparte.

## Al desplegar

Purgar el CDN de Hostinger después del deploy. `next.config.ts` fuerza
revalidación en el HTML público, pero el CDN conserva la versión vieja si no se
purga.
