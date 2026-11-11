# Fechas y gustos a cambio de sellos

Tras una compra web pagada, la confirmación pregunta la fecha de un cumpleaños o
aniversario (o los gustos del destinatario) a cambio de un sello extra en la
tarjeta de fidelización. Mis fechas (`/account/dates`) permite editarlas, y un
SMS de venta sale 3 días antes. Diseño:
`docs/superpowers/specs/2026-11-09-fechas-y-gustos-design.md`.

## Variables

Llega apagado. Sin estas variables, todo sigue igual que hoy. Cada una se
enciende solo con `1` o `true`; cualquier otro valor (o vacía) es apagado.

| Variable | Qué enciende |
| --- | --- |
| `DATE_REWARDS_ENABLED` | La pregunta tras la compra, Mis fechas y los sellos. |
| `DATE_REMINDER_D3_ENABLED` | El mensaje de 3 días. |

Los sellos usan la conexión de la tarjeta (`LOYALTY_API_URL`, `LOYALTY_API_KEY`,
`docs/ops/loyalty-card.md`): sin ella no hay a quién sumar.

## Antes de encender

1. Tarjeta funcionando en producción, comprobada con una compra real.
2. Cron de `/api/cron/reminders` creado, a diario a las 09:15 de Nueva York (`docs/ops/date-reminders.md`).
3. SMS reales activos. En modo de prueba el aviso se marca como enviado y se pierde.
4. Registro A2P de Twilio que cubra mensajes promocionales.
5. Un abogado revisa la casilla, la política de privacidad (datos de terceros y premio por compartirlos) y las reglas del premio. Debe cubrir también las fechas leídas de los mensajes de tarjeta, que los clientes ven en «Mis fechas».
6. Maky revisa las listas de flores y colores.

## Despliegue

Siempre en este orden, y comprobando después de cada uno que el despliegue salió.

1. **Copia de seguridad.** Copiar el archivo SQLite de Diva antes de publicar:
   `/home/u283940187/domains/makythedivaflowers.com/diva-data/diva.sqlite`
   (por ejemplo a `diva.sqlite.bak-AAAAMMDD` en la misma carpeta).
2. **Primero el programa.** Publicarlo y comprobar que la ruta nueva existe y
   exige clave:
   ```bash
   curl -i -X POST https://<programa>/api/v1/customers/1/bonus
   # HTTP 401
   ```
3. **Luego Diva.** Publicarlo y comprobar que la ruta nueva del cron exige clave:
   ```bash
   curl -i -X POST https://makythedivaflowers.com/api/cron/loyalty-sync
   # HTTP 401
   ```
4. Con las variables aún apagadas, confirmar que nada cambió. Solo después de la
   lista "Antes de encender", poner `DATE_REWARDS_ENABLED=1` y, cuando se quiera
   el mensaje de 3 días, `DATE_REMINDER_D3_ENABLED=1`, y reiniciar.

Con `DATE_REWARDS_ENABLED`, la respuesta del cron de `loyalty-sync` suma
`bonus: { done, pending, failed }` (sellos por datos); ver `docs/ops/loyalty-card.md`.

## Leer los resultados a los 90 días

`/admin/occasions` muestra el bloque "Resultados de las fechas (últimos 90
días)":

- **Clientes con fechas propias** y cuántos dieron **permiso de SMS**.
- **STOP en 48 h**: bajas tras un mensaje de fechas. Si suben, parar el `d3`.
- Por mensaje (aviso de 7 días, oferta de 3 días): **enviados**, **omitidos**,
  **pedidos** y **ventas** que coinciden con la fecha.

Es coincidencia, no causa: un pedido cerca de la fecha puede haberse hecho igual.
Úsalo para decidir si el mensaje de 3 días se queda, no para medirlo al peso.
