# Staff (capa servidor — jerarquía, reclutamiento y nómina visual)

Actores: [../product/actors.md](../product/actors.md). Nómina: [../domains/attendance-payroll.md](../domains/attendance-payroll.md).

## `/staff config set`

**Para qué:** Definir roles operativos y canales de coordinación. Sin `schedule_channel` no hay `/schedule create`.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| staff_role | ROLE | Sí | Staff general |
| judge_role | ROLE | Sí | Jueces y validación de asistencia |
| recorder_role | ROLE | Sí | Recorders y dueños de links |
| t1_admin_role | ROLE | No | Admin tier 1 |
| t2_admin_role | ROLE | No | Admin tier 2 |
| best_staff_role | ROLE | Sí | Reconocimiento |
| server_helper_role | ROLE | Sí | Helper de servidor |
| manager_role | ROLE | Sí | **Organiser** (salas, tickets, roles, bans) |
| challonge_mod | ROLE | Sí | Acciones de bracket |
| schedule_channel | CHANNEL | Sí | Publicación de horarios y urgencias T-0 |
| staffchat_channel | CHANNEL | Sí | Bienvenida al reclutar |
| staff_announcement_channel | CHANNEL | Sí | Enlace en welcome |
| staff_instructions_channel | CHANNEL | Sí | Enlace en welcome |
| staff_details_channel | CHANNEL | Sí | Enlace en welcome |

Audita en bot_logs. No toca `/settings`.

## `/staff config edit`

Mismos campos, todos opcionales; al menos uno. Requiere set previo. Audita.

## `/staff config view`

Solo lectura de la jerarquía. No audita.

## `/staff recruit`

**Para qué:** Dar un **paquete de roles** y saludar en staff chat.

| Campo | Tipo | Obligatorio |
|---|---|---|
| user | USER | Sí |
| role | STRING (Choice) | Sí |

Choices y roles que **añade**:

| Choice | Roles |
|---|---|
| Judge | Judge + Staff |
| Recorder | Recorder + Staff |
| T1 Admin | T1 + Server Helper + Staff |
| T2 Admin | T2 + Server Helper + Staff |
| Best Staff | Best Staff |
| Server Helper | Server Helper + Staff |
| Manager | Manager + Staff |

Solo Administrator de Discord. Audita.

## `/staff fire`

**Para qué:** Quitar un puesto o todos.

| Campo | Tipo | Obligatorio |
|---|---|---|
| user | USER | Sí |
| role | STRING (Choice) | Sí |

Choices: Judge · Recorder · T1 Admin · T2 Admin · Best Staff · Server Helper · T1 Admin + Helper + Best Staff · T2 Admin + Helper + Best Staff · **Complete** (todos los roles de staff configurados).

Audita. No borra asistencias históricas.

## `/staff work`

**Para qué:** Nómina visual del torneo (tres embeds: Judges / Recorders / Dual).

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| tournament | STRING (Autocomplete) | Sí | Torneo |
| include_default_wins | BOOLEAN | No | Incluir DW (default false) |

**Relación:** Lee `/attendance mark`. El `.txt` de descuentos es solo aquí. No audita (consulta).
