# Attendance y trabajo

Reglas: [../domains/attendance-payroll.md](../domains/attendance-payroll.md).

## `/attendance mark`

**Solo ticket.** Judge/Recorder (admin/organiser pueden saltarse).

| Campo | Tipo | Obligatorio |
|---|---|---|
| judge | USER | Sí |
| recorder | USER | Sí |
| team1_score | INTEGER | Sí |
| team2_score | INTEGER | Sí |
| remark | STRING (Autocomplete) | No | `DW` |
| link | STRING | No | YouTube |

Requiere schedule y hora alcanzada. Un activo por partido. Audita. Cuando se implemente, si ese partido ya tiene `/schedule results`, debe llamar `attachResultsLinks` con los links de la asistencia para refrescar **Links** en el ticket y en el canal de resultados.

## `/attendance delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

Creador u organiser. Soft-delete + embeds “deleted”. Audita.

## `/get attendance`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| user | USER | Sí |

Historial paginado (5). No audita.

## `/get sheet`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| tournament_type | STRING (Choice) | Sí | 1v1/2v2/3v3 (Per Match) · 4v4/5v5 (Per Game) |
| include_default_win_salary | BOOLEAN | Sí | |

Excel efímero. Organiser.

## `/link add`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| match | STRING (Autocomplete) | Sí |
| link | STRING | Sí |

Solo el recorder de esa asistencia. Máx. 7 YouTube. Puede postear en `events_links`. Audita. Cuando se implemente, debe llamar `attachResultsLinks` con la lista completa. `/link delete` llama lo mismo con la lista vacía.

## `/link delete`

Mismos `tournament` + `match`. Borra **todos** los links y los posts del canal de events. Audita.

## `/link missing`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | No |

Sin torneo: los del invocador. Con torneo: todos + antigüedad.

## `/work_done`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| user | USER | Sí |
| tournament_type | STRING (Choice) | Sí |

Ficha individual. Relación: mismas reglas de cubetas y DW que `/staff work`.
