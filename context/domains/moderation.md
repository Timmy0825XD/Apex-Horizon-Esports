# Moderación de personas y del servidor

Independiente del bracket, el bot ayuda a gobernar el servidor.

## Bans

- **Ban por ID** con duración (7 días, 1 mes, 2 meses, 6 meses, permanente). Las duraciones no permanentes se **recuerdan** (`expiresAt`) y, al vencer, un proceso de fondo quita el ban. No se reescribe un ban que Discord ya tiene activo.
- **Unban por ID.** Borra el registro rastreado (cancela la caducidad). Si Discord ya lo había levantado, solo cancela el vencimiento.
- **Banlist** (`.txt` o `.xlsx`: ID, fecha, razón). La fecha sale del ban rastreado; si no, del audit log; si tampoco, `Unknown`.
- **Árbol de canales** y **invites** (incluido vanity), como export de lectura.
- No se banea a uno mismo, al owner, al bot ni a otros bots.

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
