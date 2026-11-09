# Conectar la tienda web con la tarjeta de fidelización

Fecha: 2026-11-08 · Estado: aprobado

## Intención

Maky quiere premiar la recompra con una sola tarjeta: 15% en la compra 3, 25% en la 6 y 50% en la 10. Esa tarjeta ya existe en el programa de fidelización (proyecto aparte, en producción), que es la única fuente de sellos y premios. La tienda web de Diva pasa a ser un punto más donde se acumula y se usa, igual que la caja física.

Diva no guarda copia de sellos ni premios. Los pide al programa por su API.

Documentación de la API: `/ayuda/api` en el programa, o `public/api.md` en `/Volumes/Datadriven/02_PROYECTOS/programa-fidelizacion`.

## Objetivos

- Quien tenga un premio lo ve y lo usa en el checkout web.
- Cada pedido web pagado suma un sello, aunque el programa esté caído en ese momento.
- Quien no tenga tarjeta puede unirse con una casilla en el checkout.
- La tarjeta reemplaza al premio automático de $15 en la quinta compra.

## Fuera de alcance

- Órdenes creadas a mano en el dashboard (intake). Quedan para después, para no arriesgar sellos dobles con la caja.
- Importar compras anteriores: todos arrancan la tarjeta en cero.
- Recibir avisos (webhooks) del programa. *(Decisión mía: los datos se consultan cuando hacen falta y ningún flujo de esta versión necesita enterarse antes.)*
- Cambiar el 10% de bienvenida o el referido de $15.
- Reembolsos reales en Stripe: hoy los hace el personal a mano y seguirá igual.

## Lo que no puede pasar

- Que alguien gaste el premio de otra persona solo con saber su celular.
- Que un fallo del programa impida comprar o haga fallar el webhook de Stripe.
- Que un reintento sume dos sellos o gaste dos premios.
- Que abandonar un pago le cueste un premio a alguien.
- Que alguien quede inscrito sin haber marcado la casilla.
- Que el navegador decida el precio: el descuento siempre se recalcula en el servidor.
- Que la clave de la API llegue al navegador.
- Que se vean en el checkout el nombre o los sellos de una persona a partir de su número.
- Que un cliente reciba a la vez el $15 de la quinta compra y la tarjeta como premios nuevos.

## Acordado con Santiago

1. Si la persona tiene un premio, lo ve al escribir su celular y elige si lo usa.
2. Para aplicarlo debe confirmar un código enviado por SMS.
3. Un solo descuento por orden: premio o código promocional, nunca los dos.
4. Si no tiene tarjeta, ve una casilla sin marcar para unirse.
5. Si el programa no responde en 2 o 3 segundos, la compra sigue normal y sin premio.
6. Después del pago se marca el premio como usado y se suma un sello, con número de orden prefijado (`diva-1001`).
7. Si el sello falla, queda pendiente y se reintenta con las tareas automáticas que Diva ya usa.
8. Si el premio se usó en caja mientras se pagaba en la web, se respeta el descuento y se avisa a Maky.
9. Al cancelar una orden, se revierte en la tarjeta.
10. El $15 de la quinta compra se apaga; los códigos `GRACIAS-…` ya enviados siguen valiendo. El 10% de bienvenida y el $15 por referido se quedan.
11. El porcentaje se lee del texto del premio. Si no trae porcentaje, no se ofrece en la web y se entrega en tienda.
12. Solo la web en esta versión. Las compras anteriores no cuentan.

## Comportamiento

### Configuración

- Variables de servidor `LOYALTY_API_URL` y `LOYALTY_API_KEY`.
- Con las dos definidas, la conexión está activa y el `$15` de la quinta compra deja de otorgarse (`loyalty()` en `lib/promo-rewards.ts`). Sin ellas, todo sigue exactamente como hoy. *(Decisión mía: permite desplegar antes y encender cuando la prueba con clave real esté hecha.)*
- Cliente de la API en un módulo `server-only`. Tiempo máximo de 2,5 s en lo que ocurre durante el checkout y 10 s en lo que corre después del pago.
- El celular se envía siempre en formato internacional (`+1…`).

### Checkout: ver el premio

- Al completar un celular válido en el paso de contacto, una ruta propia consulta `POST /customers/lookup` y `GET /program` si hace falta.
- Responde solo: si tiene tarjeta y la lista de premios aplicables, cada uno con `id`, porcentaje y texto. Nunca nombre, sellos ni visitas.
- Con límite por IP usando `lib/rate-limit.ts`, para que no sirva para averiguar qué números tienen tarjeta.
- Premio aplicable: el texto contiene exactamente un porcentaje con el patrón `N%`, entre 1 y 99. Un premio de 100% no se ofrece en la web y se entrega en tienda, porque una orden en $0 no puede cobrarse por Stripe y hoy el checkout solo tiene ese camino para gift cards. *(Decisión mía)*
- Si hay varios, se muestran todos y viene preseleccionado el de mayor porcentaje. *(Decisión mía)*
- Si la consulta falla o tarda, no se muestra nada de la tarjeta, ni premio ni casilla.

### Checkout: verificar por SMS

- Se envía solo cuando la persona pide usar un premio; quien no usa premio no recibe código.
- Código de 6 dígitos, válido 10 minutos, máximo 5 intentos, guardado con hash. Máximo 3 envíos por celular por hora y límite por IP, para controlar el costo de Twilio. *(Decisión mía)*
- Al verificar se entrega una constancia atada a ese celular, válida 15 minutos, que incluye los premios mostrados con su porcentaje. Cambiar a otro de esos premios no pide otro código. *(Decisión mía)* Si cambia el celular del formulario, deja de valer y el premio se quita.
- Si los SMS están apagados (`twilioSmsEnabled()` falso), no se ofrecen premios. En modo de prueba (`twilioDryRun()`), el código va al registro del servidor, como los demás envíos.

### Aplicar el descuento

- `POST /api/checkout/intent` recibe `loyaltyRewardId` y la constancia, nunca un monto.
- El servidor comprueba la constancia, pide los premios actuales al programa y toma el porcentaje de ahí.
- Si el programa dice que el premio ya no está: error `reward_unavailable`, el premio se quita y la persona ve el mensaje y el nuevo total.
- Si el programa no responde en ese momento pero la constancia es válida, se aplica con el porcentaje que tenía la constancia. *(Decisión mía: la persona ya verificó y no se le quita el descuento por una caída nuestra.)*
- Descuento: `min(round(subtotal × % / 100), subtotal)`. Solo sobre productos, sin envío ni propina, igual que los códigos porcentuales de `lib/promo.ts`.
- Si llegan premio y `promoCode` juntos, 400. En la pantalla, aplicar uno quita el otro.
- Se puede combinar con una gift card, porque la gift card es forma de pago.
- La orden guarda el id del premio, su texto y su porcentaje, en campos propios. No se llena `promoId`, para que no se ejecute `redeemPromo`.
- Recibos, factura y detalle de la orden en el panel muestran el premio.
- Volver a calcular el pago (propina, dirección) repite estas comprobaciones.

### Unirse a la tarjeta

- Casilla sin marcar en `ContactStep`, separada de las de SMS. Solo aparece si la consulta confirmó que ese número no tiene tarjeta.
- El consentimiento se guarda en la orden, y la tarjeta se crea solo después del pago con el nombre de quien paga (`order.contact.name`).
- Esa misma compra ya suma su primer sello.
- Si `smsConsent` está marcado, un SMS único con el enlace de la tarjeta (`cardUrl`). Si no, no se envía nada y la persona la encuentra en `/club`. *(Decisión mía)*

### Después del pago

- `onWebOrderPaid` ya cubre los tres caminos de pago web (Stripe, enlace de pago y gift card completa). Es el punto de entrada.
- El sello no puede depender de ese hook una sola vez: hoy retorna en cuanto la orden tiene `customerId`, así que un fallo a mitad se perdería. Se registra una fila en una tabla de pendientes (única por orden) antes de cualquier paso que pueda fallar, y se intenta enseguida sin bloquear.
- Pasos, en este orden:
  1. Encontrar al cliente con `lookup`; si no existe y marcó la casilla, crearlo con `POST /customers` y `consent: true`. Si no existe y no marcó, termina sin hacer nada.
  2. Si la orden usó premio: `POST /customers/:id/rewards/:rewardId/redeem` con `orderId`.
  3. Sumar un sello: `POST /customers/:id/stamps` con `orderId`. Un sello por orden, sin importar el monto.
- La entrega va antes del sello para que un premio final usado reinicie la tarjeta y este sello cuente en la nueva vuelta.
- Número de orden: `diva-<orderNumber>`, o `diva-<id>` si la orden no tiene número. Se fija al crear la fila y no cambia entre reintentos.
- `reward_unavailable` en el paso 2: se avisa a Maky con `notifyOwner` indicando orden y premio, y se continúa con el sello.
- `paused` u otros errores: queda pendiente.
- Nada de esto puede lanzar un error hacia el webhook de Stripe.

### Reintentos

- Ruta `POST /api/cron/loyalty-sync`, protegida con `CRON_SECRET` como `app/api/cron/reminders/route.ts` y llamada por el mismo cron externo (`docs/ops/date-reminders.md`), cada 10 minutos.
- Todos los pasos son seguros de repetir gracias al `orderId`.
- Se reintenta durante 72 horas. Después queda fallido y se avisa una vez a Maky con `notifyOwner`. *(Decisión mía)*

### Cancelar

- `PATCH /api/admin/orders/[id]/cancel` agrega la reversión, pendiente y con reintento igual que el sello, tras `POST /orders/:orderId/reverse`.
- Aplica a cualquier cancelación de una orden web pagada que haya llegado a la tarjeta.
- `order_not_found` cuenta como terminado.
- Si la orden aún tenía pasos sin enviar, no se envían.
- El premio usado vuelve a estar disponible y el sello se resta; eso lo hace el programa.
- Si la respuesta trae `rewardsAlreadyUsed` con datos, se avisa a Maky con `notifyOwner` indicando orden y premios, porque esa persona ya disfrutó un premio ganado con una compra cancelada. *(Decisión mía)*

### Textos

Los textos nuevos del checkout van en `messages/en.json` y `messages/es.json`.

## Puesta en marcha

1. Confirmar con una clave real que la API de producción responde.
2. Cargar los premios de Maky y dejar los sellos de bienvenida en 0.
3. Crear una clave llamada "Diva web" y definir las variables.
4. Comprobar que el negocio de Maky en el programa tiene Estados Unidos como país.
5. Añadir la nueva ruta al cron externo.
6. Hacer una compra completa de prueba, con premio y con cancelación.

## Pruebas requeridas

Con el cliente de la API simulado, en vitest: lectura del porcentaje; premio y código juntos; constancia vencida o de otro celular; precio recalculado en el servidor; programa caído en cada punto del checkout; orden de los pasos; reintento sin duplicar; webhook de Stripe repetido; premio ya usado; compra sin tarjeta y sin casilla; cancelación con pasos pendientes; variables ausentes con el comportamiento actual intacto, incluido el `$15`.

## Queda a criterio de quien lo construya

- Nombres de tablas, columnas y rutas nuevas.
- Forma de la constancia, siempre que cumpla sus límites.
- Diseño visual del bloque de premios, siguiendo el checkout actual.
- Cómo se reparte el código entre módulos.
