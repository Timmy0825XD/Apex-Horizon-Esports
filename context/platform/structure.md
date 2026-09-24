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
    staff/             # /staff config, recruit, fire, work
    tournament/        # /tournament add|edit|delete|add_sheet|get_sheet|find_player|info|list|role
    auto-room/         # /auto_room
    room/              # /room create|available y la tubería de battle tickets
    ticket/            # /ticket close|reopen|delete
    team/              # /team info|list
    role/              # /role user|add all|remove all|list
    user/              # /user ban|unban
    utility/           # /utility clear, utc, embed, v2, …
    schedule/          # /schedule y todo lo suyo (cuando exista)
    ...
  workers/
```

Dentro de `commands/schedule/` pueden existir varios archivos (`create`, `update`, autocomplete) si cada uno tiene una razón. No se esparcen fuera de esa carpeta.

El slash y sus interacciones viven en **esa** carpeta. El router en `index.ts` solo despacha.

## SOLID y GRASP (sin sobreingeniería)

- Una responsabilidad por módulo; nombres que digan el contexto.
- Bajo acoplamiento: un comando no importa la tripa de otro; comparte `lib/` o nada.
- No anticipar factories, contenedores DI, repositorios genéricos ni “base command” pesado.
- Calidad y seguridad altas; complejidad solo cuando el caso actual la exige.

## Relacionado

- Stack: [stack.md](stack.md)
- Autocomplete: [autocomplete.md](autocomplete.md)
- UI: [discord-ui.md](discord-ui.md)
