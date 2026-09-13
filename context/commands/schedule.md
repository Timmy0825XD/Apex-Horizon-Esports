# Schedule

Reglas: [../domains/schedules.md](../domains/schedules.md). Todos los de creación/cambio **excepto show / unassigned** se auditan.

## `/schedule create`

**Solo ticket.** Requiere canal de schedules.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| hour | INTEGER | Sí | UTC |
| minute | INTEGER | Sí | UTC |
| day | INTEGER | Sí | |
| month | INTEGER | Sí | |
| year | INTEGER | Sí | |
| judge | USER | No | Preasignar |
| recorder | USER | No | Preasignar |
| remark | STRING | No | Máx. 130 |

Mínimo +10 minutos. Marca `🔴`. Relación: attendance, results, worker T-10/T-0, thumbnails de settings.

## `/schedule update`

Mismos trozos de fecha/hora (opcionales) + `judge`, `recorder`, `note`, `remove_judge`, `remove_recorder`, `reason`, `regenerate_image`. Al menos un campo. Recalendarizar resetea recordatorios.

## `/schedule show`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| match | STRING (Autocomplete) | Sí |

Vista efímera del embed. No audita.

## `/schedule delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

`confirm=False` cancela. Quita `🔴`.

## `/schedule unassigned`

| Campo | Tipo | Obligatorio |
|---|---|---|
| filter | STRING (Choice) | Depende de implementación | `all` · `missing_judge` · `missing_recorder` · `any` |

Consulta. Alimenta reclutamiento de staff de mesa.

## `/schedule refresh`

Renueva botones y enlace del post. No cambia la hora.

## `/schedule resign`

**Solo ticket, solo el asignado.**

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | STRING (Choice) | No | Judge · Recorder · Both |
| reason | STRING | No | `.` si es privado |
| regenerate_image | BOOLEAN | No | |

## `/schedule results`

**Solo ticket.** Hora ya pasada. No empate. Una declaración por schedule.

| Campo | Tipo | Obligatorio |
|---|---|---|
| team_1_score | INTEGER | Sí | 0–99 |
| team_2_score | INTEGER | Sí | 0–99 |
| notes | STRING | No | Máx. 500 |
| image1 … image10 | ATTACHMENT | Al menos una | Pruebas |

Publica en `result_channel` del torneo. No sube el bracket. Relación: `/upload_score` (paso siguiente), `/schedule results_delete`.

## `/schedule results_delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

No borra el schedule.
