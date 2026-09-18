# Catálogo de comandos

Tipos Discord: `STRING`, `INTEGER`, `BOOLEAN`, `USER`, `ROLE`, `CHANNEL`, `ATTACHMENT`.  
**Autocomplete** = lista buscable. **Choice** = opciones fijas.

Los comandos se invocan solo por **slash**. El bot solo sirve gremios de `ALLOWED_GUILDS`.

Si una regla de `context/` y un comando en Discord discrepan, **gana lo que el bot hace al ejecutarse**. Estos archivos describen el ser operativo que esos comandos están obligados a respetar.

Al nacer, renombrarse o eliminarse un comando: actualizar **este índice** y el archivo de su familia.

## Familias

| Familia | Archivo | Comandos |
|---|---|---|
| Bot | [bot.md](bot.md) | `/bot ping` · `/bot about` · `/bot help` |
| Settings | [settings.md](settings.md) | `/settings set` · `edit` · `show` |
| Staff | [staff.md](staff.md) | `/staff config set` · `edit` · `view` · `/staff recruit` · `fire` · `work` |
| Tournament | [tournament.md](tournament.md) | `/tournament add` · `edit` · `delete` · `add_sheet` · `find_player` · `info` · `list` |
| Sheet y equipos | [sheet-teams.md](sheet-teams.md) | `/sheet headers` · `validate` · `/team info` · `list` · `/assign_role` · `/utility discord_tag` |
| Salas y bracket | [rooms-bracket.md](rooms-bracket.md) | `/auto_room run` · `stop` · `toggle` · `/room create` · `available` · `/upload_score` · `/correct_bracket` |
| Schedule | [schedule.md](schedule.md) | `/schedule create` · `update` · `show` · `delete` · `unassigned` · `refresh` · `resign` · `results` · `results_delete` |
| Attendance | [attendance.md](attendance.md) | `/attendance mark` · `delete` · `/get attendance` · `/get sheet` · `/link add` · `delete` · `missing` · `/work_done` |
| Tickets | [tickets.md](tickets.md) | `/ticket close` · `reopen` · `delete` |
| Roles | [roles.md](roles.md) | `/role user` · `add all` · `remove all` · `list` |
| Server y usuario | [server-user.md](server-user.md) | `/server info` · `banlist` · `tree` · `invites` · `/user ban` · `unban` |
| Utility | [utility.md](utility.md) | `/utility clear_category` · `clear` · `emoji_steal` · `random` · `utc` · `discord_tag` · `avatar` · `toss` · `enlarge` · `embed` · `edit_embed` · `v2` · `edit_v2` |
| Interacciones | [interactions.md](interactions.md) | Botones y menús (no slash) |
| Permisos | [permissions.md](permissions.md) | Resumen de etiquetas |

## Relacionado

- Ciclo y encadenado: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Actores: [../product/actors.md](../product/actors.md)
