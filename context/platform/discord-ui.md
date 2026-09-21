# UI de Discord (copy, menciones, emojis)

Las personas ven **embeds en inglés**. Emojis de **propósito** (éxito, error, alerta), no adorno. Ver también [ux.md](ux.md).

## Emojis — `emojis.ts`

Un fichero de constantes (`emojis.ts`) guarda los emojis del bot. Cualquier respuesta los **importa** de ahí. No se pegan emojis sueltos en cada comando.

## Componentes reutilizables

Se pueden reutilizar **cascarones** (info / error / success: color, emoji del tipo, layout). Los paneles de `/bot`, `/settings`, `/server`, `/staff config`, el **welcome de `/staff recruit`**, **`/tournament`** (add / edit / delete / add_sheet / get_sheet / find_player / info / list / role), **`/team`** (info / list), **`/role`** (user / add all / remove all / list) y **`/user`** (ban / unban) usan **Components V2** (`Container`, `Section`, `Text Display`), no un embed clásico. En add / edit / info de torneo, cada bloque (Identity, Roles, Channels, Ticket categories) va separado con `Separator`; el footer es `-# Created by` con `formatUser` (sin ping). El V2 de `delete` separa **Cleared from the bot** y **Left in place**. Categorías de ticket no configuradas no se listan. En `find_player` y `get_sheet`, cada sheet lista el **nombre del servidor** de origen (texto plano; Discord no menciona guilds). `get_sheet` con `csv` adjunta un **File** V2 (`tournament-sheets.csv`). El aviso de `find_player` en el éxito de `add_sheet` va en un bloque aparte para que el slash no se corte. `/team info` pone el **nombre del equipo** como título (emoji `teamName`, sin thumbnail del panel). Tournament name y Matched by van en texto plano (sin `>`), con `torneo` y `matchBy`. Un **Separator** delante del primer jugador; cada uno es un **Section** (`### Captain details`, avatar). Title lleva `hero` o `legend` si el texto contiene *hero* o *legend*. Footer: `-# Requested by` con `formatUser`. `/tournament role` sin `id_header` manda un V2 de confirmación (qué rol, a todos los jugadores, qué se omite) con botones Confirm / Cancel. Tras asignar, responde con un V2 por cubo (asignados, ya tenían el rol, no están en el servidor, IDs inválidos, baneados); cada contenedor tiene copy de *ese* resultado. `/team list` publica en el canal un V2 por equipo, uno detrás de otro (mismo panel que info, sin *Matched by*). `/role user` es un V2 de *Role granted* o *Role removed*. `/role add all` y `/role remove all` responden con un V2 por cubo (cambiados, ya en el estado deseado, fallidos). `/role list` es efímero: conteo humanos/bots y menciones, o File CSV si no caben. `/user ban` y `/user unban` usan V2 con mención del ID y, si hay avatar, thumbnail. `/staff work` sí usa **tres embeds clásicos** (Judges / Recorders / Dual) más el `.txt` de degradaciones. `/utility embed` publica un **embed clásico**; `/utility v2` publica **Components V2**. Un adjunto en V2 (p. ej. `/server banlist`) lleva un componente **File** que apunta a `attachment://nombre`; si solo se sube el archivo sin ese componente, Discord lo descarta.

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

Menciones de slash commands: `</name:id>` vía `formatHelpEntry` (en `/bot help` para subcomandos de `bot`, `settings`, `server`, `staff`, `tournament`, `team`, `role`, `user` y `utility`; el resto del catálogo usa `` `/comando` `` hasta estar registrados).

## Énfasis (markdown de Discord)

| Estilo | Sintaxis | Uso |
|---|---|---|
| Bold | `**text**` | Nombres de equipo/torneo, labels, conteos |
| Italic | `*text*` | Notas secundarias, stage, copy de ayuda |
| Underline | `__text__` | Separadores (`__vs__`), divisores de sección |
| Monospace | `` `text` `` | Scores, Match IDs, slugs de canal, números crudos |

## Relacionado

- Autocomplete (nombres al elegir, menciones al mostrar): [autocomplete.md](autocomplete.md)
- Auditoría (títulos de webhook, no UI de comando): [audit.md](audit.md)
