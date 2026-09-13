# Tournament

Reglas de producto: [../product/overview.md](../product/overview.md). Bracket: [../domains/bracket-rooms.md](../domains/bracket-rooms.md).

## `/tournament add`

**Para qué:** Registrar un torneo operable.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| name | STRING | Sí | Nombre visible |
| id | STRING | Sí | Identidad del torneo en el bracket |
| key | STRING | Sí | Clave del bracket (se guarda cifrada) |
| sheet_link | STRING | Sí | Hoja de participantes |
| admin_role | ROLE | Sí | Organizer de *este* torneo |
| helper_role | ROLE | Sí | Helper de *este* torneo |
| attendance_channel | CHANNEL | Sí | Embeds de asistencia |
| transcript_channel | CHANNEL | Sí | HTML al cerrar por score |
| rules_channel | CHANNEL | Sí | Reglamento |
| deadline_channel | CHANNEL | Sí | Deadlines / info |
| result_channel | CHANNEL | Sí | `/schedule results` |
| closed_ticket_category | CHANNEL (categoría) | Sí | Tickets cerrados |
| ticket_open_category_1 | CHANNEL (categoría) | Sí | Primera cola de tickets |
| ticket_open_category_2 | CHANNEL (categoría) | Sí | Desborde |
| auto_room_creation | BOOLEAN | Sí | Capacidad de automatizar (no abre salas solo) |
| close_ticket_category_2 | CHANNEL (categoría) | No | Desborde de cerrados |
| ticket_open_category_3 | CHANNEL (categoría) | No | Desborde |
| ticket_open_category_4 | CHANNEL (categoría) | No | Desborde |
| events_links | CHANNEL | No | Publicación de YouTube |

Valida bracket + orden de columnas de la hoja. Máximo 4 torneos activos. Audita.

## `/tournament edit`

**Para qué:** Parchear el mundo del torneo. Mismos campos que add (excepto `id` de alta): `id` (autocomplete, obligatorio) + el resto opcional. Cambiar `auto_room_creation` afecta al worker al instante. Audita.

## `/tournament delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| id | STRING (Autocomplete) | Sí |

Apaga automatización y olvida la config. **No** borra canales Discord, la hoja ni el bracket externo. Audita.

## `/tournament info` / `/tournament list`

Info: un torneo completo. List: todos los del servidor (efímero). No mutan. No auditan.
