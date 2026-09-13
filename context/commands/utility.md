# Utility

Reglas de gobierno: [../domains/moderation.md](../domains/moderation.md). Tags de hoja: [../domains/sheet.md](../domains/sheet.md).

| Comando | Permiso típico | Campos | Para qué |
|---|---|---|---|
| `/utility clear_category` | Administrator | `category` CHANNEL (categoría) **sí** | Borra **todos** los canales hijos (confirmación). Relación: limpieza post-torneo. |
| `/utility clear` | Manage Messages | `number` INTEGER 1–1000 **o** `days` INTEGER 1–14 (no ambos) | Purga el canal actual. |
| `/utility emoji_steal` | Manage Emojis | `emoji_id` STRING **sí** | Quita un emoji custom y muestra la imagen. |
| `/utility random` | Público | `options` STRING **sí**; `number` INTEGER **no** | Sorteo. |
| `/utility utc` | Público | `hour` `minute` `day` `month` `year` INTEGER **sí** | Misma idea de reloj UTC que schedules. |
| `/utility discord_tag` | Público | `ids` STRING **sí** | Puente a la hoja. |
| `/utility avatar` | Público | `user` USER **no** | Avatar (por defecto tú). |
| `/utility toss` | Público | — | Cara o cruz. |
| `/utility enlarge` | Público | `emoji` STRING **sí** | Emoji a tamaño grande. |
| `/utility embed` | (builder) | `channel` CHANNEL **sí** | Constructor interactivo; publica en ese canal. |
| `/utility edit_embed` | (builder) | `message_id` STRING **sí**; `message_channel` CHANNEL **no** | Reescribe un embed **del bot**. |

`clear_category` muta el servidor de forma destructiva; el resto de utilidades de lectura no entran en la auditoría de torneo.
