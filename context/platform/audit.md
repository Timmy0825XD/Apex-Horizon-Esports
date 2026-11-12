# Auditoría y logs

Estos logs son **acciones que el bot ejecuta en runtime** (comandos, botones, workers). **No** son un historial de cambios del repositorio, commits ni PRs.

La auditoría **no se guarda como tabla de eventos**. Se **publica** en canales que el servidor eligió en `/settings`. Quien no tenga esos canales no tiene rastro visible.

## Principio

Solo se auditan mutaciones. Extraer o visualizar información **no** genera log.

| Acción | ¿Audita? | Ejemplos |
|---|---|---|
| **Crear / registrar** | Sí | `/settings set`, `/tournament add`, `/sheet add`, `/schedule create`, `/attendance mark` |
| **Modificar** | Sí | `/settings edit`, `/bracket upload`, `/bracket dq both`, `/schedule update`, `/staff recruit` |
| **Borrar** | Sí | `/tournament delete`, `/ticket delete`, `/attendance delete`, `/user unban` |
| **Leer / listar / extraer** | No | `/bot ping`, `/settings show`, `/tournament list`, `/sheet find player`, `/sheet get`, `/sheet validate`, `/team info`, `/team list`, `/staff work`, `/server banlist` |

`/panel tutorial` publica mensajes pero **no** audita: las guías son material informativo, no un cambio del servidor.

- Se escribe el log **después de que la mutación tenga éxito**.
- Fallar al loguear **nunca deshace** el comando. El log es testigo, no parte de la transacción.

## Cómo viaja el log (webhook + nombre = módulo)

El bot no habla “como el bot” en esos canales si puede evitarlo. Usa **un webhook propio por canal** (lo crea o reutiliza; hace falta permiso de gestionar webhooks) y en cada envío cambia el **nombre visible**: ese nombre es el **módulo** que generó el log, es decir, el tipo de log. Un solo webhook por canal evita el límite de Discord de 15 webhooks por canal. El **icono** es siempre el del bot.

| Canal configurado | Nombre que aparece | Para qué |
|---|---|---|
| Bot logs | **Server Config** | `/settings` set/edit, `/staff` set/edit (roles y canales del servidor y del staff) |
| Bot logs | **Staff** | Recruit, fire, staff info registrada o editada |
| Bot logs | **Moderation** | `/role` individual y masivo, `/user` ban/unban, y ban/unban aplicados desde un aviso de `bans_channel` (con enlace al aviso) |
| Bot logs | **Tournaments** | Alta, edición y baja de torneo; `/sheet add`; `/tournament role`; `/tournament validate` |
| Bot logs | **Rooms** | `/room create`, `/room auto`, franjas de auto-room (incluida la recuperada) |
| Bot logs | **Schedules** | Crear, actualizar, borrar, refresh, resign, puesto tomado, resultado declarado o borrado |
| Bot logs | **Attendance** | Marcar, borrar, añadir o borrar links |
| Bot logs | **Utility** | Purga, wipe de categoría, emoji, embed y Components V2 publicados o reescritos, círculo de canal y miembro añadido a canal |
| Bot logs | **Ticket System** | Cerrar / reabrir / borrar ticket; regenerar transcript |
| Challonge logs | **Challonge Logs** | Vincular el bracket o reemplazar sus credenciales |
| Challonge logs | **Score Upload** | `/bracket upload`, `/bracket dq both`, `/bracket correct` y forfeits automáticos |
| Transcript logs | **Transcripts** | Archivo HTML (no es auditoría de “quién pulsó qué”) |

Si el webhook no se puede crear o falló el envío, se **reintenta** y, si sigue fallando, el mismo log lo manda el propio bot. Nadie es mencionado desde un log (`allowed mentions` vacío): ni notificación ni resaltado. El canal de logs queda fuera del resolver de menciones (`lib/mentions.ts`), que no edita sus mensajes para permitir usuarios; un `@usuario` no cacheado puede verse como `@unknown-user`.

## Formato del log (Components V2)

Cada log es un **contenedor de Components V2**, en inglés:

1. **Franja de color según la acción**: verde = se creó algo, dorado = se modificó, rojo = se borró (o se baneó, despidió, purgó, descalificó).
2. **Título = la acción** (`Tournament deleted`, `Seat claimed`…), precedido del emoji del módulo desde `emojis.ts`. Nunca repite el nombre del módulo, que ya firma el mensaje.
3. **Resumen de una frase** con las entidades en negrita o mencionables. El avatar de quien disparó la acción va de miniatura al lado.
4. **Grupos** separados por una línea: cada uno con un rótulo pequeño opcional (`Records removed`, `Changes`, `Match`…). Los datos van como `**Etiqueta** valor`; los contadores y listas cortas, en una sola línea unida con `·`; los cambios, como `viejo → nuevo`.
5. **Pie en texto pequeño**: `By @persona · AAAA-MM-DD HH:MM UTC · hace X`. La hora UTC va como texto (las marcas `<t:…>` de Discord se ven en la hora local de quien lee); la relativa sí es `<t:…:R>`.

Las listas largas (tickets abiertos, hojas archivadas) muestran **15** y cierran con *And N more*. Si un log no cabe en el límite de 4000 caracteres de Components V2, los últimos grupos se resumen en *And N more sections not shown*.

## Qué se audita

| Familia | Eventos |
|---|---|
| Servidor | Settings set/edit; staff config set/edit; recruit; fire; staff info add/edit; rol individual; rol masivo; ban; unban |
| Torneo | Alta, edición, baja; `/sheet add`; `/tournament role`; `/tournament validate` (si abrió al menos un ticket); auto-room on/off; salas creadas |
| Bracket | Score subido; score corregido (marcador viejo → nuevo + ganador) |
| Schedule | Crear, actualizar (con motivo), borrar, refresh, resign, asignar por botón, resultado declarado, resultado borrado |
| Asistencia | Marcar, borrar, añadir link, borrar links |
| Ticket | Close, reopen, delete, transcript (reemplaza el anterior). En un ticket de validación, close archiva y borra |
| Utility | Purga de canal; wipe de categoría; emoji robado; embed publicado o reescrito; Components V2 publicado o reescrito; círculo de canal (`dot`); miembro añadido a canal (`add member`) |

Los transcripts **no** son este sistema: son el archivo del chat, en otro canal, con otra identidad.

## Relacionado

- Settings: [../commands/settings.md](../commands/settings.md)
- Tickets / transcript: [../domains/tickets.md](../domains/tickets.md)
- UX: [ux.md](ux.md)
