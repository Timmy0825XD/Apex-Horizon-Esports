# Participantes: la hoja es la verdad

La inscripción vive en una **Google Sheet** por torneo. El bot no pide nombres de columnas: lee **por posición**. `/sheet headers` enseña el orden de campos según formato (`1vs1` … `5vs5`). Si la fila 1 tiene etiquetas propias, esas etiquetas se reutilizan al mostrar equipos y validar.

Operar un torneo vivo (`/sheet validate`, `/team info`, `/assign_role`) **sigue leyendo Google**. Además, el bot **almacena copias** de hojas en la BD de ese servidor para buscar gente a lo largo del tiempo. `find_player` no relee Google: mira esas copias.

## Archivo de sheets (BD)

Tres orígenes, un solo pozo de búsqueda (solo ese gremio):

| Origen | Cuándo entra | Qué pasa después |
|---|---|---|
| `/tournament add` | Al crear el torneo se **copia** la sheet | Si `/tournament edit` cambia `sheet_link`, esa copia se **reemplaza** (no se conserva la foto vieja). |
| `/tournament add_sheet` | Alta manual: `sheet_link` + `format` | El formato es Choice (`1vs1` … `5vs5`); el bot no adivina columnas. |
| `/tournament delete` | La config del torneo se olvida | La sheet **pasa a histórico**. Sigue saliendo en `find_player`. |

La copia guarda de qué identificarla en la lista (link, formato, y el nombre del torneo si nació de uno).

## Antes de crear el torneo

`/sheet validate` es control de calidad **previo** a `/tournament add`. Recorre cada jugador y aplica:

1. El ID de juego no está en la lista pública de baneados.
2. Discord ID e in-game ID son únicos en toda la hoja.
3. La cuenta Discord tiene más de un mes.
4. Discord ID (snowflake) e in-game ID (hex) tienen forma válida.
5. La persona no tiene roles de staff / judge / recorder del servidor.
6. Es miembro del servidor actual.
7. El tag de la hoja coincide con el de Discord.
8. Si el ID falta o es inválido, intenta resolver por tag **solo si hay exactamente un miembro** con ese tag — y aun así lo marca para que se corrija la hoja.

`/utility discord_tag` existe para **arreglar la columna de tags**: pegas IDs, recibes usernames en el mismo orden.

## Durante el torneo

- `/team info` busca en **la hoja viva de un torneo** por usuario Discord o por ID/nombre de juego.
- `/team list` vuelca el roster (por la columna que elijas).
- `/assign_role` asigna un rol Discord a capitanes (por tag o por nombre in-game) y **cruza de nuevo** la lista de baneados: IDs inválidos, no están en el servidor, ya tenían el rol, o están baneados (usuario o ID de juego).

Un ban de Discord **no** es el cruce con la lista de IDs de juego baneados. Esa lista solo interviene al validar la hoja y al asignar roles de torneo.

## `/tournament find_player`

Busca en **todas** las copies almacenadas (activas, manuales e histórico). No es `/team info`.

Cuatro STRING libres, todos opcionales: ID de juego, ID de Discord, tag de Discord, nombre del jugador. **Al menos uno** obligatorio. Varios rellenos = **OR** (vale coincidir en cualquiera).

Agrupación: **un jugador distinto → un V2**. Misma persona en varias sheets → un V2, lista de esas sheets. El OR pegó a dos personas distintas → dos V2.

Cada V2 trae:

1. **Datos del capitán** del equipo donde está ese jugador (fila completa según el formato de esa hoja).
2. **Lista de sheets** en las que ese jugador aparece relacionado.

Sin coincidencias: un V2 de vacío/error, no una lista hueca.

No audita (lectura). Comandos: [../commands/tournament.md](../commands/tournament.md).

## Relacionado

- Comandos de hoja viva: [../commands/sheet-teams.md](../commands/sheet-teams.md)
- Moderación: [moderation.md](moderation.md)
- Alta de torneo / add_sheet / find_player: [../commands/tournament.md](../commands/tournament.md)
