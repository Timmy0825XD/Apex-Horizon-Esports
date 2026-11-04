# Estructura del código

Objetivo: **trazabilidad**. Encontrar `/schedule` debe ser abrir una carpeta, no cazar trozos en diez directorios técnicos.

## Anti-patrón (no hacer)

Una capa por tipo de archivo, todos los comandos mezclados:

```text
src/
  autocomplete/
  commands/
  constants/
  guards/
  interactions/
  schemas/
  scripts/
  services/
  types/
  utils/
  workers/
  index.ts
```

Un solo comando acaba con un archivo en cada carpeta. Es “ordenado” por técnica y **opaco** por negocio.

## Patrón (sí hacer)

Agrupar por **contexto de comando**. Subcomandos, autocomplete, validaciones y lógica de `/schedule` viven juntos.

Compartido **solo** lo transversal de verdad:

| Sitio | Qué va ahí |
|---|---|
| `emojis.ts` | Constantes de emoji del bot (importable desde cualquier archivo) |
| Utilidades compartidas | Formatters de menciones, cascarones de embed, cliente Prisma, webhook de audit |
| `workers/` | Bucles de fondo (auto-room, T-10/T-0, bans), no son un slash command |

Esquema de crecimiento (no crear carpetas vacías hasta implementar):

```text
src/
  index.ts
  emojis.ts
  lib/                 # compartido real, delgado
  commands/
    bot/               # /bot ping|about|help
    settings/          # /settings set|edit|show
    server/            # /server info|banlist|tree|invites
    staff/             # /staff config, info, recruit, fire, work
    tournament/        # /tournament add|edit|delete|info|list|role|validate
    sheet/             # /sheet add|get|find player|validate
    room/              # /room create|available|auto y la tubería de battle tickets (incluye la franja de auto-room)
    bracket/           # /bracket upload|dq both|correct
    ticket/            # /ticket close|reopen|delete
    team/              # /team info|list
    role/              # /role user|add all|remove all|list
    user/              # /user ban|unban (y la lógica de ban que reusa ban-watch)
    ban-watch/         # avisos de baneo en bans_channel: lector, tarjetas y botones
    utility/           # /utility clear messages, utc, embed, v2, …
    schedule/          # /schedule y todo lo suyo (cuando exista)
    panel/             # /panel tutorial: panel de selección, vista de guía y guides/ con el texto de cada comando
    ...
  workers/
```

Dentro de `commands/schedule/` pueden existir varios archivos (`create`, `update`, autocomplete) si cada uno tiene una razón. No se esparcen fuera de esa carpeta.

El slash y sus interacciones viven en **esa** carpeta. El router en `index.ts` solo despacha.

## Config del servidor en memoria

`settings` y `staff` se leen con `loadGuildConfig` (`lib/guild-config.ts`), que guarda el documento del servidor 60 s. Quien escribe `settings` o `staff` llama `forgetGuildConfig` en el mismo cambio. No leas `prisma.guild` directo para config. La migración del campo viejo `staffInstructionsChannelId` corre una vez al arrancar, no en cada lectura.

## SOLID y GRASP (sin sobreingeniería)

- Una responsabilidad por módulo; nombres que digan el contexto.
- Bajo acoplamiento: un comando no importa la tripa de otro; comparte `lib/` o nada.
- No anticipar factories, contenedores DI, repositorios genéricos ni “base command” pesado.
- Calidad y seguridad altas; complejidad solo cuando el caso actual la exige.

## Relacionado

- Stack: [stack.md](stack.md)
- Autocomplete: [autocomplete.md](autocomplete.md)
- UI: [discord-ui.md](discord-ui.md)
