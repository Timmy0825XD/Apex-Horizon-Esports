# Staff (capa servidor — jerarquía, reclutamiento y nómina visual)

Actores: [../product/actors.md](../product/actors.md). Nómina: [../domains/attendance-payroll.md](../domains/attendance-payroll.md).

Slash: comando `staff`. Grupos `config` (`set` · `edit` · `view`) e `info` (`add` · `edit` · `export`), más subcomandos `recruit` · `fire` · `work`.

`config set` / `edit` / `view` son paneles **Components V2** con el mismo patrón que `/settings`:

- `### Roles` y `### Channels`, con etiquetas cortas (*Judge*, *Announcements*).
- `edit` dice cuántos valores cambiaron y marca esas líneas con *updated*.
- Si algo guardado ya no existe, una línea con `alert` arriba lo avisa.
- Footer `Saved by` / `Updated by` con hora; `view` enlaza `/staff config edit`. `recruit` y `fire` responden en V2; el welcome de recruit en staff chat también es V2 (mención + panel). `work` se publica en el canal: un Components V2.

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
| staff_details_channel | CHANNEL | Sí | Enlace en welcome y tarjetas de `/staff info` |

Canales: texto o announcement. Los paneles de `set` y `edit` llevan el **icono del bot** como thumbnail. Audita en bot_logs. No toca `/settings`.

Los roles se listan (slash `edit`/`view` y el panel) de arriba hacia abajo: Manager → T1 → T2 → Challonge Mod → Server Helper → Best Staff → Judge → Recorder → Staff. En `config set`, T1/T2 van al **final** porque Discord no permite opciones opcionales en medio de las requeridas.

## `/staff config edit`

Mismos campos, todos opcionales; al menos uno, y tiene que cambiar el valor guardado. Requiere set previo. Admin. Audita. El panel lleva el icono del bot como thumbnail.

## `/staff config view`

Solo lectura de la jerarquía (menciones; marca roles/canales que ya no existen; T1/T2 *Not configured* si faltan). No audita. Admin.

## `/staff info add`

**Para qué:** Directorio del staff con Discord ID, Discord Tag, Game ID y Game Name, para no tener que pedirlos cada vez.

Solo `staff_role`. Sin opciones: el slash abre un **modal** con dos campos, **Game ID** y **Game Name**. Discord ID y tag (username) los pone el bot desde quien ejecuta. Requiere `/staff config set`. Si la persona ya tiene registro, responde con error y enlaza `/staff info edit`; no abre el modal.

| Campo del modal | Regla |
|---|---|
| Game ID | Hex de **8–16** caracteres. Se quitan espacios y se guarda en mayúsculas (misma regla que `/sheet validate`). Único por servidor. |
| Game Name | 1–32 caracteres, texto libre. |

Al enviar: guarda el registro (`StaffInfo`, uno por persona y servidor), publica en `staff_details_channel` una tarjeta **Components V2** *Staff Member Info* (mención sin ping y avatar; bloques **Discord** (ID, tag) y **Game** (ID, nombre); **Staff Roles** con un rol por línea; pie con fechas) y guarda el id del mensaje. Responde **efímero** en V2 con lo guardado y dónde quedó la tarjeta. Si la tarjeta no se puede publicar, el registro se queda y la respuesta lo avisa. Audita (**Staff**, *Staff info registered*).

## `/staff info edit`

Solo `staff_role`, y solo su propia info. Mismo modal con los valores actuales precargados. Al menos un valor tiene que cambiar. Mismas reglas de Game ID y Game Name; el tag se refresca. **Reescribe** la tarjeta ya publicada; si la borraron, publica una nueva. Responde efímero. Audita (**Staff**, *Staff info updated*, valor viejo → nuevo).

## `/staff info export`

Solo Organiser. Lectura: no audita. Responde efímero con un V2 y un `.xlsx` (`staff-info-AAAA-MM-DD.xlsx`, hoja *Staff Info*, cabecera fija y autofiltro).

Columnas: # · Discord Tag · Discord ID · Game Name · Game ID · Staff Roles · Status · Registered · Updated. Tag y roles se leen de Discord **al exportar** (si la persona ya no está, se usa el tag guardado). Status: *Active* (tiene `staff_role`), *No staff role* o *Left server*. Orden: por Status y luego por tag. Si no hay registros, responde un V2 de info sin archivo.

`/staff fire` **no** borra el registro; el export lo marca por Status.

## `/staff recruit`

**Para qué:** Dar un **paquete de roles** y saludar en staff chat.

Admin u Organiser (`admin_role`, `manager_role` o Administrator). Audita. Jerarquía Discord gana (bot y actor por encima de los roles y del miembro).

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

Si el miembro ya tiene todo el paquete, no se vuelve a saludar. El welcome en staff chat es **Components V2**: un section con `## Welcome to the Family`, la mención (ping) con el puesto, los roles seguidos y la thumbnail de la persona. Debajo, **Start here** con announcements, rules y details, cada uno con su emoji. La respuesta V2 de recruit es **Staff Recruited**: *@miembro is now **Puesto***, los roles concedidos seguidos y la línea del welcome (publicado en el staff chat o por qué no). Lleva el avatar y el footer `Recruited by` con mención y hora. Fallar el welcome **no** deshace los roles.

## `/staff fire`

**Para qué:** Quitar un puesto o todos. Solo Discord. **No** borra asistencias históricas.

Solo Admin u Organiser. Audita.

| Campo | Tipo | Obligatorio |
|---|---|---|
| user | USER | Sí |
| role | STRING (Choice) | Sí |

Choices: Judge · Recorder · T1 Admin · T2 Admin · Best Staff · Server Helper · T1 Admin + Helper + Best Staff · T2 Admin + Helper + Best Staff · **Complete (remove all staff roles)** (todos los roles de staff configurados, incluido Manager y Challonge Mod).

Un choice suelto quita **ese** rol de puesto, no el paquete de recruit (p. ej. fire Judge no quita Staff). La respuesta V2 es roja, **Staff Removed**: *@miembro is no longer **Puesto*** (o *no longer on the staff* si es Complete), los roles quitados seguidos, el avatar y el footer `Removed by` con mención y hora (sin ping). Sin bloque Notes.

## `/staff work`

**Para qué:** Nómina visual del torneo. Se publica en el canal. No audita (consulta). Requiere `/settings set`. Admin, Organiser, Helper de un torneo o `staff_role`.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| tournament | STRING (Autocomplete) | Sí | Torneos de **este** servidor (valor = id interno) |
| include_default_wins | BOOLEAN | No | Incluir DW (default false) |

**Relación:** Lee asistencias no borradas de `/attendance mark`. Cubetas: [../domains/attendance-payroll.md](../domains/attendance-payroll.md).

Un Components V2. Encabezado: torneo y si incluye DW. Luego **Judges**, **Recorders** y **Judge & Recorder**, cada uno con su conteo en el título `###` y una lista numerada: mención, **matches** (asistencias) y **games** (`team1_score + team2_score`). Cada lista se corta a ~1200 caracteres para que las tres quepan en el mensaje. El footer es `Requested by` con hora. No muestra oro. La misma persona entra en Judge & Recorder aunque no haya link. Los DW no entran salvo `include_default_wins`.
