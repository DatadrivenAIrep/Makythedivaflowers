# Fechas sacadas de las tarjetas

Fecha: 2026-11-10 · Estado: aprobado el 2026-11-10 · Negocio: Diva Flowers (Maky)

## Intención

Los clientes ya nos cuentan cuándo cumplen años las personas que quieren: lo escriben en la tarjeta del arreglo. Este paso saca de esas tarjetas los cumpleaños y aniversarios y los guarda en el perfil del cliente que compró. Con eso, el paso siguiente podrá escribirle antes de la fecha para venderle otro arreglo.

Santiago lo pidió así: primero sacar la información y guardarla en los clientes; el marketing viene después y no forma parte de este documento.

Lo que hay hoy, según una copia de la base real del 2026-11-09 (453 pedidos, de mayo a noviembre de 2026):

| Dato | Cifra |
|---|---|
| Pedidos con mensaje de tarjeta | 316 |
| Tarjetas de cumpleaños | 122, de 96 clientes |
| Tarjetas de aniversario | 27, de 20 clientes |
| Fechas guardadas en el sistema | 2 |
| Cumpleaños pedidos en tienda o por teléfono | 94 de 122 |
| Entregas el mismo día del pedido o 1–2 días después | 117 de 122 |

Por qué hace falta aunque ya exista el diseño de "Fechas y gustos" (`2026-11-09-fechas-y-gustos-design.md`): esa pregunta solo sale en la confirmación de compra de la web, y la mayoría de estas tarjetas son de pedidos de tienda. Y el detector actual de `lib/date-suggestions.ts` necesita pedidos para la misma persona en dos años distintos, así que no puede encontrar nada antes de mayo de 2027.

## Objetivos

- Una pasada por el historial deja guardada, en el cliente que compró, cada fecha de cumpleaños o aniversario que se pueda leer con claridad en una tarjeta.
- Los pedidos nuevos se leen solos, sin que nadie apriete un botón.
- Cada fecha guarda: ocasión, día y mes, nombre y teléfono del destinatario, el parentesco cuando la tarjeta lo dice, el año cuando la tarjeta dice la edad o los años, y de qué pedido salió.
- Quien atiende ve de dónde salió cada fecha y la borra con un toque si está mal.

## Fuera de alcance

- Enviar mensajes de cualquier tipo. Es el paso siguiente.
- Sellos de fidelización. Estas fechas no las dio el cliente, así que no dan sello.
- Ocasiones que no se repiten cada año: que te mejores, bebé nuevo, gracias, graduación, condolencias.
- Leer gustos (flores, colores) de las tarjetas.
- Fechas de tipo `custom`.
- Usar IA o cualquier servicio externo. Las palabras clave ya separan bien los casos, y los mensajes de las tarjetas no deben salir del servidor. *(Decisión mía)*

## Lo que no puede pasar

- **Que una fecha sacada de una tarjeta dispare un SMS en este paso.** Hoy `/api/cron/reminders` (`lib/date-reminders.ts`, `dueReminders`) le escribe 7 días antes a cualquier fecha guardada de un cliente con la etiqueta `sms-marketing`. No está confirmado si ese cron corre en producción, pero si corre, guardar unas 110 fechas empezaría a mandar avisos solos. Las fechas con origen `card` quedan fuera de `dueReminders` hasta que el paso de marketing decida cómo usarlas.
- Guardar una fecha de un pedido de funeral o de un "feliz cumpleaños en el cielo".
- Que una fecha borrada o descartada vuelva a aparecer cuando se repita la búsqueda.
- Guardar dos veces la misma ocasión de la misma persona.
- Que el texto de una tarjeta salga del servidor o quede escrito en los logs.
- Que guardar un pedido falle o se demore por esto.
- Que una tarjeta real de un cliente termine copiada en el repositorio (por ejemplo, en una prueba). El repositorio está en GitHub.

## Comportamiento

### Qué pedidos se leen

Un pedido se lee si tiene mensaje de tarjeta, tiene `customer_id` y no está cancelado (`canceled`) ni fallido (`failed`).

- **El pago no importa.** En la copia hay 64 pedidos de tienda con el pago todavía en "pendiente", y siguen siendo pedidos reales. Los pedidos web sin pagar no tienen cliente vinculado, así que no entran por la regla anterior.
- **Se excluye** el pedido marcado `funeral`, el que lleva un producto de condolencias (la misma regla `isSympathy` de `lib/product-add-ons.ts`) y la tarjeta con palabras de recuerdo: heaven, "en el cielo" o "desde el cielo", rest in peace, RIP, descanse, en paz, in memory, en memoria, condolencias, sympathy, pésame. "Cielo" sola no cuenta, porque "mi cielo" es un apodo cariñoso. *(Ajuste del plan)*
- **Pedidos sin cliente vinculado:** se leen cuando se vinculan con "Ligar pedidos" (`lib/backfill-customers.ts`). En la copia hay 20 tarjetas de cumpleaños en esa situación.

### Cómo se reconoce la ocasión

Se compara en minúsculas y sin tildes, en español y en inglés:

| Ocasión | Palabras |
|---|---|
| Cumpleaños | birthday, b-day, bday, cumple, cumpleaños |
| Aniversario | anniversary, aniversario |

- Con palabras de una sola ocasión → **se guarda sola**.
- Solo un número sin la palabra ("happy 25th", "felices 50"), o palabras de las dos ocasiones → **va a revisión**.

Con estas reglas, la copia da 92 cumpleaños y 21 aniversarios que se guardan solos, 5 a revisión, 2 duplicados, 2 excluidos por ser de recuerdo, 5 por pedido cancelado y 20 que esperan vincularse. *(Decisión mía: las claras se guardan solas y las dudosas se revisan. Se le preguntó a Santiago y no se definió.)*

### Qué se guarda en cada fecha

En `customer_important_dates`, del cliente que compró:

- **`kind`:** `birthday` o `anniversary`.
- **Día y mes:** la fecha de entrega o recogida (`window_date`). Si no hay, el día en que se creó el pedido, en hora de Nueva York. La tabla de arriba muestra que la entrega casi siempre cae a 0–2 días del pedido. Para un aviso con días de anticipación, esa diferencia no importa.
- **`label`:** el nombre del destinatario del pedido, igual que guardan hoy las sugerencias del panel.
- **`recipient_phone`:** los últimos 10 dígitos del teléfono del destinatario, si lo hay.
- **Cuando el destinatario es el mismo comprador.** En tienda y en recogida, el panel suele llenar el destinatario con los datos del comprador; `lib/recipient-history.ts` ya trata esos pedidos aparte (`isSelf`). En la copia pasa en 29 de 116 tarjetas. *(Decisión mía)*
  - Mismo teléfono, pero otro nombre (20): el nombre es de la persona agasajada y el teléfono es del comprador. Se guarda el nombre y no el teléfono.
  - Mismo nombre (9): la tarjeta no dice para quién es. Si trae parentesco (2), se guarda sin nombre y con el parentesco ("Cumpleaños · su mamá"). Si no, va a revisión, donde el personal puede escribir el nombre.
- **`relationship`** (columna nueva): un código de una lista fija, solo cuando la tarjeta lo dice con una palabra explícita, por ejemplo "Happy birthday Mom", "Feliz cumpleaños mamá" o "To my wife". La lista: madre, padre, esposa, esposo, hija, hijo, hermana, hermano, abuela, abuelo, tía, tío, novia, novio. Las palabras ambiguas como "amor", "baby", "babe" o "my love" no cuentan: "baby" puede ser un hijo. En la copia, 26 fechas traen parentesco.
- **`year`:** cuando la tarjeta dice la edad o los años ("happy 50th", "felices 50", "50 years", "25th anniversary"), se guarda el año de nacimiento o de la boda: el año de la entrega menos ese número. Solo cuenta un número entre 1 y 110 para cumpleaños, y entre 1 y 80 para aniversarios. En la copia hay 11.
- **`source`:** `card`. Las fechas que ya existen quedan con `admin`.
- **`source_order_id`** (columna nueva): el pedido del que salió.

### Relación con "Fechas y gustos"

Ese diseño ya está construido en la rama `feat/fechas-y-gustos` (16 commits, sin fusionar el 2026-11-10). Su migración `042_date_rewards.sql` ya agrega `customer_important_dates.source` (`admin` | `customer`), reescribe `dueReminders` con una segunda etapa a 3 días y crea la página del cliente "Mis fechas" (`/account/dates`), con un tope de 12 fechas por cliente.

- **Las fechas de tarjeta quedan fuera de todas las etapas de aviso**, la de 7 días y la de 3 días.
- **No cuentan para el tope de 12.** Si contaran, una cuenta corporativa con muchas tarjetas de cumpleaños no podría agregar sus propias fechas. *(Decisión mía)*
- **Para la pregunta después de la compra cuentan como fecha guardada.** Si la persona ya tiene una fecha de tarjeta, la pregunta pasa directo a los gustos, que siguen dando su sello. *(Decisión mía)*
- **El cliente las ve en "Mis fechas".** *(Decisión de Santiago)*
  - Aparecen con una nota de dónde salieron, por ejemplo "De tu pedido del 12 de nov.". No se muestra el texto de la tarjeta.
  - El cliente puede borrarlas como cualquier otra fecha, y no vuelven porque el pedido ya se leyó.
  - Puede agregarles gustos, que dan su sello igual que en cualquier fecha.
  - No hay botón de "confirmar", y tener una de estas fechas no da sello. *(Decisión mía)*
  - Se ven solo cuando "Mis fechas" esté encendida (`DATE_REWARDS_ENABLED`). La revisión de la política de privacidad que pide ese diseño antes de encender tiene que cubrir también las fechas leídas de las tarjetas.
- **Se construye encima de `feat/fechas-y-gustos`**, y se publica después de que esa rama llegue a main. Así hay una sola migración que crea `source`, y una sola versión de `dueReminders`, `addImportantDate` e `ImportantDates.tsx` que cambiar. *(Decisión mía: Santiago no la contestó y puede cambiarla.)*

### Duplicados

- Si el cliente ya tiene una fecha de la misma ocasión para la misma persona, sea cual sea el día, no se crea otra. Una persona tiene un solo cumpleaños, y así lo resuelve ya "Recordar esta fecha" en la toma de pedidos (`rememberRecipientDate`). *(Ajuste del plan: antes decía "a 7 días o menos".)* Es la misma persona si coincide el teléfono, o el nombre cuando no hay teléfono, con la misma regla de `suggestRecipientDates`. Si no hay ni nombre ni teléfono, se compara el parentesco. Esto incluye las fechas cargadas por el personal.
- Si la misma persona recibió flores de cumpleaños en dos pedidos, se queda la fecha que ya existe.
- Personas distintas del mismo cliente tienen fechas distintas, sin tope. Una cuenta corporativa puede mandar muchos cumpleaños, y todos sirven.

### Una sola lectura por pedido

Cada pedido se lee una vez, y el resultado queda en una tabla nueva, `card_date_scans`, una fila por pedido con: resultado (`saved`, `review`, `duplicate`, `excluded` o `none`), la fecha creada si la hubo, y cuándo se leyó.

- Si alguien borra una fecha, el pedido no se vuelve a leer, así que la fecha no vuelve.
- Si alguien edita la tarjeta después de la lectura, no se vuelve a leer. Es raro, y releer haría que vuelvan fechas borradas. *(Decisión mía)*
- Si el pedido se cancela después de leerlo, la fecha se queda: el cumpleaños sigue siendo cierto. *(Decisión mía)*

### Pedidos nuevos

Un pedido nuevo con tarjeta y cliente vinculado se lee solo: al guardarlo desde el panel, al pagarse en la web (`lib/on-web-order-paid.ts`) y al vincularse con "Ligar pedidos". Cualquier error se registra y no afecta al pedido. Quien construya elige dónde engancharlo, siempre que la fecha ya esté guardada cuando alguien abra el cliente o la página de Ocasiones.

### Historial

Un botón en `/admin/occasions`, con el mismo patrón que "Ligar pedidos" (`app/api/admin/customers/backfill/route.ts`):

- Antes de correr muestra cuántos pedidos falta leer, cuántas fechas se guardarían, cuántas irían a revisión y cuántos pedidos esperan vincularse. En este último caso sugiere correr primero "Ligar pedidos".
- Correrlo dos veces no hace nada nuevo, porque cada pedido se lee una sola vez.
- No envía nada.

### Revisión

En `/admin/occasions`, una lista "Por revisar" con los pedidos que quedaron en `review`. Cada uno muestra el mensaje de la tarjeta, el destinatario, el cliente y la fecha, con tres botones: Cumpleaños, Aniversario y Descartar. El personal ya ve estos mensajes en el pedido, así que mostrarlos aquí no expone nada nuevo.

### Panel

- **Perfil del cliente** (`components/admin/customers/ImportantDates.tsx`): junto a cada fecha de tarjeta, "De la tarjeta · pedido #1234" con enlace al pedido, el parentesco y la edad que cumple ese año si hay `year`. Borrar ya existe.
- **Próximas ocasiones** (`/admin/occasions`): las fechas de tarjeta aparecen como las demás. Mostrarlas no envía nada, y le sirven a Maky para llamar o escribir a mano.
- **Sugerencias por patrón** (`suggestRecipientDates`): no cambian. Ya omiten a quien tiene una fecha guardada cerca, así que no duplican.

## Datos

Migraciones nuevas, que no tocan datos existentes. **Tienen que poder correr dos veces en paralelo:** `next build` corre las migraciones desde varios procesos a la vez, y en SQLite un `ALTER TABLE ADD COLUMN` sin comprobar antes ya rompió un despliegue.

- `customer_important_dates`: `source_order_id TEXT` y `relationship TEXT`. La columna `source` ya la crea la migración `042` de `feat/fechas-y-gustos`; aquí solo se usa el valor nuevo `card`. Esta migración no puede volver a crear `source`, porque agregar la columna dos veces rompe la compilación del despliegue.
- `card_date_scans (order_id PRIMARY KEY, outcome, date_id, scanned_at)`.
- La lista de revisión sale de `card_date_scans` con resultado `review`; lo demás se lee del pedido al mostrarla.

## Comprobación antes de publicar

1. Correr la pasada del historial en local sobre una copia de la base real (la del 2026-11-09 está en `~/Downloads/diva.sqlite`; trabajar sobre una copia, nunca sobre ese archivo) y comparar con las cifras de este documento. Con las palabras definitivas pueden variar un poco.
2. Revisar a ojo las fechas que se guardarían, con una muestra de al menos 30, y todas las de revisión.
3. Construir con una base vacía (`rm data/diva.sqlite*` y después `next build`) para probar las migraciones.
4. Copia del archivo SQLite de producción antes de publicar. Publicar es hacer `git push`, que despliega solo.
5. En producción, correr el botón y comprobar que `dueReminders` no devuelve ninguna fecha `card`.

## Otros requisitos

- Todo texto nuevo, en `messages/es.json` y `messages/en.json`.
- Pruebas con mensajes inventados, nunca con tarjetas reales. Deben cubrir: cada palabra y su variante sin tilde, las exclusiones (funeral, condolencias, recuerdo, cancelado), un número sin palabra a revisión, las dos ocasiones juntas a revisión, parentesco y palabras ambiguas, edad y año fuera de rango, duplicados contra fechas del personal y entre pedidos, una sola lectura aunque se borre la fecha, y que `dueReminders` ignore las fechas `card`.
- Los logs llevan solo cifras e ids de pedido, nunca el texto de la tarjeta ni nombres.

## Queda a criterio de quien lo construya

- Reparto en archivos y rutas, y dónde se engancha la lectura de pedidos nuevos.
- La lista exacta de palabras, dentro de las reglas de arriba.
- Diseño visual del botón, de la lista de revisión y de las marcas en el perfil, siguiendo los componentes actuales.

## Para el paso de marketing (no se construye ahora)

- Con parentesco, el mensaje puede decir "el cumpleaños de tu mamá" en lugar del nombre.
- Un aniversario de pareja es "tu aniversario", no "el aniversario de Ana". Hoy `renderReminder` diría lo segundo.
- Hay que decidir si las fechas `card` reciben avisos y cuáles, y el permiso de promociones decide a quién le llegan. En la copia del 9 de noviembre solo 5 de los 96 clientes con cumpleaños tenían `sms-marketing`. El etiquetado de consentimiento en papel de ese mismo día puede haber subido esa cifra, y hay que contarlo en producción.
