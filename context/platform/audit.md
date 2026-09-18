# Auditoría y logs

Estos logs son **acciones que el bot ejecuta en runtime** (comandos, botones, workers). **No** son un historial de cambios del repositorio, commits ni PRs.

La auditoría **no se guarda como tabla de eventos**. Se **publica** en canales que el servidor eligió en `/settings`. Quien no tenga esos canales no tiene rastro visible.

## Principio

Solo se auditan mutaciones. Extraer o visualizar información **no** genera log.

| Acción | ¿Audita? | Ejemplos |
|---|---|---|
| **Crear / registrar** | Sí | `/settings set`, `/tournament add`, `/tournament add_sheet`, `/schedule create`, `/attendance mark` |
| **Modificar** | Sí | `/settings edit`, `/upload_score`, `/schedule update`, `/staff recruit` |
| **Borrar** | Sí | `/tournament delete`, `/ticket delete`, `/attendance delete`, `/user unban` |
| **Leer / listar / extraer** | No | `/bot ping`, `/settings show`, `/tournament list`, `/tournament find_player`, `/tournament get_sheet`, `/team info`, `/staff work`, `/server banlist` |

- Se escribe el embed de log **después de que la mutación tenga éxito**.
- Fallar al loguear **nunca deshace** el comando. El log es testigo, no parte de la transacción.

## Cómo viaja el log (webhook + título = tipo)

El bot no habla “como el bot” en esos canales si puede evitarlo. Crea o reutiliza un **webhook del canal** (hace falta permiso de gestionar webhooks). El **título** del envío (nombre visible del webhook) **representa el tipo de log**, no un rótulo genérico. El **icono** del webhook es siempre el del bot:

| Canal configurado | Nombre que aparece | Para qué |
|---|---|---|
| Bot logs | **Bot Logs** | Config, staff, roles, salas, schedules, asistencia, bans, utilidades de mutación |
| Bot logs | **Ticket System** | Cerrar / reabrir / borrar ticket |
| Challonge logs | **Challonge Logs** | Vincular o cambiar credenciales/identidad de bracket |
| Challonge logs | **Score Upload** | `/upload_score` y `/correct_bracket` |
| Transcript logs | **Transcripts** | Archivo HTML (no es auditoría de “quién pulsó qué”) |

Si el webhook no se puede crear o falló el envío, se **reintenta** y, si sigue fallando, el mensaje lo manda el propio bot. Nadie es mencionado desde un log (`allowed mentions` vacío).

Cada embed de auditoría, en inglés, lleva al menos: **qué pasó**, **Triggered By**, **hora UTC**, y las entidades tocadas (persona, rol, canal, torneo, partido) en formato mencionable. El avatar de quien disparó la acción va de **miniatura** cuando existe.

## Qué se audita

| Familia | Eventos |
|---|---|
| Servidor | Settings set/edit; staff config set/edit; recruit; fire; rol individual; rol masivo; ban; unban |
| Torneo | Alta, edición, baja; add_sheet; auto-room on/off; salas creadas |
| Bracket | Score subido; score corregido (marcador viejo → nuevo + ganador) |
| Schedule | Crear, actualizar (con motivo), borrar, refresh, resign, asignar por botón, resultado declarado, resultado borrado |
| Asistencia | Marcar, borrar, añadir link, borrar links |
| Ticket | Close, reopen, delete |
| Utility | Purga de canal; wipe de categoría; emoji robado; embed publicado o reescrito; Components V2 publicado o reescrito |

Los transcripts **no** son este sistema: son el archivo del chat, en otro canal, con otra identidad.

## Relacionado

- Settings: [../commands/settings.md](../commands/settings.md)
- Tickets / transcript: [../domains/tickets.md](../domains/tickets.md)
- UX: [ux.md](ux.md)
