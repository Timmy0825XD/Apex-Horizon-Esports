# Utility

Reglas de gobierno: [../domains/moderation.md](../domains/moderation.md). Tags de hoja: [../domains/sheet.md](../domains/sheet.md).

Slash: comando `utility`. Las respuestas de lectura y mutación son **Components V2**, salvo el builder de embed clásico (preview + botones) y el embed publicado.

| Comando | Permiso típico | Campos | Para qué |
|---|---|---|---|
| `/utility clear category` | Admin | `category` CHANNEL (categoría) **sí** | Borra **todos** los canales hijos (confirmación). Relación: limpieza post-torneo. Audita. |
| `/utility clear messages` | Admin | `number` INTEGER 1–1000 **o** `days` INTEGER 1–14 (no ambos) | Purga el canal actual. Mensajes de más de 14 días no se pueden borrar en lote. Audita. |
| `/utility emoji steal` | Admin | `emoji_id` STRING **sí** | Quita un emoji custom **de este servidor** y adjunta la imagen. Audita. |
| `/utility random` | Público | `options` STRING **sí**; `number` INTEGER **no** | Sorteo (coma, pipe o salto de línea). |
| `/utility utc` | Público | `hour` `minute` `day` `month` `year` INTEGER **sí** | Misma idea de reloj UTC que schedules. |
| `/utility discord tag` | Admin u Organiser | `ids` STRING **sí** | Puente a la hoja: IDs → usernames en el mismo orden. Efímero. |
| `/utility avatar` | Público | `user` USER **no** | Avatar (por defecto tú). |
| `/utility toss` | Público | — | Cara o cruz. |
| `/utility enlarge` | Público | `emoji` STRING **sí** | Emoji a tamaño grande (custom o unicode). |
| `/utility dot` | Admin, Organiser o Helper | `color` Choice **no** (🔴 red por defecto · 🟢 green · 🟡 yellow · 🟠 orange) | Pone el círculo al inicio del nombre del canal actual; si ya empieza por uno de esos 4, lo sustituye. Audita. |
| `/utility add member` | Admin, Organiser o Helper | `user` USER **sí** | Da al usuario acceso al canal actual (ver, escribir, historial, adjuntar). No acepta bots. Audita. |
| `/utility embed create` | Admin u Organiser | `channel` CHANNEL **sí** | Constructor interactivo de embed clásico; publica en ese canal. Audita al publicar. |
| `/utility embed edit` | Admin u Organiser | `message_id` STRING **sí**; `message_channel` CHANNEL **no** | Reescribe un embed **del bot**. Audita. |
| `/utility v2 create` | Admin u Organiser | `channel` CHANNEL **sí** | Constructor interactivo de **Components V2**; publica en ese canal. Audita al publicar. |
| `/utility v2 edit` | Admin u Organiser | `message_id` STRING **sí**; `message_channel` CHANNEL **no** | Reescribe un mensaje V2 **del bot**. Audita. |

## Builders (embed y V2)

Sesión **efímera**, 15 minutos de inactividad. Un draft por persona y servidor. Solo se publican o editan mensajes **de este bot**.

El panel de `/utility embed create` es un embed clásico (el draft es el preview). El de `/utility v2 create` es Components V2: un container de contenido + un container de controles.

| Builder | Se puede añadir |
|---|---|
| Embed | Title, description, color, author, footer, thumbnail, image, fields, timestamp |
| V2 | Text display (markdown), section (heading + extra + thumbnail), separator, media gallery, accent color. Undo last. |

## Respuestas

- `clear messages`: V2 rojo `## Channel Purged`, con el canal y el filtro (*last N messages* / *last N days*), **Deleted** y, si los hay, **Left in place** (más de 14 días). Footer `Purged by` con hora.
- `clear category`: la confirmación es un V2 naranja con la categoría y cuántos canales caen. Debajo van los canales seguidos (máx. 15 y *and N more*), el aviso de que no se puede deshacer y quién puede pulsar. Los botones van dentro: **Delete N channels** (rojo) / **Cancel**. El resultado es rojo *Category Cleared*, con **Deleted** y **Failed** y footer `Cleared by`. Cancelar deja *Category Wipe Cancelled* con `Cancelled by`.
- `emoji steal`: V2 rojo `## Emoji Removed`, con nombre, ID y si es animado. Lleva el File con la imagen (o la galería si no se pudo descargar) y el footer `Removed by`.
- `random`: `## Random Picks`, en `-#` cuántos de cuántas opciones, y cada elegido en `###` con su emoji de número, seguidos. Footer *Picked for*.
- `toss`: el lado es el título (`## Heads` / `## Tails`), en azul. Footer *Flipped for*.
- `utc`: `## UTC Timestamp`, en `-#` la fecha UTC escrita (`día/mes/año hora`) y que es el mismo reloj que los schedules. Debajo solo **Full**, **Short** y **Relative**: sin Unix ni el código `<t:…>`.
- `discord tag`: `## Discord Tags`, en `-#` el conteo, y el bloque de código. Si no cabe, va un File. Los IDs sin resolver se avisan con `alert` y se quedan como ID en su fila.
- `avatar` / `enlarge`: título `##` con quién (y si es el avatar del servidor o de la cuenta) o nombre, ID y tipo del emoji. Debajo, la galería y el botón de enlace **Open full size**.
- `dot`: V2 verde `## Channel Marked` con el canal y el círculo. Si ya tenía ese color, info *Already marked* sin renombrar. Discord permite **2** renombres por canal cada **10 minutos**: si el rename no termina en 5 s, V2 azul *Dot Queued* y se aplica (y audita) cuando Discord lo deje. Footer `Marked by` / `Queued by`.
- `add member`: V2 verde `## Member Added` con el usuario y el canal. Footer `Added by`. Si ya puede ver y escribir, info *Already has access* sin cambiar nada.
- `v2 create` / `edit`: el panel de controles lleva `## Components V2 Builder` con el modo y el canal, y la nota de la sesión en `-#`. Al publicar o editar queda *Components V2 Published* / *Updated* con el botón **Jump to message**.

`clear category` muta el servidor de forma destructiva. Lecturas (`random`, `utc`, `discord tag`, `avatar`, `toss`, `enlarge`) no entran en la auditoría.

## Relacionado

- Interacciones (confirmación y builders): [interactions.md](interactions.md)
- Auditoría: [../platform/audit.md](../platform/audit.md)
