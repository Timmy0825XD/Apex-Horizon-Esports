# Catálogo de comandos

Tipos Discord: `STRING`, `INTEGER`, `BOOLEAN`, `USER`, `ROLE`, `CHANNEL`, `ATTACHMENT`.  
**Autocomplete** = lista buscable. **Choice** = opciones fijas.

Los comandos se invocan solo por **slash**. El bot solo sirve gremios de `ALLOWED_GUILDS`.

Si una regla de `context/` y un comando en Discord discrepan, **gana lo que el bot hace al ejecutarse**. Estos archivos describen el ser operativo que esos comandos están obligados a respetar.

Al nacer, renombrarse o eliminarse un comando: actualizar **este índice** y el archivo de su familia.

## Nombres de comandos

Comando, grupo y subcomando son **una palabra en minúsculas**, sin `_` ni `-`. Un nombre de varias palabras se arma con niveles y se lee con espacios: `/room auto`, `/bracket dq both`, `/schedule results add`, `/utility v2 edit`. Discord permite como máximo comando → grupo → subcomando.

Se agrupa por sustantivo y el verbo va al final (`/staff config set · edit · view`, `/utility embed create · edit`). Un grupo no puede llamarse igual que un subcomando hermano: si choca, el subcomando entra al grupo con un verbo.

Las **opciones** siguen en `snake_case` (`sheet_link`, `team1_score`, `discord_tag`): no son comandos y la regla no las toca.

## Familias

| Familia | Archivo | Comandos |
|---|---|---|
| Bot | [bot.md](bot.md) | `/bot ping` · `/bot about` · `/bot help` |
| Settings | [settings.md](settings.md) | `/settings set` · `edit` · `show` |
| Staff | [staff.md](staff.md) | `/staff config set` · `edit` · `view` · `/staff info add` · `edit` · `export` · `/staff recruit` · `fire` · `work` |
| Tournament | [tournament.md](tournament.md) | `/tournament add` · `edit` · `delete` · `info` · `list` · `report` · `role` · `validate` |
| Sheet y equipos | [sheet-teams.md](sheet-teams.md) | `/sheet add` · `get` · `find player` · `validate` · `/team info` · `list` · `/utility discord tag` |
| Salas y bracket | [rooms-bracket.md](rooms-bracket.md) | `/room auto` · `/room create` · `available` · `/bracket upload` · `/bracket dq both` · `/bracket correct` |
| Schedule | [schedule.md](schedule.md) | `/schedule create` · `update` · `show` · `delete` · `unassigned` · `refresh` · `resign` · `results add` · `results delete` |
| Attendance | [attendance.md](attendance.md) | `/attendance mark` · `delete` · `report` · `/get attendance` · `/get sheet` · `/link add` · `delete` · `missing` |
| Tickets | [tickets.md](tickets.md) | `/ticket close` · `reopen` · `delete` |
| Roles | [roles.md](roles.md) | `/role user` · `add all` · `remove all` · `list` |
| Server y usuario | [server-user.md](server-user.md) | `/server info` · `banlist` · `tree` · `invites` · `/user ban` · `unban` |
| Panel | [panel.md](panel.md) | `/panel tutorial` |
| Utility | [utility.md](utility.md) | `/utility clear messages` · `clear category` · `emoji steal` · `random` · `utc` · `discord tag` · `avatar` · `toss` · `enlarge` · `embed create` · `embed edit` · `v2 create` · `v2 edit` |
| Interacciones | [interactions.md](interactions.md) | Botones y menús (no slash) |
| Acceso | [access.md](access.md) | Quién puede usar cada comando. Manda sobre el código |

## Relacionado

- Ciclo y encadenado: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Actores: [../product/actors.md](../product/actors.md)
