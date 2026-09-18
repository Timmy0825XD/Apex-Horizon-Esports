# Staff (capa servidor — jerarquía, reclutamiento y nómina visual)

Actores: [../product/actors.md](../product/actors.md). Nómina: [../domains/attendance-payroll.md](../domains/attendance-payroll.md).

Slash: comando `staff`. Grupo `config` (`set` · `edit` · `view`) más subcomandos `recruit` · `fire` · `work`.

`config set` / `edit` / `view` son paneles **Components V2**. `recruit` y `fire` responden en V2; el welcome de recruit en staff chat también es V2 (mención + panel). `work` es efímero: tres embeds clásicos + `.txt` de degradaciones si aplica.

Requiere `/settings set` previo (admin role y bot logs). T1/T2 son opcionales; en `config set` Discord obliga a ponerlos **al final** de las opciones.

## `/staff config set`

**Para qué:** Definir roles operativos y canales de coordinación. El canal público de schedules vive en `/settings` (`schedules_channel`).

Admin (Administrator de Discord **o** `admin_role`). Si ya hay config, usar `edit`.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| manager_role | ROLE | Sí | **Organiser** (salas, tickets, roles, bans) |
| t1_admin_role | ROLE | No | Admin tier 1 |
| t2_admin_role | ROLE | No | Admin tier 2 |
| challonge_mod | ROLE | Sí | Acciones de bracket |
| server_helper_role | ROLE | Sí | Helper de servidor |
| best_staff_role | ROLE | Sí | Reconocimiento |
| judge_role | ROLE | Sí | Jueces y validación de asistencia |
| recorder_role | ROLE | Sí | Recorders y dueños de links |
| staff_role | ROLE | Sí | Staff general |
| staffchat_channel | CHANNEL | Sí | Bienvenida al reclutar |
| staff_announcement_channel | CHANNEL | Sí | Enlace en welcome |
| staff_rules_channel | CHANNEL | Sí | Enlace en welcome |
| staff_details_channel | CHANNEL | Sí | Enlace en welcome |

Canales: texto o announcement. Los paneles de `set` y `edit` llevan el **icono del bot** como thumbnail. Audita en bot_logs. No toca `/settings`.

Los roles se listan (slash `edit`/`view` y el panel) de arriba hacia abajo: Manager → T1 → T2 → Challonge Mod → Server Helper → Best Staff → Judge → Recorder → Staff. En `config set`, T1/T2 van al **final** porque Discord no permite opciones opcionales en medio de las requeridas.

## `/staff config edit`

Mismos campos, todos opcionales; al menos uno, y tiene que cambiar el valor guardado. Requiere set previo. Admin. Audita. El panel lleva el icono del bot como thumbnail.

## `/staff config view`

Solo lectura de la jerarquía (menciones; marca roles/canales que ya no existen; T1/T2 *Not configured* si faltan). No audita. Admin.

## `/staff recruit`

**Para qué:** Dar un **paquete de roles** y saludar en staff chat.

Solo Administrator de Discord. Audita. Jerarquía Discord gana (bot y actor por encima de los roles y del miembro).

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
| Judge + Recorder | Judge + Recorder + Staff |
| T1 Admin + Helper + Best Staff | T1 + Server Helper + Best Staff + Staff |
| T2 Admin + Helper + Best Staff | T2 + Server Helper + Best Staff + Staff |

Si el miembro ya tiene todo el paquete, no se vuelve a saludar. El welcome en staff chat es **Components V2**: arriba `Welcome to the family` con mención (ping), thumbnail de la persona, roles en lista y enlaces a announcements / rules / details. La respuesta V2 de recruit es **Staff Recruitment Updated**: Target, Granted Position, Roles Granted, y footer `-# Action by` con el username de quien ejecutó (sin mención). Fallar el welcome **no** deshace los roles.

## `/staff fire`

**Para qué:** Quitar un puesto o todos. Solo Discord. **No** borra asistencias históricas.

Solo Administrator de Discord. Audita.

| Campo | Tipo | Obligatorio |
|---|---|---|
| user | USER | Sí |
| role | STRING (Choice) | Sí |

Choices: Judge · Recorder · T1 Admin · T2 Admin · Best Staff · Server Helper · T1 Admin + Helper + Best Staff · T2 Admin + Helper + Best Staff · **Complete (remove all staff roles)** (todos los roles de staff configurados, incluido Manager y Challonge Mod).

Un choice suelto quita **ese** rol de puesto, no el paquete de recruit (p. ej. fire Judge no quita Staff). La respuesta V2 es **Staff Removal Updated**: Target, Removed Position (`All Staff Roles` si Complete), Roles Removed, footer `-# Action by` (sin ping). Sin bloque Notes.

## `/staff work`

**Para qué:** Nómina visual del torneo. Efímero. No audita (consulta). Admin.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| tournament | STRING (Autocomplete) | Sí | Torneos de **este** servidor (valor = id interno) |
| include_default_wins | BOOLEAN | No | Incluir DW (default false) |

**Relación:** Lee asistencias no borradas de `/attendance mark`. Cubetas: [../domains/attendance-payroll.md](../domains/attendance-payroll.md).

Tres embeds: **Judges** / **Recorders** / **Dual**. Por persona: mención, rounds, matches (`team1_score + team2_score`), gold. Gold usa tarifas 1v1–3v3 por evento (450 / 450 / 575) mientras el torneo no guarde formato. El `.txt` de degradaciones (misma persona sin link, contada como Judge) solo se adjunta aquí si hay filas.
