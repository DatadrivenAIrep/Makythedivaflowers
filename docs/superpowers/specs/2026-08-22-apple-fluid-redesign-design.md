# Rediseño fluido estilo Apple — diseño

Fecha: 2026-08-22
Estado: aprobado, pendiente de plan de implementación

## Qué se construye

Un rediseño del **sitio público** de Diva Flowers que hace dos cosas a la vez:

1. **Evoluciona el sistema visual** hacia sobriedad premium ("quiet luxury"),
   conservando el alma de la marca (rouge, Fraunces, el arco, el "living studio").
2. **Eleva la interacción a nivel Apple**: gestos interrumpibles, respuesta
   instantánea, momentum, materiales translúcidos con profundidad y craft de
   precisión.

No es un sitio nuevo. Es un rediseño de las ~25 páginas públicas ya existentes,
conservando toda la funcionalidad (catálogo, checkout Stripe, i18n EN/ES,
leads/CRM, SMS). El método viene de los talleres de diseño de Apple —
principalmente *Designing Fluid Interfaces* (WWDC 2018) — traducido a la web
(CSS, Pointer Events, `requestAnimationFrame`, Framer Motion, que ya está en el
proyecto y se usa en 36 archivos).

La tesis central: el sitio ya se ve bien. Lo que el método Apple aporta es otro
eje — **que se sienta vivo** y **que respire premium por restraint**, no por
adornos.

## Objetivos

Los cuatro, en este orden de peso para resolver empates de diseño:

1. **Marca premium / lujo** — que se sienta artesanal, elegante, memorable.
2. **Diferenciación** — una identidad propia, lejos de la florería genérica.
3. **Conversión** — que más visitas terminen en compra o pedido.
4. **Móvil impecable** — la mayoría del tráfico; gestos, velocidad, fluidez.

## No-objetivos (YAGNI)

- No se toca `/admin` ni ninguna ruta bajo `/api`.
- No se rehace la lógica de negocio: checkout/Stripe, Twilio/SMS, CRM/leads,
  el catálogo de datos (`data/products.ts`), i18n ni las rutas quedan intactos.
- No se cambia el stack (Next 16, React 19, Tailwind v4, Framer Motion, next-intl).
- No es una reinvención radical del look: se conserva la identidad y se refina.
- No se rediseña el contenido/copy salvo microcopy que sirva a la interacción
  (labels, feedback, wayfinding).

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Alcance | Todo el sitio público, por fases | El usuario lo pidió completo; las fases lo hacen entregable y de bajo riesgo |
| Dirección visual | Evolucionar hacia sobriedad + elevar el feel | El look ya es fuerte; la palanca premium es el restraint, no reinventar |
| Estrategia de ejecución | B — Home insignia + fundamentos | Los fundamentos nacen de construir la pieza real; Apple: "un prototipo interactivo vale más que un millón de diseños estáticos" |
| Arquitectura de la home | A — Editorial refinada | Conserva la narrativa y el alma "living studio", baja el ruido, adelanta la tienda |
| Hero | A — Atmósfera refinada | Mantiene el video/drama que diferencian, con restraint Apple encima |
| Dark mode | Se añade | Craft de Apple: color que se adapta a light/dark. Hoy es light-only a propósito |
| Estándar de motion | Resortes por tokens (damping/response) | Interrumpibles y conscientes de velocidad por naturaleza |
| Ruido de marca | Se dosifica, no se elimina | Grain, marquee, framing "consola" y petals pasan a acentos con propósito |

## Los dos sistemas compartidos (fundamentos)

La Fase 1 los hace nacer construyendo la home; luego los heredan todas las
páginas. Viven en tokens y primitivas, no repartidos por componente.

### Sistema visual

Archivos núcleo: `styles/tokens.css` (fuente única de tokens), `app/globals.css`
(mapea tokens al tema de Tailwind vía `@theme inline`).

- **Pase de restraint.** El ruido pasa de ambiente a acento con propósito:
  - Grain (`components/brand/Grain.tsx`): solo en el hero y a menor opacidad,
    no fijo en toda la página.
  - Marquee (`components/brand/KineticMarquee.tsx`): una sola aparición.
  - Framing "consola/dashboard" del Bento (`components/home/BentoGrid.tsx`):
    suavizado — se quita "SYSTEM ACTIVE" como elemento constante.
  - Petals (`components/home/PetalRain.tsx`): reservado a un momento de *delight*
    (éxito al añadir a la bolsa), no de fondo.
- **Color.** Rouge `#B8345E` sigue de ancla, pero se gana su aparición (CTAs y
  acentos clave, no rociado); la rampa neutra cálida (`--color-mute-100..700`)
  hace el trabajo pesado. Se añade **dark mode** con la paleta invertida por
  roles. Contraste AA garantizado en rouge-sobre-bone y texto sobre translúcido.
- **Tipografía (disciplina Apple §15).** Las piezas (Fraunces, Cabinet Grotesk,
  JetBrains Mono) están bien; falta el rigor:
  - **Escala tipográfica como tokens** (display/title/heading/body/label/mono)
    en `rem`/`em`, para respetar el tamaño de texto del usuario.
  - **Tracking por tamaño**, no fijo: negativo en display grande (`~-0.02em`),
    body en `~0`, labels pequeños ligeramente positivo.
  - **Leading inverso al tamaño**: `1.0–1.05` en titulares, `~1.5` en cuerpo.
  - **Optical sizing**: Fraunces es variable (`opsz`) → `font-optical-sizing: auto`.
  - Dosificar el eje `WONK` de Fraunces (menos "quirky", más premium); reservarlo
    a un solo momento firma.
- **Materiales y profundidad (Apple §12) — lo nuevo y central.** Una capa de
  material translúcido para chrome flotante: `TopNav`, `MegaMenu`, cart drawer y
  sheets (`components/ui/Sheet.tsx`), y la barra sticky de "añadir a bolsa" del
  PDP. `backdrop-filter: blur() saturate()` + fondo semitransparente, borde
  superior brillante, sombra según contexto, y **scroll-edge fade** en vez de
  bordes de 1px. El peso del material codifica jerarquía; nunca vidrio sobre
  vidrio.
- **Espacio y radios.** Escala de espaciado base-8 en tokens; se conserva el
  radio arch-top firma (`--radius-arch-top`) pero se sistematiza la escala de
  radios. Aire generoso = premium.

### Sistema de movimiento

Archivos: `components/motion/` (primitivas existentes: `MagneticButton`,
`BloomImage`, `SpotlightField`, `StaggerGroup`), más un nuevo módulo de tokens
de motion (p. ej. `lib/motion.ts`) del que todos tiran.

- **Estándar de resortes.** Modelo de dos parámetros de Apple vía `bounce` +
  `duration` de Framer Motion. Default **`damping 1.0 / response 0.3–0.4`** (sin
  overshoot) para casi todo; bounce (`~0.8`) solo tras un gesto con momentum
  (flick, soltar un drag). `MagneticButton` migra de stiffness/damping 200/18 a
  estos tokens.
- **Interrumpibilidad (principio #1).** Toda transición anima desde el valor
  **presente** y se puede agarrar/revertir a mitad de vuelo. Se auditan cart
  drawer, `MegaMenu`, `MobileDrawer`, sheets, `ImageStack` y PDP; se reemplazan
  transiciones/keyframes CSS gesto-dependientes por resortes.
- **Manipulación directa + handoff de velocidad + proyección de momentum.**
  Superficies arrastrables (cart drawer, menú móvil, galería del PDP, bottom
  sheets): tracking 1:1 con `setPointerCapture` respetando el offset de agarre,
  entrega de la velocidad al soltar al resorte, y proyección exponencial del
  momentum para decidir el snap. Rubber-banding en los bordes.
- **Respuesta / latencia.** Feedback en pointer-**down** (los botones se
  iluminan al instante), sin delay de ~300ms, sin debounces artificiales en la
  ruta de input, feedback continuo *durante* el gesto.
- **Consistencia espacial.** Entrar y salir por el mismo camino; anclar
  popovers/menús/sheets a su disparador (`transform-origin`); espejo del easing
  en reversibles; "materializar, no solo fundir" en vidrio (animar blur + escala
  juntos).
- **Frame-level.** Solo props de compositor (`transform`/`opacity`),
  `will-change` donde el movimiento es inminente; háptica ligera opcional
  (Vibration API) en commits clave, con causalidad/armonía/utilidad.

## Plan por fases

Cada fase recibe su propio plan de implementación detallado (vía la skill
writing-plans). Este documento es el diseño maestro.

### Fase 1 — Home insignia + fundamentos

El corazón. Se construye la home a nivel Apple y, en el camino, se extraen los
dos sistemas de arriba.

1. **Prototipo interactivo primero** (Apple: el prototipo vale más que mil
   diseños estáticos). Un prototipo del hero + una interacción arrastrable
   (cart drawer o galería) para fijar el "feel" antes de generalizar.
2. **Extraer los fundamentos** — tokens visuales y de motion, materiales,
   escala tipográfica, y las primitivas núcleo (`Button`, `Sheet`, `TopNav`).
3. **Arquitectura de la home = dirección A (editorial refinada):**

   | Sección | Tratamiento |
   |---|---|
   | Hero | Dirección A: video + arco autodibujado, gradiente más ligero, barra de vidrio real, tipografía afinada, parallax sutil al scroll |
   | Tienda / categorías | **Subida** para conversión (antes iba más abajo) |
   | Bento estudio | Framing "consola" suavizado |
   | Prueba social | Google + TikTok **fusionados** en una banda |
   | Sympathy | Se queda (momento de cuidado) |
   | Verticales | Weddings + Events **fusionados** en un dúo |
   | Estudio + Newsletter | Historia breve + suscripción, cierre calmo |

   Marquee 1×; petals solo en delight.

### Fase 2 — Embudo de conversión

`shop` → `product/[slug]` (PDP) → `cart` → `checkout`. Aquí el feel Apple paga
directo en conversión.

- **Shop / categoría** (`components/shop/`, `components/product/ProductGrid`,
  `FilterBar`): filtros con respuesta instantánea, entrada escalonada de cards,
  materiales en la barra de filtros sticky.
- **PDP** (`app/[locale]/product/[slug]`, `components/product/ImageStack`,
  `AddToBag`, `PdpConfigurator`): galería con manipulación directa (arrastrar,
  handoff de velocidad, snap), barra sticky de "añadir a bolsa" como material
  translúcido, feedback continuo en variantes.
- **Cart** (`components/cart/`): drawer arrastrable e interrumpible, rubber-band,
  petals de delight al añadir.
- **Checkout** (`components/checkout/CheckoutShell`): craft de conversión —
  feedback inline (no en submit), wayfinding claro, forgiveness (undo), sin
  latencia. Lógica Stripe intacta.

### Fase 3 — Resto del sitio

Landings (`weddings`, `events`, `sympathy`, `orchids`, `corsages-boutonnieres`,
`mothers-day`, `subscriptions`), `story`, `journal`, `contact`, `account`,
`legal`. Aplican el sistema ya probado. La mayoría son composición de bloques
editoriales que heredan tokens, materiales y motion sin lógica nueva. El form kit
(`components/ui/form/`) recibe el tratamiento de respuesta y feedback una vez y
lo heredan contact/inquiry/account.

## Arquitectura (qué se toca)

```
styles/tokens.css              # tokens: color (+ dark), tipografía, espacio, radios, motion
app/globals.css                # @theme inline, base, dark mode, reduced-motion/transparency/contrast
lib/motion.ts                  # NUEVO: tokens de resortes + helpers de handoff/proyección/rubber-band
components/motion/*             # primitivas: migran a los tokens; +useDragSpring, +useMaterialize
components/ui/{Button,Sheet}.tsx  # respuesta on-down; sheet como material + drag interrumpible
components/nav/{TopNav,MegaMenu,MobileDrawer}.tsx  # material translúcido + scroll-edge + anclaje
components/brand/{Grain,KineticMarquee}.tsx        # dosificados (restraint)
components/home/*               # Fase 1: hero A + reordenamiento A + fusiones
components/{product,cart,shop,checkout}/*          # Fase 2
components/{weddings,events,sympathy,orchids,...}/*# Fase 3
```

Patrón a seguir: el más limpio del repo es el de las landings recientes
(`/corsages-boutonnieres`, `/orchids`) — la página solo compone, cada bloque es
un componente con una responsabilidad, el texto vive en i18n. El rediseño lo
respeta.

## Accesibilidad

Se hornea en las primitivas, no se parcha después. Tres señales independientes:

- `prefers-reduced-motion: reduce` → cross-fade en vez de slide/spring, sin
  overshoot (ya parcial en `globals.css`; se completa).
- `prefers-reduced-transparency: reduce` → materiales sólidos/frost (subir
  opacidad, quitar blur).
- `prefers-contrast: more` → fondos casi sólidos + borde definido.

`@axe-core/playwright` ya está en devDeps → se conecta a CI como gate.

## Rendimiento

- Solo `transform`/`opacity` en animación; `will-change` puntual.
- **Hero LCP**: el video no debe degradar el LCP — poster inmediato, `preload`
  medido, y en reduced-motion/`save-data` cae a imagen fija.
- **`backdrop-filter`** tiene costo en móvil de gama baja: limitar el número de
  capas de vidrio simultáneas y medir en dispositivo real.
- Carga de fuentes: Fraunces variable y Cabinet Grotesk local con `font-display`
  y subsetting para no bloquear el render.

## Pruebas

- **Unit** (`vitest`): tokens, helpers de motion (proyección/rubber-band puros),
  lógica de componentes.
- **E2E + a11y** (`playwright` + `axe`): recorridos clave (home, PDP, add-to-bag,
  checkout) y auditoría axe por página.
- **Revisión de motion con ojos frescos**: reproducir en cámara lenta /
  frame-by-frame; verificar interrumpibilidad agarrando cada transición a mitad.
- **Antes/después** en móvil real para premium-feel y 60fps.
- Nota: `npm test` completo tiene ~7 fallos preexistentes (Chromium ENOEXEC +
  checkout/preview) que también fallan en base main — verificar contra base
  antes de culpar a un cambio.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `backdrop-filter` lento en móvil de gama baja | Limitar capas de vidrio, medir en dispositivo, fallback sólido |
| Video del hero perjudica el LCP | Poster inmediato, fallback a imagen, preload medido |
| Retrabajo al generalizar primitivas desde la home | Es esperado en estrategia B; se acota extrayendo tokens temprano |
| Scope creep en 25 páginas | Fases con plan propio; Fase 3 es aplicación, no diseño nuevo |
| Perder la energía "living studio" al bajar el ruido | Dirección A conserva el alma; el ruido se dosifica, no se borra |
| Regresiones en checkout/Stripe/CRM | No se toca la lógica; solo capa visual/interacción, con e2e de guardia |

## Criterios de éxito

- **Feel**: toda transición es interrumpible; feedback en pointer-down; 60fps en
  móvil; sin seam entre arrastrar y animar.
- **Premium**: restraint visible (menos ruido, más aire), materiales con
  profundidad, tipografía con tracking/leading correctos por tamaño.
- **Conversión**: el embudo (home→PDP→cart→checkout) más claro y sin latencia;
  se mide contra el baseline actual.
- **Móvil**: gestos naturales (drag/swipe/sheet), nada que se sienta "de
  computadora".
- **A11y**: axe pasa en CI; reduced-motion/transparency/contrast honrados.

## Fuera de alcance / futuro

- `/admin` y paneles internos (tienen su propio lenguaje de "consola").
- Rediseño de contenido/copy de fondo (más allá de microcopy de interacción).
- Nuevas features de negocio; esto es rediseño, no expansión de alcance.
