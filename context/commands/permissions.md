# Permisos — resumen

Fuente de actores: [../product/actors.md](../product/actors.md).

| Etiqueta en context | Significa |
|---|---|
| Admin | Administrator de Discord **o** `admin_role` de `/settings` |
| Organiser | `manager_role` de `/staff config` **o** Administrator |
| Discord Administrator | Solo el permiso nativo (recruit/fire, `clear_category`) |
| Manage Messages | Permiso nativo Discord (`/utility clear`, builders de embed y V2) |
| Manage Emojis | Permiso nativo Discord (`/utility emoji_steal`) |
| Staff de torneo | Roles judge/recorder/staff del servidor, o admin/helper del torneo |
| Público | Cualquier miembro, solo en servidor |

Jerarquía Discord siempre gana: el bot no puede asignar un rol por encima del suyo, ni un humano puede gestionar roles iguales o superiores al propio.

## `/schedule`

El rol se mira tal cual. Tener uno no abre los subcomandos de otro.

| Subcomando | Rol |
|---|---|
| `create` · `update` · `delete` | Admin o helper **de ese torneo** |
| `show` · `unassigned` | `staff_role` de `/staff config` |
| `refresh` | `judge_role` o `recorder_role` de `/staff config` |
| `results` · `results_delete` | `judge_role` de `/staff config` |
| `resign` | Solo quien está asignado a ese schedule |

El capitán no ejecuta ninguno. Detalle: [schedule.md](schedule.md).

## `/bracket`

| Subcomando | Rol |
|---|---|
| `upload` | Staff de torneo (o Organiser) |
| `correct` | Organiser |

Detalle: [rooms-bracket.md](rooms-bracket.md).

## `/attendance`, `/link`, `/get`

| Comando | Rol |
|---|---|
| `/attendance mark` | Judge, Recorder, Admin u Organiser. Solo en el ticket |
| `/attendance delete` | Quien marcó esa asistencia, Admin u Organiser. Solo en el ticket |
| `/attendance list` | La propia ficha: staff, judge, recorder, Admin u Organiser. La de otro: Admin u Organiser |
| `/get attendance` · `/link missing` | Staff, judge, recorder, Admin u Organiser |
| `/get sheet` | Organiser |
| `/link add` | Recorder de esa asistencia |
| `/link delete` | Recorder de esa asistencia, Admin u Organiser |

Detalle: [attendance.md](attendance.md).
