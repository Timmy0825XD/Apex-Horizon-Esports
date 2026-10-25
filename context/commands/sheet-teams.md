# Sheet y equipos

Reglas: [../domains/sheet.md](../domains/sheet.md).

## `/sheet add`

**Para qué:** Meter una hoja al archivo **global** del bot, sin crear un torneo operable. Detecta formato y extra igual que `/tournament add`. Admin. Audita.

Tres campos, todos opcionales; se elige **un** modo:

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| link | STRING | No* | URL de la hoja |
| name | STRING | No* | Nombre del torneo (etiqueta en el archivo) |
| csv | ATTACHMENT | No* | Varias hojas a la vez |

\*Una hoja: **link** y **name** van juntos y son obligatorios. Varias hojas: solo **csv**. No mezclar CSV con link/name.

CSV: columna 1 = nombre del torneo, columna 2 = URL de la Google Sheet. **Sin fila de headers**; se lee desde la fila 1. Acepta coma, punto y coma (Excel en español) o tab. Máximo 40 filas. Filas vacías se ignoran. Un link que ya está en el archivo global se omite.

La copia guarda el servidor de origen (`guildId` + nombre) para mostrarlo en `find_player` y `get`, pero el pozo de búsqueda es de **todo el bot**.

## `/sheet get`

**Para qué:** Recuperar el link de una hoja archivada por **nombre de torneo**, o exportar el catálogo entero. Lectura; no audita. Admin u Organiser; respuesta efímera.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| name | STRING (Autocomplete) | No* | Nombre en el archivo global |
| csv | BOOLEAN | No* | CSV de todos los torneos + links |

\*Al menos uno. Se pueden usar los dos a la vez.

Autocomplete lista las sheets almacenadas de **todo el bot** (nombre · servidor). El valor interno es el id de la copia. Si el texto no es un id, busca por nombre (exacto primero, si no contiene). Varias coincidencias → varias líneas, cada una con servidor y `[Click Here](url)`.

CSV: columnas `Tournament,Sheet,Server` (con header). Incluye activas, manuales e históricas. Archivo `tournament-sheets.csv`.

## `/sheet find_player`

**Para qué:** Buscar una persona en **todas** las sheets almacenadas del bot (cualquier servidor). Lectura; no audita. Relación: distinto de `/team info` (ese mira la hoja **viva** de un torneo). Admin u Organiser; respuesta efímera.

| Campo | Tipo | Obligatorio |
|---|---|---|
| game_id | STRING | No* |
| discord_id | STRING | No* |
| discord_tag | STRING | No* |
| player_name | STRING | No* |

\*Al menos uno. Varios rellenos = **OR**.

Un V2 **por jugador distinto**: datos del capitán (y nombre de equipo si no es 1vs1) + lista de sheets. Cada sheet enseña **el servidor** al que pertenece. Los campos extra de la hoja **no** entran aquí. Varios jugadores → varios V2, cada uno con copy de *ese* jugador.

## `/sheet validate`

| Campo | Tipo | Obligatorio |
|---|---|---|
| sheet_link | STRING | Sí |

Admin u Organiser. Previo a crear torneo. Efímero. No archiva la hoja y no audita. Relación: `/utility discord_tag` para corregir tags, `/tournament add` para registrar después.

Recorre cada jugador de la hoja viva y aplica las comprobaciones de [../domains/sheet.md](../domains/sheet.md). Si algo falla, un V2 de resumen y un V2 por tipo de fallo. Si pasa, indica que se puede registrar con `/tournament add`.

## `/utility discord_tag`

| Campo | Tipo | Obligatorio |
|---|---|---|
| ids | STRING | Sí |

Admin u Organiser. Salida efímera, un username por línea.

## `/team info`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| user | USER | No* |
| alias | STRING | No* |

\*Al menos uno. Si van los dos, la fila tiene que coincidir en **ambos**. Cualquier miembro. Lectura de la hoja **viva** de Google de ese torneo (no la copia en BD). No audita.

Busca en **cualquier jugador** de la fila. `user` coincide por Discord ID. `alias` coincide por **game ID**, **in-game name** o **Discord ID** (el bot clasifica el texto: snowflake → Discord ID, hex 8–16 → game ID, si no → nombre; nombre exacto primero, si no contiene con ≥ 3 caracteres).

Un V2 por equipo coincidente. El **título es el nombre del equipo** (sin thumbnail del container). Cada jugador va en su propio **Section** con el avatar de Discord como thumbnail: Discord Tag, Discord ID, Game Name, Game ID, Title (emoji `hero` / `legend` si el título contiene *hero* o *legend*), y **Verification al final**. Verification: **success + In server** si está en el servidor **y** tiene el `verified_role` de `/settings`; **banned + Banned** si está baneado del servidor; si está pero sin el rol, *Not verified*; si no está, *Not in server*. En `2vs2`…`5vs5` el nombre de equipo es el título. Los campos extra van **al final**, con el nombre de cada header. Footer: `-# Requested by` con `formatUser`. Varios equipos → varios V2 (máximo 5 + aviso). Sin coincidencias: V2 de vacío. En Discord **no** menciona la hoja ni `/sheet find_player`.

## `/team list`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |

**Organiser**. Lectura de la hoja **viva**. Publica **en el canal** (no efímero) un V2 por cada equipo o participante, el mismo panel que `/team info` (sin *Matched by*), de forma sucesiva hasta completar todos. No audita. En Discord **no** menciona la hoja.
