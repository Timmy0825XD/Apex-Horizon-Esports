# Asistencia, links y pago

La asistencia es el **libro de trabajo del staff**, no el acta del bracket.

## Marcar asistencia

- Solo dentro del ticket.
- Debe existir schedule y la hora ya debe haber llegado.
- No puede haber otra asistencia activa de ese partido.
- Judge y Recorder deben tener esos roles.
- `remark = DW` (default win / DQ) es un atajo de autocomplete.
- Un link de YouTube opcional cuenta como el primero de **hasta 7**.

Se publica **el mismo embed** en el ticket y en el canal de asistencia del torneo. Esos dos mensajes se mantienen sincronizados cuando se borra la asistencia o se cambian links.

**Métrica:** 1 asistencia = 1 **round**. **Matches** = `team1_score + team2_score`.

No hay “editar asistencia”. Se **borra en suave** (queda marca de borrado y motivo) y se vuelve a marcar.

## Links

Solo el **recorder de esa asistencia** añade links (YouTube, máximo 7). Organiser/admin puede borrar **todos** los links de golpe. Si el torneo tiene canal `events_links`, cada alta publica un resumen en texto; al borrar links se limpian esos posts del partido.

`/link missing` sin torneo: “mis grabaciones pendientes”. Con torneo: todas las pendientes + días desde que se marcó.

## Cómo se clasifica el trabajo (y el oro)

Cada asistencia cae en una de tres cubetas:

| Situación | Cubeta |
|---|---|
| Judge y Recorder son personas distintas | Judge en una, Recorder en otra |
| La misma persona + **al menos un** YouTube | **Judge & Recorder** (dual) |
| La misma persona **sin** link | Solo **Judge** (el dual se degrada) |

El sueldo de Recorder y el dual **exigen** link. DW **no entra** en estadísticas de pago salvo que se pida explícitamente (`include_default_wins` / `include_default_win_salary`).

| Formato | Judge | Recorder | Dual (misma persona + link) |
|---|---|---|---|
| 1v1 / 2v2 / 3v3 (por evento) | 450 gold | 450 gold | 575 gold |
| 4v4 / 5v5 (por partida) | 325 gold | 325 gold | 425 gold |

## Superficies de nómina

| Comando | Qué es |
|---|---|
| `/work_done` | Ficha de **una persona** |
| `/staff work` | Tablero del torneo (tres embeds: Judges / Recorders / Dual) |
| `/get sheet` | Excel (registros, conteos, estimación de salario, ficha del torneo) |

El `.txt` de degradaciones por falta de link solo lo ve el admin en `/staff work`.

Se paga y se evalúa a partir de la **asistencia**, no del bracket.

## Relacionado

- Schedules: [schedules.md](schedules.md)
- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Comandos: [../commands/attendance.md](../commands/attendance.md), [../commands/staff.md](../commands/staff.md)
