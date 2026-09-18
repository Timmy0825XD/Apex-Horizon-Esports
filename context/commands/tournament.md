# Tournament

Reglas de producto: [../product/overview.md](../product/overview.md). Bracket: [../domains/bracket-rooms.md](../domains/bracket-rooms.md). Hojas almacenadas: [../domains/sheet.md](../domains/sheet.md).

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

Valida bracket + orden de columnas de la hoja. **Copia la sheet a la BD**. Máximo 4 torneos activos. Audita.

## `/tournament edit`

**Para qué:** Parchear el mundo del torneo. Mismos campos que add (excepto `id` de alta): `id` (autocomplete, obligatorio) + el resto opcional. Cambiar `auto_room_creation` afecta al worker al instante. Si cambia `sheet_link`, la copia almacenada se **reemplaza**. Audita.

## `/tournament delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| id | STRING (Autocomplete) | Sí |

Apaga automatización y olvida la config. **No** borra canales Discord, la hoja de Google ni el bracket externo. La copia de la sheet en BD **pasa a histórico** (sigue saliendo en `find_player`). Audita.

## `/tournament add_sheet`

**Para qué:** Meter una hoja al archivo **sin** crear un torneo operable. El bot no adivina columnas.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| sheet_link | STRING | Sí | URL de la hoja |
| format | STRING (Choice) | Sí | `1vs1` · `2vs2` · `3vs3` · `4vs4` · `5vs5` |

Audita.

## `/tournament find_player`

**Para qué:** Buscar una persona en **todas** las sheets almacenadas de ese servidor. Lectura; no audita. Relación: distinto de `/team info` (ese mira la hoja **viva** de un torneo).

| Campo | Tipo | Obligatorio |
|---|---|---|
| game_id | STRING | No* |
| discord_id | STRING | No* |
| discord_tag | STRING | No* |
| player_name | STRING | No* |

\*Al menos uno. Varios rellenos = **OR**.

Un V2 **por jugador distinto**: datos del capitán de su equipo + lista de sheets donde aparece. Varios jugadores → varios V2, cada uno con copy de *ese* jugador.

## `/tournament info` / `/tournament list`

Info: un torneo completo. List: todos del servidor (efímero). No mutan. No auditan.
