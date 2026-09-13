# Participantes: la hoja es la verdad

La inscripción vive en una **Google Sheet** por torneo. El bot no pide nombres de columnas: lee **por posición**. `/sheet headers` enseña el orden de campos según formato (`1vs1` … `5vs5`). Si la fila 1 tiene etiquetas propias, esas etiquetas se reutilizan al mostrar equipos y validar.

La cache interna de participantes, si existe, es un **espejo**, no la fuente.

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

- `/team info` busca por usuario Discord o por ID/nombre de juego.
- `/team list` vuelca el roster (por la columna que elijas).
- `/assign_role` asigna un rol Discord a capitanes (por tag o por nombre in-game) y **cruza de nuevo** la lista de baneados: IDs inválidos, no están en el servidor, ya tenían el rol, o están baneados (usuario o ID de juego).

Un ban de Discord **no** es el cruce con la lista de IDs de juego baneados. Esa lista solo interviene al validar la hoja y al asignar roles de torneo.

## Relacionado

- Comandos: [../commands/sheet-teams.md](../commands/sheet-teams.md)
- Moderación: [moderation.md](moderation.md)
- Alta de torneo: [../commands/tournament.md](../commands/tournament.md)
