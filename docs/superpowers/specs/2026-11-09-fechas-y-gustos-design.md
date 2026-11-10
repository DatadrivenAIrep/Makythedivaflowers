# Fechas y gustos a cambio de sellos

Fecha: 2026-11-09 · Estado: aprobado el 2026-11-09 · Negocio: Diva Flowers (Maky)

## Intención

La tarjeta de fidelización premia las compras. Santiago quiere que también premie lo que el cliente cuenta de sí mismo y de quienes quiere: fechas importantes, flores favoritas y qué evitar. El fin es vender: escribirle al cliente justo antes de una fecha que le importa, con algo que sabemos que le va a gustar.

Para que el cliente lo vea como un servicio, la promesa no es "danos tus datos":

> Guarda las fechas de quienes quieres. Te avisamos antes para que no se te pase, y ganas sellos.

El cliente queda bien con quien quiere y gana premios. La tienda sabe cuándo escribir y qué ofrecer.

## Qué existe hoy

| Pieza | Estado |
|---|---|
| Fechas por cliente (`customer_important_dates`) | Existe. Solo se cargan desde el panel |
| Sugerencias de fechas a partir de pedidos repetidos (`lib/date-suggestions.ts`) | Existe, solo en el panel |
| Gustos (`customer_preferences`: flor, color, lo que no le gusta) | Existe, por comprador y no por persona agasajada |
| SMS 7 días antes (`/api/cron/reminders`) | Existe en el código. **No está confirmado que el cron corra en producción** |
| Consentimiento promocional (etiqueta `sms-marketing`, STOP la quita) | Existe |
| Cuenta del cliente con código por SMS (`/account`) | Existe, hoy solo muestra pedidos |
| Tarjeta de Maky | 10 sellos, 1 por compra, 1 de bienvenida según su página pública el 2026-11-09. Premios: 3 → 15%, 6 → 25%, 10 → 50% |

## Objetivos

- El cliente guarda una fecha en segundos, justo después de comprar.
- Cada persona agasajada acumula fecha, gustos y qué evitar.
- Dos SMS por fecha: un aviso a 7 días y uno de venta a 3 días.
- Maky puede ver si esto produce ventas o molesta a la gente.

## Fuera de alcance

- Ofrecer esto a otros negocios del programa. Primero se prueba con Maky.
- Doble sello por comprar para una fecha guardada.
- Sellos retroactivos por fechas ya cargadas o guardadas sin tarjeta.
- WhatsApp o correo.
- Filtrar la tienda por los gustos guardados. El enlace lleva a la página de la ocasión.
- Grupo de control: con este volumen no daría una lectura confiable. *(Decisión mía)*
- Corregir que las campañas manuales y `lib/promo-rewards.ts` también excluyan a quien solo aceptó promociones. Es un problema que ya existe y va aparte.

## Lo que no puede pasar

- Que alguien gane un premio sin haber comprado nunca.
- Que un cliente reciba SMS promocionales sin haber marcado esa casilla.
- Que el sello dependa de aceptar SMS promocionales.
- Que se le pregunte por una "fecha especial" a quien acaba de enviar flores a un funeral.
- Que se le escriba a la persona agasajada. Los SMS van solo al comprador.
- Que se guarden alergias o datos de salud, o que "evitar" aparezca en un SMS.
- Que estos sellos cuenten como visitas o activen el premio de un referido.
- Que se prometa un premio y no llegue.

## Acordado con Santiago

1. Primero solo Maky.
2. Se premia compartir datos: fechas, flores favoritas y flores a evitar.
3. Mensaje promocional 3 días antes de la fecha, con el objetivo de vender.
4. Se mantiene también el aviso de 7 días.
5. Máximo 2 sellos por datos, en total y para siempre.
6. El descuento del mensaje sale de la tarjeta. No se crean cupones nuevos.
7. La tarjeta de Maky se queda con 1 sello de bienvenida, como muestra hoy.

## Comportamiento

### Regla de sellos

| Cupo | Se gana al | Sellos |
|---|---|---|
| `fecha` | Guardar por primera vez una fecha | 1 |
| `gustos` | Indicar por primera vez flor o color favorito de una persona | 1 |

- Requisitos: tener tarjeta y al menos un pedido pagado y no cancelado en Diva.
- Guardar más fechas sigue siendo posible y útil, pero no da más sellos.
- Borrar una fecha no quita el sello, y volver a crearla no da otro.
- "Evitar" nunca da sello, para no pagar por información sensible.
- Las fechas que carga el personal en el panel no dan sello.

Efecto en la compra en la que se gana cada premio, sin contar referidos:

| Premio | Hoy | Con los 2 sellos |
|---|---|---|
| 15% | 2.ª | 1.ª |
| 25% | 5.ª | 3.ª |
| 50% | 9.ª | 7.ª |

La tabla supone 1 sello de bienvenida, que es lo que muestra hoy la tarjeta, aunque `docs/ops/loyalty-card.md` indicaba dejarlo en 0. Con 0 sería 3.ª, 6.ª y 10.ª hoy, y 2.ª, 4.ª y 8.ª con los dos sellos. El código lee el valor real de la tarjeta en cualquier caso.

**Riesgo aceptado:** si Maky cancela el único pedido de un cliente, los sellos por datos y el premio que hayan generado se quedan. Las cancelaciones son manuales y el costo es bajo. *(Decisión mía)*

### Confirmación de compra

Una tarjeta nueva en `ConfirmationView`, encima de `ReciprocityCard`. **Una sola pregunta por pedido.**

No aparece si: el pedido no está pagado o tiene más de 30 días, no tiene `customerId`, no es web, incluye un producto de condolencias (misma regla de `lib/product-add-ons.ts:40`) o solo de "get-well", incluye una suscripción, ya se respondió o se rechazó en ese pedido, o la función está apagada.

Qué pregunta, según el destinatario del pedido (coincidencia por celular o nombre, igual que en `suggestRecipientDates`):

1. Sin fecha guardada para esa persona → **pide la fecha**.
2. Con fecha guardada y sin gustos → **pide gustos**.
3. Si ya tiene ambas → no aparece.

**Pedir la fecha.** El texto es neutro, porque un pedido puede ser triste aunque el producto no lo diga: "¿Quieres que te recordemos una fecha importante de {nombre}?". Se elige Cumpleaños o Aniversario, y el día y mes. No se ofrece "Otra" al cliente: en estas dos, `label` guarda el nombre de la persona, mientras que en las fechas `custom` del panel guarda la ocasión, y mezclarlas rompe la coincidencia y el aviso. *(Decisión mía)* Viene precargada con la fecha de entrega, salvo que caiga en una temporada (`inHoliday`) o no haya entrega; en ese caso va vacía. Nunca se pide el año. Botones: Guardar y No, gracias.

**Pedir gustos.** Flores y colores favoritos, y flores a evitar, con listas fijas y sin texto libre. Las listas fijas se leen bien en SMS en ambos idiomas y evitan que alguien escriba datos de salud. En "evitar" hay además "perfume fuerte" y "mucho polen". *(Decisión mía)*

**Línea de premio.** Solo promete lo que se puede calcular:

- Tiene tarjeta, y sus sellos más el del pedido si aún no se registró más este sello alcanzan un premio → "Guarda esta fecha y llévate {premio} en tu próxima compra".
- Cupo libre y la tarjeta existe o se está creando con este pedido → "Gana 1 sello".
- Sin tarjeta, cupo usado o programa sin responder → sin línea de premio, solo la promesa del aviso.

La página no espera al programa: la tarjeta carga aparte, con un límite de 3 segundos.

**Protección.** El enlace de confirmación es la prueba de compra. El id del pedido (`do_<tiempo>_<azar>`) no es secuencial, y la ruta añade límite por IP, solo pedidos pagados de los últimos 30 días, y una respuesta por pedido.

### Mis fechas

Pestaña nueva en `/account`, con la sesión existente. Permite ver, agregar y borrar fechas, editar gustos, y activar o quitar el permiso de SMS promocionales. Muestra también las sugerencias de `dateSuggestionsFor`, excluyendo destinatarios de pedidos de condolencias. Máximo 12 fechas por cliente. *(Decisión mía)*

Borrar debe ser inmediato y sin confirmaciones largas, porque una ruptura o una muerte pueden volver dolorosa una fecha.

### Consentimiento para SMS promocionales

**Los avisos de fechas dependen solo del permiso de promociones.** `messaging_channel` sigue siendo el interruptor de los textos de pedido y entrega, y aquí solo cambia en los casos en que ya cambia hoy: STOP y el error 21610 de Twilio. *(Decisión mía)*

- `dueReminders` deja de mirar `messaging_channel`: basta la etiqueta `sms-marketing`, que STOP ya quita. Es un cambio deliberado: quien solo marcó promociones en el checkout empezará a recibir el `d7`, que hoy no le llega aunque lo aceptó.
- Sin la etiqueta y sin STOP, junto a Guardar aparece una casilla **sin marcar**: "Avísame por SMS de esta fecha y envíame ofertas". Se reutiliza la letra pequeña de `consent_fine` e indica que no es condición de compra.
- Con STOP (`customers.sms_stopped_at`) no hay casilla, porque Twilio bloquearía el número. El texto dice: "Para recibir avisos, envía START a nuestro número". La columna se marca con STOP y con el error 21610, y se limpia con START. START no devuelve la etiqueta: para promociones hay que marcar la casilla.
- Sin permiso se guarda la fecha y se gana el sello, pero no habrá aviso. El texto lo dice con claridad.
- Al marcarla se agrega la etiqueta y se registra en `marketing_consent_log` quién, cuándo, desde dónde y qué versión del texto, porque hoy solo queda la etiqueta. *(Decisión mía)*

### Sellos en la tarjeta

**Cambio pequeño en el programa de fidelización.** `POST /customers/:id/stamps` no sirve: suma una visita, y además acredita al referido pendiente. Con él, quien guarda una fecha parecería cliente que volvió, justo la cifra que hay que vigilar. Se agrega:

`POST /api/v1/customers/:id/bonus` con `{ orderId, count?, note? }`, donde `count` va de 1 a 10 y `note` hasta 120 caracteres.

- Se comporta como `L.adjust`: sin visita, sin `last_visit_at`, sin crédito de referido, evento `adjust` con su nota en el historial.
- Gana premios, dispara `reward.earned` con el `orderId` y actualiza Wallet.
- Idempotente por `(business_id, orderId, 'bonus')`. Repetirlo responde 200 con `duplicate: true`.
- El autor es el nombre de la clave. `adjust` hoy escribe "dueño" y no recibe `within` ni `orderId`, así que hay que ampliarlo.
- No se revierte por `/orders/:orderId/reverse`, que solo mira `stamp` y `redeem`.
- Se documenta en `docs/api.md`.

**En Diva.** Tabla `loyalty_bonus` con clave `(customer_id, slot)`, como cola:

- Se intenta al guardar y se reintenta con el cron de `loyalty-sync`, hasta 72 horas. Después queda `failed` y solo se registra en el log.
- `orderId` estable: `diva-dato-<slot>-<id de la tarjeta>`. El tope lo garantiza el programa, aunque el cliente tenga dos registros en Diva.
- Si el teléfono no tiene tarjeta: si hay un `loyalty_sync` pendiente de un pedido suyo, sigue en espera; si no, se borra la fila para que pueda ganar el sello cuando tenga tarjeta y vuelva a guardar algo.
- Nada de esto puede bloquear ni fallar el guardado de la fecha.

### Mensajes

Solo a clientes con la etiqueta `sms-marketing`. El cron diario sigue siendo `/api/cron/reminders`. Si Twilio responde 21610, se hace lo mismo que en `campaign-sender` y además se marca `sms_stopped_at`.

| Mensaje | Cuándo | Para qué fechas | Contenido |
|---|---|---|---|
| `d7` | 7 días antes | Todas | El aviso actual, con el mismo texto |
| `d3` | 3 días antes | Cumpleaños y aniversarios | Ocasión, gustos, premio y enlace |

El `d3` no se envía si el cliente tiene un pedido pagado y no cancelado creado en los últimos 7 días; queda registrado como omitido. *(Decisión mía: cualquier pedido, para no presionar a quien acaba de comprar.)*

Se arma por partes, en el idioma del cliente:

> Diva Flowers: {Nombre}, en 3 días es el cumpleaños de {persona}. [Le preparamos {flores}, sus favoritas.] [Tienes {N}% en tu tarjeta.] Pídelo: {enlace} Responde STOP para cancelar.

> Diva Flowers: {Name}, {person}'s birthday is in 3 days. [We can make {flowers}, their favorites.] [You have {N}% off on your card.] Order: {link} Reply STOP to opt out.

`{flores}` combina flor y color de la lista fija, por ejemplo "hortensias en tonos lavanda" o "lavender hydrangeas".

- **Gustos:** si no hay, se omite la frase y se usa "¿Te lo preparamos?". Nunca se usa "evitar".
- **Premio:** se consulta la tarjeta al enviar y se usa el mayor porcentaje disponible, leído con `lib/loyalty-rewards.ts`. Si falla la consulta o no hay premio, se omite y el mensaje sale igual.
- **Persona:** el nombre solo se usa si son letras y espacios, hasta 40 caracteres; si no, se omite. Evita meter enlaces o textos raros en un SMS.
- **Enlace:** `https://makythedivaflowers.com/{idioma}/ocasiones/{birthday|anniversary}`, sin parámetros y sin datos personales. La medición se hace por cliente y fecha, así que no necesita UTM, y la dirección larga encarece cada mensaje.
- **Tope:** un solo SMS de fechas por cliente al día. Si coinciden varios, va primero el `d3` y los demás quedan omitidos.
- **Largo:** hasta 4 segmentos, medidos con `smsSegments`. Las tildes del español usan la codificación más cara: con nombres normales, los mensajes de prueba dieron 3 o 4 segmentos en español y 2 en inglés. No se escribe sin tildes. Si se pasa de 4, se quita primero la frase de gustos, y un mensaje nunca se deja de enviar por su largo. *(Decisión mía)*
- **Fechas ya cargadas por el personal:** las de cumpleaños y aniversario también reciben el `d3`, porque esos clientes ya aceptaron promociones. Las `custom` solo reciben el `d7`.

El registro `date_reminder_sends` hoy es único por fecha y año, y bloquearía el segundo mensaje. Pasa a incluir la etapa.

### Panel

- **Perfil del cliente:** en cada fecha, origen, gustos y qué evitar. El personal puede editarlos sin generar sellos.
- **Detalle del pedido:** "Evitar: …" cuando el destinatario coincide con una fecha guardada. Sin esto, quien arma el ramo no se entera. *(Decisión mía)*
- **`/admin/occasions`:** bloque de resultados.

### Medición

Últimos 90 días, en `/admin/occasions`:

- Clientes con fechas guardadas por ellos mismos, y cuántos de ellos aceptaron SMS.
- Por etapa: enviados, omitidos, pedidos en los 10 días siguientes e ingresos de esos pedidos.
- STOP recibidos en las 48 horas siguientes a un mensaje.

Un pedido se atribuye al último mensaje del mismo cliente en los 10 días previos. Indica coincidencia, no causa. Los plazos de 7 y 3 días son hipótesis, y se revisan con estas cifras a los 90 días.

## Datos

Migraciones nuevas en Diva, sin tocar datos existentes:

- `customer_important_dates`: columna `source` (`admin` | `customer`), por defecto `admin`.
- `customers`: columna `sms_stopped_at`.
- `date_preferences (date_id, kind, value)` con `kind` en `favorite_flower`, `favorite_color`, `avoid`, y códigos de la lista fija. Los gustos van por fecha, porque el mensaje sale por fecha; una fecha nueva de la misma persona precarga los anteriores. Borrar la fecha los borra.
- `date_prompt_answers (order_id PRIMARY KEY, answer, created_at)`: una respuesta por pedido.
- `loyalty_bonus` (cola de sellos por datos).
- `marketing_consent_log`.
- `date_reminder_sends`: se reconstruye con `stage` (`d7` | `d3`), `status` (`sent` | `skipped`) y `skip_reason`, clave `(date_id, occurrence_date, stage)`. Las filas actuales pasan como `d7` / `sent`. SQLite no permite cambiar una clave primaria, y esta migración corre sobre la base real.

## Encendido

Llega apagado. Sin estas variables, todo sigue igual que hoy:

- `DATE_REWARDS_ENABLED`: la pregunta tras la compra, Mis fechas y los sellos.
- `DATE_REMINDER_D3_ENABLED`: el mensaje de 3 días.

Antes de encender:

1. Tarjeta funcionando en producción, comprobada con una compra real.
2. Cron de `/api/cron/reminders` creado, a diario a las 09:15 de Nueva York (`docs/ops/date-reminders.md`).
3. SMS reales activos. En modo de prueba el aviso se marca como enviado y se pierde.
4. Registro A2P de Twilio que cubra mensajes promocionales.
5. Un abogado revisa la casilla, la política de privacidad (datos de terceros y premio por compartirlos) y las reglas del premio.
6. Maky revisa las listas de flores y colores.

Despliegue: copia del archivo SQLite de Diva antes de publicar; primero el programa y luego Diva; comprobar después de cada uno que el despliegue salió.

## Otros requisitos

- Todo texto nuevo en `messages/es.json` y `messages/en.json`.
- Pruebas: cálculo de la línea de premio, exclusiones de condolencias y temporadas, tope de 2 sellos con reintentos y carreras, cliente sin compras, cada variante del `d3` y su límite de 4 segmentos, omisión por compra reciente, tope diario, migración del registro con filas existentes, consentimiento independiente del sello, los casos de permiso (solo promociones, STOP, START y 21610), y en el programa: sin visita, sin referido, idempotencia y aislamiento entre negocios.
- Se verifica en local de punta a punta contra el programa real, como la conexión de la tarjeta.

## Queda a criterio de quien lo construya

- Reparto en archivos y rutas.
- Diseño visual de la tarjeta y de Mis fechas, siguiendo los componentes actuales.
- Primera versión de las listas fijas, a partir del catálogo.
- Cómo se dibuja el bloque de resultados.
