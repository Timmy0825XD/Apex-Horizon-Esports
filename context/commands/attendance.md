# Attendance y trabajo

Reglas: [../domains/attendance-payroll.md](../domains/attendance-payroll.md).

## `/attendance mark`

**Solo ticket.** Judge o Recorder (admin/organiser pueden saltarse). El judge y el recorder elegidos tienen que ser miembros y tener ese rol.

| Campo | Tipo | Obligatorio |
|---|---|---|
| judge | USER | Sí |
| recorder | USER | Sí |
| team1_score | INTEGER | Sí |
| team2_score | INTEGER | Sí |
| remark | STRING (Autocomplete) | No | `DW` |
| link | STRING | No | YouTube, varias URLs separadas por espacios |

Requiere schedule y hora alcanzada. Un activo por partido. Empate permitido. El mismo Components V2 queda en el ticket y en el canal de asistencia, sin thumbnail. Debajo del título van el marcador y **Tournament:**. Un separador, y después **Judge**, **Recorder** y **Channel**, cada etiqueta con su emoji y el valor en la línea siguiente. El footer es `Uploaded by` con mención y la fecha y hora. `Recording Link` solo entra si hay URLs. `Remark` solo si es `DW`. Si hay links y el torneo tiene `events_links`, publica un texto con partido, marcador y links, sin el nombre del torneo, y guarda su id. La respuesta del slash se borra. Audita `Attendance Marked`. Si el partido ya tiene `/schedule results`, llama `attachResultsLinks` con esos links.

## `/attendance delete`

**Solo ticket.**

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

Creador, admin u organiser. `confirm` tiene que ser true. Soft-delete de todas las activas de ese ticket. Se borran el aviso del ticket y el del canal de asistencia. Los posts de `events_links` no se tocan. La respuesta del comando, en el canal, es el Components V2 rojo `Attendance Deleted`. Los errores siguen efímeros. Llama `attachResultsLinks` con la lista vacía. Audita `Attendance Deleted`.

## `/attendance list`

Ficha de **una persona**. Sustituye a `/work_done` y usa la misma lectura: no escribe pago.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| user | USER | No | Por defecto, quien ejecuta |

La propia ficha: staff, judge, recorder, admin u organiser. La de otro: solo admin u organiser. Cualquier canal. Respuesta pública. Incluye los DW. La tarifa sale del formato guardado del torneo (`4vs4`/`5vs5` por game, el resto por partido; sin formato, por partido). Empieza en ArtCoin. Components V2 con acento amarillo neón: botones **GOLD** y **AC**, separador, título grande con `stats` y el avatar, torneo y tipo en una línea, **Judge** y **Recorder** con su emoji y la cifra al lado, **Both Roles**, separador y **Total** con el emoji de la moneda elegida. Los botones duran 2 minutos. No audita.

## `/get attendance`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| user | USER | Sí |

Staff, judge, recorder, admin u organiser. Historial público, 5 por página, botones 2 minutos. Incluye DW. Un `DW` sin link se muestra como no obligatorio. En el resto, faltar el link no cambia el salario. No audita.

## `/get sheet`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| tournament_type | STRING (Choice) | Sí |
| include_default_win_salary | BOOLEAN | Sí |

Excel efímero. Organiser. `tournament_type` no cambia la tarifa: el libro usa el formato guardado del torneo (4vs4/5vs5 por game, el resto por partido; si no hay formato, `2vs2`). `include_default_win_salary` sí filtra las filas `DW`. Hojas: Attendance Records, Work Count, Salary Estimate, Tournament Info. No audita.

## `/link add`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| match | STRING (Autocomplete) | Sí |
| link | STRING | Sí |

Solo el recorder de esa asistencia, y con permiso de herramientas de asistencia. Máx. 7 YouTube en total. Rechaza URLs inválidas, duplicados exactos y una lista vacía. Reescribe los dos V2, publica en `events_links` solo las URLs nuevas y guarda ese message id. Llama `attachResultsLinks` con la lista completa. Respuesta pública. Audita `Recording Links Added`.

## `/link delete`

Mismos `tournament` + `match`. Recorder de esa asistencia, admin u organiser. Si no hay links, no borra nada y responde con un Components V2 de aviso. Si hay, vacía todos, reescribe los dos V2 sin la línea de recording, borra los posts guardados de `events_links` y llama `attachResultsLinks` con la lista vacía. La respuesta es un Components V2 rojo con el conteo, el torneo y el partido. Audita `Recording Links Deleted` solo cuando sí borra.

## `/link missing`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| user | USER | No | Solo los pendientes de esa persona (el recorder) |

Staff, judge, recorder, admin u organiser. Por defecto lista todas las asistencias activas del torneo sin ningún link. Con `user`, solo las de ese recorder. Los partidos `DW` no entran: el link no es obligatorio. Components V2 naranja: torneo, conteo, un separador y después cada partido con emoji `vs`, recorder (mención y tag), fecha relativa y estado `Awaiting Link`. Las más recientes primero. 10 por página, botones 2 minutos. No audita.
