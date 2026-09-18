# Sheet y equipos

Reglas: [../domains/sheet.md](../domains/sheet.md).

## `/sheet headers`

| Campo | Tipo | Obligatorio |
|---|---|---|
| format | STRING (Choice) | Sí |

Choices: `1vs1`, `2vs2`, `3vs3`, `4vs4`, `5vs5`, `all`. Público. Relación: contrato de columnas para validate, tournament add, team, assign_role.

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
| gameid_username | STRING | No* |

\*Uno de los dos. Relación: hoja **viva** de ese torneo. Para buscar en **todas** las copias almacenadas: `/tournament find_player`.

## `/team list`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| header | STRING (Choice) | Sí |

Choices: Captain Discord Tag · Captain Discord ID · Captain In-game name · Captain In-game ID.

## `/assign_role`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| header | STRING (Choice) | Sí |
| role | ROLE | Sí |
| banned_role | ROLE | No |

Choices de header: Captain Discord Tag · Captain In-game name. Cruza lista de baneados. Audita.
