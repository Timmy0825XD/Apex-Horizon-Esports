# UI de Discord (copy, menciones, emojis)

Las personas ven **embeds en inglés**. Emojis de **propósito** (éxito, error, alerta), no adorno. Ver también [ux.md](ux.md).

## Emojis — `emojis.ts`

Un fichero de constantes (`emojis.ts`) guarda los emojis del bot. Cualquier respuesta los **importa** de ahí. No se pegan emojis sueltos en cada comando.

## Componentes reutilizables

Se pueden reutilizar **cascarones** (info / error / success: color, emoji del tipo, layout). Los paneles de `/bot`, `/settings`, `/server`, `/staff config`, el **welcome de `/staff recruit`**, **`/tournament`** (add / edit / delete / add_sheet / get_sheet / find_player / info / list / role), **`/team`** (info / list), **`/role`** (user / add all / remove all / list) y **`/user`** (ban / unban) usan **Components V2** (`Container`, `Section`, `Text Display`), no un embed clásico. En add / edit / info de torneo, cada bloque (Identity, Roles, Channels, Ticket categories) va separado con `Separator`; el footer es `-# Created by` con `formatUser` (sin ping). El V2 de `delete` separa **Cleared from the bot** y **Left in place**. Categorías de ticket no configuradas no se listan. En `find_player` y `get_sheet`, cada sheet lista el **nombre del servidor** de origen (texto plano; Discord no menciona guilds). `get_sheet` con `csv` adjunta un **File** V2 (`tournament-sheets.csv`). El aviso de `find_player` en el éxito de `add_sheet` va en un bloque aparte para que el slash no se corte. `/team info` pone el **nombre del equipo** como título (emoji `teamName`, sin thumbnail del panel). Tournament name y Matched by van en texto plano (sin `>`), con `torneo` y `matchBy`. Un **Separator** delante del primer jugador; cada uno es un **Section** (`### Captain details`, avatar). Title lleva `hero` o `legend` si el texto contiene *hero* o *legend*. Footer: `-# Requested by` con `formatUser`. `/tournament role` sin `id_header` manda un V2 de confirmación (qué rol, a todos los jugadores, qué se omite) con botones Confirm / Cancel. Tras asignar, responde con un V2 por cubo (asignados, ya tenían el rol, no están en el servidor, IDs inválidos, baneados); cada contenedor tiene copy de *ese* resultado. `/team list` publica en el canal un V2 por equipo, uno detrás de otro (mismo panel que info, sin *Matched by*). `/role user` es un V2 de *Role granted* o *Role removed*. `/role add all` y `/role remove all` responden con un V2 por cubo (cambiados, ya en el estado deseado, fallidos). `/role list` es efímero: conteo humanos/bots y menciones, o File CSV si no caben. `/user ban` y `/user unban` usan V2 con mención del ID y, si hay avatar, thumbnail. `/staff work` sí usa **tres embeds clásicos** (Judges / Recorders / Dual) más el `.txt` de degradaciones. Toda la familia `/schedule` usa **embeds clásicos** (posts, respuestas y resultados) y se publica en el canal: ningún mensaje de ese flujo es efímero. `/utility embed` publica un **embed clásico**; `/utility v2` publica **Components V2**. Un adjunto en V2 (p. ej. `/server banlist`) lleva un componente **File** que apunta a `attachment://nombre`; si solo se sube el archivo sin ese componente, Discord lo descarta.

**No** reutilizar el mismo texto en varios bloques de la misma respuesta. Si hay tres embeds de éxito, cada uno describe **su** hecho, no un “Success” genérico repetido.

## Entidades: menciones, no nombres

En descripciones de embed y texto visible al usuario **no** se usa `role.name`, `user.tag`, `user.username` ni `channel.name`. Se usan helpers para que un recurso borrado tenga el mismo fallback.

| Entidad | Helper | Output |
|---|---|---|
| Role (by ID) | `formatRole(guild, roleId)` | `<@&roleId>` |
| Role (object) | `formatRoleFromRole(role)` | `<@&roleId>` |
| Text/announcement channel | `formatChannel(guild, channelId)` | `<#channelId>` |
| Category | `formatCategory(guild, categoryId)` | `<#categoryId>` |
| User (by ID) | `formatUser(userId)` | `<@userId>` |
| User (object) | `formatUserFromUser(user)` | `<@userId>` |
| Guild member | `formatMember(member)` | `<@userId>` |

Preferir helpers frente a `` `<@&${id}>` `` inline.

**Excepciones:** CSV/Excel y nombres de archivo de audit pueden llevar identificadores en texto plano (no son UI de Discord). El ID *es* el dato en banlist/sheet.

Menciones de slash commands: `</name:id>` vía `formatHelpEntry` (en `/bot help` para subcomandos de `bot`, `settings`, `server`, `staff`, `tournament`, `team`, `role`, `user`, `utility`, `room`, `ticket` y `schedule`, y para `/auto_room`; el resto del catálogo usa `` `/comando` `` hasta estar registrados).

El battle ticket (el canal del partido) abre con un Components V2: título `lado VS lado` (emoji `vs`; tag del capitán en `1vs1`, nombre del equipo si el formato es de más de un jugador), debajo **Tournament:**, **Round:** y **Group:** solo si hay grupo, cada equipo con la línea del capitán al mismo nivel que los in-game ID y el avatar del capitán, reglas y deadline. El footer es el **Match ID** y la fecha y hora exactas en que terminan las **36 horas** (`día/mes/año` y hora), en la zona horaria de quien ve el mensaje. La descripción del canal es `Tournament ID: <id de Challonge> | Match ID: <id del match>`. Ese V2 queda fijado en el canal. El mensaje de texto que va después hace ping a los capitanes. `/ticket` responde con V2 efímero. `/schedule` publica el schedule creado como embed clásico (ticket y canal de schedules) y `/schedule results` publica otro embed clásico (ticket y canal de resultados); el resto de respuestas del comando, errores incluidos, van en Components V2 en el canal. `/auto_room` apagado, ya encendido, o el error antes de leer el bracket, también. `/room create` y el encendido de `/auto_room` se publican en el canal: V2 con creados, éxitos, errores, cupo de las categorías y, si aplica, **Issues** (`- @capitán (**tag** / **equipo**)` si no está en el servidor; tag y equipo si el Discord ID es inválido). No lista los canales creados. `/room available` se publica en el canal: V2 de barra verde, *Available Rooms for* el torneo, el rango `Showing 1 - 20 of N`, y cada partido en dos líneas (emoji `vs`, **Match N** - Round N - Group N solo si hay grupos, y `nombre vs nombre`). Los `_` de los tags se escapan para que no activen la cursiva. Pasa de 20 y aparecen Previous / Next.

## Énfasis (markdown de Discord)

| Estilo | Sintaxis | Uso |
|---|---|---|
| Bold | `**text**` | Nombres de equipo/torneo, labels, conteos |
| Italic | `*text*` | Notas secundarias, stage, copy de ayuda |
| Underline | `__text__` | Divisores de sección. Nunca `__vs__` |
| Matchup | `name vs name` | Los dos lados de un partido, en texto plano. Escapa `_` y `*` del nombre (`escapeDiscord`) |
| Monospace | `` `text` `` | Scores, Match IDs, slugs de canal, números crudos |

## Relacionado

- Autocomplete (nombres al elegir, menciones al mostrar): [autocomplete.md](autocomplete.md)
- Auditoría (títulos de webhook, no UI de comando): [audit.md](audit.md)
