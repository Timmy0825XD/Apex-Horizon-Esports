# Schedule

Reglas: [../domains/schedules.md](../domains/schedules.md). Todos los de creación/cambio **excepto show / unassigned** se auditan.

Toda la familia responde con **embeds clásicos**, publicados en el canal. Ningún mensaje de este flujo es efímero. El capitán no ejecuta ningún subcomando.

| Subcomando | Quién |
|---|---|
| `create` · `update` · `delete` | Rol **admin** o **helper** de ese torneo |
| `show` · `unassigned` · `refresh` | Rol **staff** del servidor (`/staff config`) |
| `results` · `results_delete` | Rol **judge** del servidor |
| `resign` | Solo quien está asignado a ese schedule, dentro del ticket |

## `/schedule create`

**Solo ticket.** Admin o helper del torneo. Requiere canal de schedules.

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

Mínimo +10 minutos. Marca `🔴`. Admin o helper del torneo. Relación: attendance, results, worker T-10/T-0, thumbnails de settings.

## `/schedule update`

**Solo ticket.** Admin o helper del torneo. Mismos trozos de fecha/hora (opcionales) + `judge`, `recorder`, `note`, `remove_judge`, `remove_recorder`, `reason`, `regenerate_image`. Al menos un campo. Recalendarizar resetea recordatorios. `regenerate_image` vuelve a aplicar el fondo ya asignado a ese schedule sobre el embed y el post del canal de thumbnails. No avanza la rotación.

## `/schedule show`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| match | STRING (Autocomplete) | Sí |

Embed publicado en el canal. Rol staff. No audita.

## `/schedule delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

`confirm=False` cancela. Quita `🔴`. Admin o helper del torneo.

## `/schedule unassigned`

| Campo | Tipo | Obligatorio |
|---|---|---|
| filter | STRING (Choice) | Depende de implementación | `all` · `missing_judge` · `missing_recorder` · `any` |

Consulta. Rol staff. Alimenta reclutamiento de staff de mesa.

## `/schedule refresh`

**Solo ticket.** Rol staff. Renueva botones y enlace del post. No cambia la hora.

## `/schedule resign`

**Solo ticket, solo el asignado.**

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | STRING (Choice) | No | Judge · Recorder · Both |
| reason | STRING | No | `.` si es privado |
| regenerate_image | BOOLEAN | No | Reaplica el fondo ya asignado |

## `/schedule results`

**Solo ticket.** Rol judge. Hora ya pasada. No empate. Una declaración por schedule. El capitán no declara.

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

Rol judge. No borra el schedule.
