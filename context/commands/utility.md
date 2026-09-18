# Utility

Reglas de gobierno: [../domains/moderation.md](../domains/moderation.md). Tags de hoja: [../domains/sheet.md](../domains/sheet.md).

Slash: comando `utility`. Las respuestas de lectura y mutación son **Components V2**, salvo el builder de embed clásico (preview + botones) y el embed publicado.

| Comando | Permiso típico | Campos | Para qué |
|---|---|---|---|
| `/utility clear_category` | Discord Administrator | `category` CHANNEL (categoría) **sí** | Borra **todos** los canales hijos (confirmación). Relación: limpieza post-torneo. Audita. |
| `/utility clear` | Manage Messages | `number` INTEGER 1–1000 **o** `days` INTEGER 1–14 (no ambos) | Purga el canal actual. Mensajes de más de 14 días no se pueden borrar en lote. Audita. |
| `/utility emoji_steal` | Manage Emojis | `emoji_id` STRING **sí** | Quita un emoji custom **de este servidor** y adjunta la imagen. Audita. |
| `/utility random` | Público | `options` STRING **sí**; `number` INTEGER **no** | Sorteo (coma, pipe o salto de línea). |
| `/utility utc` | Público | `hour` `minute` `day` `month` `year` INTEGER **sí** | Misma idea de reloj UTC que schedules. |
| `/utility discord_tag` | Público | `ids` STRING **sí** | Puente a la hoja: IDs → usernames en el mismo orden. Efímero. |
| `/utility avatar` | Público | `user` USER **no** | Avatar (por defecto tú). |
| `/utility toss` | Público | — | Cara o cruz. |
| `/utility enlarge` | Público | `emoji` STRING **sí** | Emoji a tamaño grande (custom o unicode). |
| `/utility embed` | Manage Messages | `channel` CHANNEL **sí** | Constructor interactivo de embed clásico; publica en ese canal. Audita al publicar. |
| `/utility edit_embed` | Manage Messages | `message_id` STRING **sí**; `message_channel` CHANNEL **no** | Reescribe un embed **del bot**. Audita. |
| `/utility v2` | Manage Messages | `channel` CHANNEL **sí** | Constructor interactivo de **Components V2**; publica en ese canal. Audita al publicar. |
| `/utility edit_v2` | Manage Messages | `message_id` STRING **sí**; `message_channel` CHANNEL **no** | Reescribe un mensaje V2 **del bot**. Audita. |

## Builders (embed y V2)

Sesión **efímera**, 15 minutos de inactividad. Un draft por persona y servidor. Solo se publican o editan mensajes **de este bot**.

El panel de `/utility embed` es un embed clásico (el draft es el preview). El de `/utility v2` es Components V2: un container de contenido + un container de controles.

| Builder | Se puede añadir |
|---|---|
| Embed | Title, description, color, author, footer, thumbnail, image, fields, timestamp |
| V2 | Text display (markdown), section (heading + extra + thumbnail), separator, media gallery, accent color. Undo last. |

`clear_category` muta el servidor de forma destructiva. Lecturas (`random`, `utc`, `discord_tag`, `avatar`, `toss`, `enlarge`) no entran en la auditoría.

## Relacionado

- Interacciones (confirmación y builders): [interactions.md](interactions.md)
- Auditoría: [../platform/audit.md](../platform/audit.md)
