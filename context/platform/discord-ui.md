# UI de Discord (copy, menciones, emojis)

Las personas ven **embeds en inglés**. Emojis de **propósito** (éxito, error, alerta), no adorno. Ver también [ux.md](ux.md).

## Emojis — `emojis.ts`

Un fichero de constantes (`emojis.ts`) guarda los emojis del bot. Cualquier respuesta los **importa** de ahí. No se pegan emojis sueltos en cada comando.

## Componentes reutilizables

Se pueden reutilizar **cascarones** (info / error / success: color, emoji del tipo, layout). Los paneles de `/bot`, `/settings` y `/server` usan **Components V2** (`Container`, `Section`, `Text Display`), no un embed clásico. Un adjunto en V2 (p. ej. `/server banlist`) lleva un componente **File** que apunta a `attachment://nombre`; si solo se sube el archivo sin ese componente, Discord lo descarta.

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

Menciones de slash commands: `</name:id>` vía `formatHelpEntry` (en `/bot help` para subcomandos de `bot`, `settings` y `server`; el resto del catálogo usa `` `/comando` `` hasta estar registrados).

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
