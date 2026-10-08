# Asistencia, links y pago

La asistencia es el **libro de trabajo del staff**, no el acta del bracket.

## Marcar asistencia

- Solo dentro del ticket.
- Debe existir schedule y la hora ya debe haber llegado.
- Un ticket solo puede tener una asistencia activa. Es la de ese partido.
- Judge y Recorder deben tener esos roles.
- `remark = DW` (default win / DQ) es un atajo de autocomplete.
- Un link de YouTube opcional cuenta como el primero de **hasta 7**.

Se publica **el mismo aviso** en el ticket y en el canal de asistencia del torneo. Al cambiar links se reescriben los dos. Al borrar la asistencia se quitan los dos, y el comando responde en el canal con `Attendance Deleted`.

**Métrica:** 1 asistencia = 1 **round**. **Matches** = `team1_score + team2_score`.

No hay “editar asistencia”. Se **borra en suave** (queda marca de borrado y motivo) y se vuelve a marcar.

## Links

Solo el **recorder de esa asistencia** añade links (YouTube, máximo 7). El recorder, un admin o un organiser puede borrar **todos** los links de golpe. Si no hay ninguno, no se borra nada. Si el torneo tiene canal `events_links`, cada alta publica un texto con el partido, el marcador y los links, sin el nombre del torneo, y guarda el id; al borrar links se borran esos posts.

`/link missing` exige torneo. Por defecto lista todas las pendientes de ese torneo. `user` opcional deja solo las de ese recorder. Un partido marcado `DW` no exige link y no sale en esa lista.

## Cómo se clasifica el trabajo (y el oro)

Cada asistencia cae en una de tres cubetas:

| Situación | Cubeta |
|---|---|
| Judge y Recorder son personas distintas | Judge en una, Recorder en otra |
| La misma persona | **Judge & Recorder** (dual) |

El link no cambia el salario. Recorder cobra su tarifa y la misma persona cobra dual aunque no haya YouTube.

`/attendance list` incluye los DW siempre. `/staff work` y `/get sheet` los omiten salvo `include_default_wins` o `include_default_win_salary`.

| Formato | Judge | Recorder | Dual (misma persona) |
|---|---|---|---|
| 1v1 / 2v2 / 3v3 (por partido) | 450 gold | 450 gold | 575 gold |
| 4v4 / 5v5 (por game) | 325 × games | 325 × games | 425 × games |

`games` es `team1_score + team2_score`. `/attendance list` y `/get sheet` toman la tabla del formato guardado del torneo. ArtCoin = gold / 10.

## Superficies de nómina

| Comando | Qué es |
|---|---|
| `/attendance list` | Ficha de **una persona**. La tabla sale del formato del torneo e incluye los DW |
| `/staff work` | Tablero del torneo: matches y rounds por persona. No muestra oro |
| `/get sheet` | Excel. La tarifa sale del formato guardado del torneo, no de `tournament_type` |

Se paga y se evalúa a partir de la **asistencia**, no del bracket.

## Relacionado

- Schedules: [schedules.md](schedules.md)
- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Comandos: [../commands/attendance.md](../commands/attendance.md), [../commands/staff.md](../commands/staff.md)
