# Moderación de personas y del servidor

Independiente del bracket, el bot ayuda a gobernar el servidor.

## Bans

- **Ban por ID** con duración (7 días, 1 mes, 2 meses, 6 meses, permanente). Las duraciones no permanentes se **recuerdan** (`expiresAt`) y, al vencer, un proceso de fondo quita el ban. No se reescribe un ban que Discord ya tiene activo.
- **Unban por ID.** Borra el registro rastreado (cancela la caducidad). Si Discord ya lo había levantado, solo cancela el vencimiento.
- **Banlist** (`.txt` o `.xlsx`: ID, fecha, razón). La fecha sale del ban rastreado; si no, del audit log; si tampoco, `Unknown`.
- **Árbol de canales** y **invites** (incluido vanity), como export de lectura.
- No se banea a uno mismo, al owner, al bot ni a otros bots.

## Avisos de baneo

El servidor oficial de torneos publica bans y unbans en su canal, y cada servidor lo sigue en su `bans_channel` de `/settings`. El bot lee **cada mensaje** de ese canal que no sea suyo (también uno pegado a mano) y no espera ninguna estructura: los avisos cambian siempre de forma.

- **Solo cuentan los Discord ID** (17–20 dígitos). El Game ID se ignora. Las menciones de rol, de canal, emojis, marcas de tiempo y enlaces no se toman por IDs; una mención de usuario sí.
- Si el texto dice *unban* / *unbanned*, es un aviso de **unban**. Si no, de **ban**.
- Si hay una línea `Reason:`, cada ID toma la primera que le sigue (o la última anterior si no hay ninguna después). Si no hay, el motivo queda *Not stated*.
- Un aviso sin Discord ID no genera nada. Un aviso de unban solo genera tarjetas para IDs **baneados en este servidor**.

**Una tarjeta por Discord ID** (Components V2, amarilla, pendiente): mención e ID, si está en el servidor, si ya está baneado, el motivo, la duración y el enlace al aviso. Si el ID está en el roster guardado de un torneo registrado en el servidor, la tarjeta lo alerta con torneo, equipo y puesto. Un ID repetido en el aviso genera una sola tarjeta, y no se crea otra si ya hay una pendiente para esa cuenta.

Debajo, **un solo mensaje de ping** al rol Organiser (`manager_role` de `/staff config`) por aviso, con cuántas decisiones esperan y cuántas personas juegan un torneo activo. Sin `/staff config` no hay ping; las tarjetas salen igual.

Botones (solo Organiser):

| Botón | Qué hace |
|---|---|
| **Confirm ban** | Banea con la duración de la tarjeta (**Permanent** por defecto) y las mismas reglas de `/user ban`. Guarda la caducidad si no es permanente. |
| **Change duration** | Cambia los botones por la lista 7 days / 1 month / 2 months / 6 months / Permanent. Al elegir, la tarjeta muestra la nueva duración y **vuelve a pedir Confirm**. *Back* deja la duración como estaba. |
| **Confirm unban** | Solo en avisos de unban. Igual que `/user unban`. |
| **Cancel** | Descarta la solicitud sin tocar a nadie. |

Si la cuenta no existe, es el owner o un bot, o ya está baneada, **Confirm** y **Change duration** salen apagados y solo queda Cancel. Si Discord rechaza el ban (jerarquía, permisos), la tarjeta sigue pendiente y quien pulsó recibe el motivo en privado.

Al decidir, la tarjeta pendiente se **borra** y queda una tarjeta final: roja (*Player banned*, con duración y caducidad), verde (*Player unbanned*) o gris (*Request dismissed*), con quién decidió, la hora UTC y el enlace al aviso. Cuando se decide la última tarjeta de un aviso, se borra su ping. Solo un Organiser puede decidir cada tarjeta; un doble clic no banea dos veces. Las solicitudes viven en el almacén (`ban_requests`), así que los botones siguen funcionando tras un reinicio.

Banear o desbanear desde un aviso se audita en **Moderation** con el enlace al aviso. Cancelar no muta nada y no se audita.

Un ban de Discord **no** es el cruce con la lista de IDs de juego baneados. Esa lista interviene al validar la hoja, al crear o cambiar la sheet de un torneo, y al asignar roles de torneo. Ver [sheet.md](sheet.md).

## Roles (Discord, no torneo)

- Toggle de un rol en un usuario.
- Add/remove masivo de un rol.
- Listado o CSV de miembros de un rol.

Jerarquía Discord siempre gana. Ver [../product/actors.md](../product/actors.md).

## Utilidades de gobierno

- Limpieza de mensajes o de todos los canales bajo una categoría (con confirmación).
- Utilidades de timing UTC (la misma idea de reloj que los schedules), azar, avatares, emojis.
- Constructores de **embed clásico** y de **Components V2** (crear y reescribir mensajes del bot).

`/utility clear_category` muta el servidor de forma destructiva.

## Relacionado

- Worker de caducidad: [../platform/workers.md](../platform/workers.md)
- Comandos: [../commands/server-user.md](../commands/server-user.md), [../commands/roles.md](../commands/roles.md), [../commands/utility.md](../commands/utility.md)
