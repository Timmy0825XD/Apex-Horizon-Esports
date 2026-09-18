# Participantes: la hoja es la verdad

La inscripción vive en una **Google Sheet** por torneo. El bot no pide nombres de columnas: lee **por posición**. `/sheet headers` enseña el orden de campos según formato (`1vs1` … `5vs5`). Si la fila 1 tiene etiquetas propias, esas etiquetas se reutilizan al mostrar equipos y validar.

Cada jugador ocupa **5 columnas**, en este orden: Discord Tag · Discord ID · in-game name · in-game ID · Current Title.

- **`1vs1`:** no hay columna de equipo aparte. El **tag del capitán** es el nombre con el que sale en Challonge. 5 columnas de jugador, luego N opcionales.
- **`2vs2`, `3vs3`, `4vs4`, `5vs5`:** la **primera columna es el nombre del equipo** (bracket). A partir de la segunda empieza el tag del capitán y el resto de bloques de 5. Luego N opcionales.

Los campos adicionales **siempre van al final**. El bot detecta el formato cogiendo el mayor `k` (5…1) cuyo bloque core cabe, y el resto son extra. `/tournament add` y `/tournament add_sheet` hacen esa detección solos.

El torneo y la copia en BD guardan `format` y `additionalFieldCount`. Los extra se almacenan con el **nombre del header** de la fila 1; `/team` los muestra al final del V2. `/tournament find_player` **no** los usa.

Operar un torneo vivo (`/sheet validate`, `/team info`, `/assign_role`) **sigue leyendo Google**. Además, el bot **almacena copias** de hojas en un archivo **global** (todos los servidores del bot). `find_player` no relee Google: mira esas copias, en cualquier gremio.

## Archivo de sheets (BD)

Un solo pozo de búsqueda para **todo el bot**. Cada copia recuerda de qué servidor salió (se muestra el nombre del servidor en el V2).

| Origen | Cuándo entra | Qué pasa después |
|---|---|---|
| `/tournament add` | Al crear el torneo se **copia** la sheet | Cruza in-game IDs con la lista oficial de baneados; si hay alguno, **no** crea. Si `/tournament edit` cambia `sheet_link`, esa copia se **reemplaza** (mismo cruce). |
| `/tournament add_sheet` | Alta manual: **link + name**, o un **CSV** (nombre, link, sin headers; coma, `;` o tab) | Detecta formato y extra igual que add. Un link ya archivado se omite. |
| `/tournament get_sheet` | Lookup por nombre, o CSV de todo el archivo | Lectura. Autocomplete global. No audita. |
| `/tournament delete` | La config del torneo y sus partidos / salas / schedules / asistencias se borran | La sheet **pasa a histórico**. Sigue saliendo en `find_player` / `get_sheet` (global). |

La copia guarda link, formato, cuántos campos extra hay, el nombre del torneo, y el servidor de origen.

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

La hoja tiene que ser **visible con el link**. El bot lee **una fila por equipo** (también si Google la tiene como Tabla). Compara cada in-game ID (hex, ignorando espacios y caracteres invisibles) con la [lista oficial de baneados](https://docs.google.com/spreadsheets/d/17Xv8rF_UmKslmd_MBGiBf610xb2YleQJHivoc-6JqYU/edit?usp=sharing). Un solo ID de juego en la lista **bloquea** el alta o el cambio de hoja y lista a los jugadores. No se crea el torneo hasta que salgan de la **Google Sheet del `sheet_link`**.

`/utility discord_tag` existe para **arreglar la columna de tags**: pegas IDs, recibes usernames en el mismo orden.

## Durante el torneo

- `/team info` busca en **la hoja viva de un torneo** por usuario Discord o por ID/nombre de juego. Al final del V2 lista los **campos extra** de esa fila, usando los nombres de header de la hoja.
- `/team list` vuelca el roster (por la columna que elijas).
- `/assign_role` asigna un rol Discord a capitanes (por tag o por nombre in-game) y **cruza de nuevo** la lista de baneados: IDs inválidos, no están en el servidor, ya tenían el rol, o están baneados (usuario o ID de juego).

Un ban de Discord **no** es el cruce con la lista de IDs de juego baneados. Esa lista interviene al validar la hoja, al crear o cambiar la sheet de un torneo, y al asignar roles de torneo.

## `/tournament find_player`

Busca en **todas** las copies almacenadas del bot (activas, manuales e histórico, **cualquier servidor**). No es `/team info`.

Cuatro STRING libres, todos opcionales: ID de juego, ID de Discord, tag de Discord, nombre del jugador. **Al menos uno** obligatorio. Varios rellenos = **OR** (vale coincidir en cualquiera).

Agrupación: **un jugador distinto → un V2**. Misma persona en varias sheets → un V2, lista de esas sheets. El OR pegó a dos personas distintas → dos V2.

Cada V2 trae:

1. **Datos del capitán** del equipo (tag / Discord ID / in-game / current title). En `2vs2`, `3vs3`, `4vs4` y `5vs5` también el nombre de equipo. **Sin** campos extra.
2. **Lista de sheets** en las que ese jugador aparece: nombre del torneo, formato, origen, **servidor**, y el link.

Sin coincidencias: un V2 de vacío/error, no una lista hueca.

No audita (lectura). Comandos: [../commands/tournament.md](../commands/tournament.md).

## Relacionado

- Comandos de hoja viva: [../commands/sheet-teams.md](../commands/sheet-teams.md)
- Moderación: [moderation.md](moderation.md)
- Alta de torneo / add_sheet / get_sheet / find_player: [../commands/tournament.md](../commands/tournament.md)
