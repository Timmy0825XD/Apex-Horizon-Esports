# Moderación de personas y del servidor

Independiente del bracket, el bot ayuda a gobernar el servidor.

## Bans

- **Ban por ID** con duración (7 días, 1 mes, 2 meses, 6 meses, permanente). Las duraciones no permanentes se **recuerdan** y, al vencer, un proceso de fondo quita el ban.
- **Unban por ID.**
- **Banlist** (lista o Excel).
- No se banea a uno mismo, al owner, al bot ni a otros bots.

Un ban de Discord **no** es el cruce con la lista de IDs de juego baneados. Esa lista solo interviene al validar la hoja y al asignar roles de torneo. Ver [sheet.md](sheet.md).

## Roles (Discord, no torneo)

- Toggle de un rol en un usuario.
- Add/remove masivo de un rol.
- Listado o CSV de miembros de un rol.

Jerarquía Discord siempre gana. Ver [../product/actors.md](../product/actors.md).

## Utilidades de gobierno

- Limpieza de mensajes o de todos los canales bajo una categoría (con confirmación).
- Utilidades de timing UTC (la misma idea de reloj que los schedules), azar, embeds, avatares, emojis.

`/utility clear_category` muta el servidor de forma destructiva.

## Relacionado

- Worker de caducidad: [../platform/workers.md](../platform/workers.md)
- Comandos: [../commands/server-user.md](../commands/server-user.md), [../commands/roles.md](../commands/roles.md), [../commands/utility.md](../commands/utility.md)
