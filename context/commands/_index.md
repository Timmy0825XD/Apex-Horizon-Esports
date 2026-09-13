# Catálogo de comandos

Tipos Discord: `STRING`, `INTEGER`, `BOOLEAN`, `USER`, `ROLE`, `CHANNEL`, `ATTACHMENT`.  
**Autocomplete** = lista buscable. **Choice** = opciones fijas.

Si una regla de `context/` y un comando en Discord discrepan, **gana lo que el bot hace al ejecutarse**. Estos archivos describen el ser operativo que esos comandos están obligados a respetar.

Al nacer, renombrarse o eliminarse un comando: actualizar **este índice** y el archivo de su familia.

## Familias

| Familia | Archivo | Comandos |
|---|---|---|
| Bot | [bot.md](bot.md) | `/ping` · `/bot about` · `/bot help` |
| Settings | [settings.md](settings.md) | `/settings setup` · `edit` · `show` |
| Staff | [staff.md](staff.md) | `/staff config set` · `edit` · `view` · `/staff recruit` · `fire` · `work` |
| Tournament | [tournament.md](tournament.md) | `/tournament add` · `edit` · `delete` · `info` · `list` |
| Sheet y equipos | [sheet-teams.md](sheet-teams.md) | `/sheet headers` · `validate` · `/team info` · `list` · `/assign_role` · `/utility discord_tag` |
| Salas y bracket | [rooms-bracket.md](rooms-bracket.md) | `/auto_room run` · `stop` · `toggle` · `/room create` · `available` · `/upload_score` · `/correct_bracket` |
| Schedule | [schedule.md](schedule.md) | `/schedule create` · `update` · `show` · `delete` · `unassigned` · `refresh` · `resign` · `results` · `results_delete` |
| Attendance | [attendance.md](attendance.md) | `/attendance mark` · `delete` · `/get attendance` · `/get sheet` · `/link add` · `delete` · `missing` · `/work_done` |
| Tickets | [tickets.md](tickets.md) | `/ticket close` · `reopen` · `delete` |
| Roles | [roles.md](roles.md) | `/role user` · `add all` · `remove all` · `list` |
| Server y usuario | [server-user.md](server-user.md) | `/server info` · `banlist` · `/user ban` · `unban` |
| Utility | [utility.md](utility.md) | `/utility *` (clear, utc, embed, …) |
| Interacciones | [interactions.md](interactions.md) | Botones y menús (no slash) |
| Permisos | [permissions.md](permissions.md) | Resumen de etiquetas |

## Relacionado

- Ciclo y encadenado: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Actores: [../product/actors.md](../product/actors.md)
