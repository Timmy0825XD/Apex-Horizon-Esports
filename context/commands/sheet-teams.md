# Sheet y equipos

Reglas: [../domains/sheet.md](../domains/sheet.md).

## `/sheet headers`

| Campo | Tipo | Obligatorio |
|---|---|---|
| format | STRING (Choice) | Sí |

Choices: `1vs1`, `2vs2`, `3vs3`, `4vs4`, `5vs5`, `all`. Público. Relación: contrato de columnas para validate, tournament add, team, `/tournament role`.

## `/sheet validate`

| Campo | Tipo | Obligatorio |
|---|---|---|
| sheet_link | STRING | Sí |

Admin. Previo a crear torneo. Relación: `/utility discord_tag` para corregir tags.

## `/utility discord_tag`

| Campo | Tipo | Obligatorio |
|---|---|---|
| ids | STRING | Sí |

Público. Salida efímera, un username por línea.

## `/team info`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| user | USER | No* |
| alias | STRING | No* |

\*Al menos uno. Si van los dos, la fila tiene que coincidir en **ambos**. **Organiser**. Lectura de la hoja **viva** de Google de ese torneo (no la copia en BD). No audita.

Busca en **cualquier jugador** de la fila. `user` coincide por Discord ID. `alias` coincide por **game ID**, **in-game name** o **Discord ID** (el bot clasifica el texto: snowflake → Discord ID, hex 8–16 → game ID, si no → nombre; nombre exacto primero, si no contiene con ≥ 3 caracteres).

Un V2 por equipo coincidente. El **título es el nombre del equipo** (sin thumbnail del container). Cada jugador va en su propio **Section** con el avatar de Discord como thumbnail: Discord Tag, Discord ID, Game Name, Game ID, Title (emoji `hero` / `legend` si el título contiene *hero* o *legend*), y **Verification al final**. Verification: **success + In server** si está en el servidor **y** tiene el `verified_role` de `/settings`; **banned + Banned** si está baneado del servidor; si está pero sin el rol, *Not verified*; si no está, *Not in server*. En `2vs2`…`5vs5` el nombre de equipo es el título. Los campos extra van **al final**, con el nombre de cada header. Footer: `-# Requested by` con `formatUser`. Varios equipos → varios V2 (máximo 5 + aviso). Sin coincidencias: V2 de vacío. En Discord **no** menciona la hoja ni `/tournament find_player`.

## `/team list`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |

**Organiser**. Lectura de la hoja **viva**. Publica **en el canal** (no efímero) un V2 por cada equipo o participante, el mismo panel que `/team info` (sin *Matched by*), de forma sucesiva hasta completar todos. No audita. En Discord **no** menciona la hoja.
