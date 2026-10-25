# Acceso a comandos

Única fuente de **quién puede usar cada comando** y de las **restricciones de acceso**. Manda sobre el código: si un checklist o una restricción cambian, el comando se alinea a ellos.

No describe marcadores, auditoría ni copy. Eso sigue en el dominio y en el archivo de la familia.

Todos los comandos solo corren **en un servidor** de `ALLOWED_GUILDS`. No se repite abajo.

## Cómo editar

Cada comando tiene un checklist. Márcalo o desmárcalo:

- `- [x]` tiene permiso
- `- [ ]` no tiene permiso

Un rol marcado no se hereda al de al lado. La lista de restricciones, debajo, afina el rol: no lo contradice. Si desmarcas un rol, ese actor deja de entrar.

## Roles

| Rol | Marcado significa |
|---|---|
| Admin | Rol `admin_role` de `/settings`, **o** el permiso Administrator de Discord. Si la restricción dice «admin del torneo», es el `admin_role` de **ese** torneo y el de `/settings` no cuenta. |
| Organiser | Rol `manager_role` de `/staff config`, **o** el permiso Administrator de Discord. |
| Helper | Rol `helper_role` de **ese** torneo. No es el Server Helper de `/staff recruit`. |
| Staff | Rol `staff_role` de `/staff config`. |
| Juez | Rol `judge_role`. |
| Grabador | Rol `recorder_role`. |
| Público | Cualquier miembro, sin depender de los roles de arriba. |

El permiso Administrator entra en **Admin** y en **Organiser**. El rol `admin_role` no es Organiser. El rol `manager_role` no es Admin.

## Bot

### `/bot ping`

- [x] Admin
- [x] Organiser
- [x] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

### `/bot about`

- [x] Admin
- [x] Organiser
- [x] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

### `/bot help`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

## Settings

### `/settings set`

- [ ] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Ningún rol marcado. Solo el permiso **Administrator** de Discord.
- El rol `admin_role` no abre este comando: todavía no existe.
- Si el servidor ya tiene settings, no se vuelve a usar.

### `/settings edit`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.

### `/settings show`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.

## Staff

### `/staff config set`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.
- Si la config de staff ya existe, no se vuelve a usar.

### `/staff config edit`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/staff config set` ya exista.

### `/staff config view`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/staff config set` ya exista.

### `/staff recruit`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin (`admin_role` o Administrator) u Organiser (`manager_role` o Administrator).
- La jerarquía de Discord gana: no asigna un rol por encima del bot ni del actor.

### `/staff fire`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin (`admin_role` o Administrator) u Organiser (`manager_role` o Administrator).
- La jerarquía de Discord gana.

### `/staff work`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.

## Tournament

### `/tournament add`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.

### `/tournament edit`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.

### `/tournament delete`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.

### `/tournament info`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

### `/tournament list`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

### `/tournament report`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.

### `/tournament role`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.
- Sin `id_header`, asignar a todo el roster pide confirmación. Cancelar no asigna nada.

### `/tournament validate`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.

## Sheet y equipos

### `/sheet add`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.

### `/sheet get`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

### `/sheet find_player`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

### `/sheet validate`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Hace falta que `/settings set` ya exista.

### `/team info`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [x] Público

Ninguna.

### `/team list`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.

## Salas y bracket

### `/auto_room`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.

### `/room create`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.

### `/room available`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.
- Pasar de página también exige Organiser.

### `/bracket upload`

- [x] Admin
- [x] Organiser
- [x] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket del partido.
- Admin aquí es el `admin_role` de **ese** torneo. El de `/settings` no cuenta.
- Helper es el `helper_role` de **ese** torneo.
- Organiser (`manager_role` o Administrator) también entra.

### `/bracket dq_both`

- [x] Admin
- [x] Organiser
- [x] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket del partido.
- Admin aquí es el `admin_role` de **ese** torneo. El de `/settings` no cuenta.
- Helper es el `helper_role` de **ese** torneo.
- Organiser (`manager_role` o Administrator) también entra.

### `/bracket correct`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.
- Cualquier canal. No exige estar en el ticket.
- Si el ganador cambia y hay tickets aguas abajo, Aceptar y Cancelar solo los pulsa quien lanzó el comando.

## Schedule

El capitán no ejecuta ningún `/schedule`. Tener un rol no abre los subcomandos de otro.

### `/schedule create`

- [x] Admin
- [x] Organiser
- [x] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket del partido.
- Admin aquí es el `admin_role` de **ese** torneo. El de `/settings` no cuenta.
- Helper es el `helper_role` de **ese** torneo.
- Organiser (`manager_role` o Administrator) también entra.
- Hace falta el canal de schedules de `/settings`.

### `/schedule update`

- [x] Admin
- [x] Organiser
- [x] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket del partido.
- Admin aquí es el `admin_role` de **ese** torneo. El de `/settings` no cuenta.
- Helper es el `helper_role` de **ese** torneo.
- Organiser (`manager_role` o Administrator) también entra.

### `/schedule show`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Cualquier canal.
- Admin (`admin_role` de `/settings` o Administrator), Organiser, Helper o `staff_role`.
- Helper es el `helper_role` de un torneo de este servidor.
- Juez y Grabador no entran por ese rol.
- Las flechas de página exigen el mismo acceso.

### `/schedule delete`

- [x] Admin
- [x] Organiser
- [x] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket del partido, y solo si ese ticket tiene schedule.
- Admin aquí es el `admin_role` de **ese** torneo. El de `/settings` no cuenta.
- Helper es el `helper_role` de **ese** torneo.
- Organiser (`manager_role` o Administrator) también entra.
- `confirm` en false no borra.

### `/schedule unassigned`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Cualquier canal.
- Admin (`admin_role` de `/settings` o Administrator), Organiser, Helper o `staff_role`.
- Helper es el `helper_role` de un torneo de este servidor.
- Juez y Grabador no entran por ese rol.

### `/schedule refresh`

- [ ] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [ ] Público

- Cualquier canal.
- Organiser, Helper, `staff_role`, Juez o Grabador. `admin_role` no entra. Administrator entra por Organiser.
- Helper es el `helper_role` de un torneo de este servidor.
- El botón de reclamar juez lo pulsa quien tiene `judge_role`; el de recorder, quien tiene `recorder_role`. Un puesto ocupado no se reclama.

### `/schedule resign`

- [ ] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket, y solo si ese ticket tiene schedule.
- Ningún rol marcado lo abre. Solo el usuario que está sentado como juez y/o recorder de **ese** schedule.
- Tener el rol sin estar asignado no basta. Dejar de tener el rol no quita la renuncia si sigue siendo esa persona.

### `/schedule results`

- [ ] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [x] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket, y solo si ese ticket tiene schedule.
- Solo `judge_role`. Estar asignado como juez de ese partido no sustituye el rol, ni al revés: no se mira el asiento.

### `/schedule results_delete`

- [ ] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [x] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket, y solo si ese ticket tiene schedule.
- Solo `judge_role`. No se mira el asiento.
- `confirm` en false no borra la declaración.

## Attendance

### `/attendance mark`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [x] Juez
- [x] Grabador
- [ ] Público

- Solo dentro del ticket.
- Admin es el de `/settings` (o Administrator), no el admin del torneo.
- Helper y Staff no entran por ese rol.
- Juez y Grabador entran con su rol, aunque no sean el juez o el recorder del schedule.

### `/attendance delete`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo dentro del ticket.
- Admin es el de `/settings` (o Administrator). Organiser también.
- Juez y Grabador no entran por el rol. También puede quien **marcó** esa asistencia.
- `confirm` en false no borra.

### `/attendance report`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [ ] Público

- Cualquier canal.
- La ficha propia: Staff, Juez, Grabador, Helper, Admin u Organiser.
- La ficha de otra persona: solo Admin u Organiser. Helper no abre la ficha de otra persona.
- Sin `user`, la ficha es la de quien ejecuta.

### `/get attendance`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [ ] Público

- Cualquier canal.
- Staff, Juez, Grabador, Helper, Admin u Organiser pueden consultar a cualquier usuario.
- El admin del torneo no entra por ese rol.

### `/get sheet`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- `admin_role` no entra. Administrator de Discord entra por Organiser.

### `/link add`

- [ ] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [x] Grabador
- [ ] Público

- Grabador solo si **es** el recorder guardado en esa asistencia. Otro grabador no puede.
- Además tiene que pasar el permiso de herramientas de asistencia (staff, juez, recorder, admin u organiser). El rol solo no basta si no es esa persona.
- Admin y Organiser no añaden links de una asistencia ajena.

### `/link delete`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [x] Grabador
- [ ] Público

- Grabador solo si es el recorder de esa asistencia.
- Admin (el de `/settings` o Administrator) y Organiser pueden borrar los links aunque no sean ese recorder.
- Staff y Juez no entran por el rol.

### `/link missing`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [ ] Público

- Cualquier canal.
- Staff, Juez, Grabador, Admin u Organiser.
- Helper y el admin del torneo no entran por ese rol.
- Con `user`, la lista es la de ese recorder. Sin `user`, la del torneo.

## Tickets

### `/ticket close`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.
- Solo en un canal que es ticket.

### `/ticket reopen`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.
- Solo en un canal que es ticket.

### `/ticket delete`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.
- Solo en un canal que es ticket.

## Roles

### `/role user`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.
- No toca `@everyone`, un rol de integración, ni un rol igual o superior al actor o al bot.
- El objetivo tiene que estar en el servidor. Tampoco se gestiona a alguien con rol igual o superior al propio.

### `/role add all`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Admin (`admin_role` o Administrator). `manager_role` no entra.
- No toca `@everyone`, un rol de integración, ni un rol igual o superior al actor o al bot.

### `/role remove all`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Admin (`admin_role` o Administrator). `manager_role` no entra.
- No toca `@everyone`, un rol de integración, ni un rol igual o superior al actor o al bot.

### `/role list`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.
- No lista `@everyone`.

## Server y usuario

### `/server info`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

### `/server banlist`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.

### `/server tree`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.

### `/server invites`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.

### `/user ban`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.
- No se banea a uno mismo, al owner, al bot ni a otros bots.
- Si el objetivo está en el servidor, la jerarquía de Discord gana.

### `/user unban`

- [ ] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Solo Organiser. `admin_role` no entra.

## Utility

### `/utility clear_category`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin (`admin_role` o Administrator). `manager_role` no entra.
- Sin la confirmación no se borra nada.

### `/utility clear`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin (`admin_role` o Administrator). `manager_role` no entra.
- Solo el canal donde se ejecuta.

### `/utility emoji_steal`

- [x] Admin
- [ ] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin (`admin_role` o Administrator). `manager_role` no entra.
- El emoji tiene que ser custom de **este** servidor.

### `/utility random`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [x] Público

Ninguna.

### `/utility utc`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [x] Público

Ninguna.

### `/utility discord_tag`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

Ninguna.

### `/utility avatar`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [x] Público

Ninguna.

### `/utility toss`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [x] Público

Ninguna.

### `/utility enlarge`

- [x] Admin
- [x] Organiser
- [x] Helper
- [x] Staff
- [x] Juez
- [x] Grabador
- [x] Público

Ninguna.

### `/utility embed`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin u Organiser.
- Solo publica o edita mensajes de este bot.

### `/utility edit_embed`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin u Organiser.
- Solo reescribe un embed de este bot.

### `/utility v2`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin u Organiser.
- Solo publica mensajes de este bot.

### `/utility edit_v2`

- [x] Admin
- [x] Organiser
- [ ] Helper
- [ ] Staff
- [ ] Juez
- [ ] Grabador
- [ ] Público

- Admin u Organiser.
- Solo reescribe un mensaje V2 de este bot.
