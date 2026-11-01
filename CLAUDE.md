# Apex Horizon Esports

Bot de Discord en Node.js + TypeScript + npm + MongoDB (Prisma). `context/` es la fuente de verdad; empieza por `context/README.md`.

Las reglas del proyecto viven en `.claude/rules/` y se cargan siempre:

- `context-source-of-truth.md` — context manda; actualizarlo en el mismo cambio
- `command-access.md` — `context/commands/access.md` decide quién usa cada comando
- `bot-structure.md` — agrupar por contexto de comando, sin sobreingeniería
- `autocomplete.md` — datos guardados por el bot se eligen por autocomplete o Choice
- `discord-ui.md` — menciones con helpers, emojis desde `emojis.ts`, copy propio por bloque
- `bot-audit-logs.md` — las mutaciones se auditan por webhook; las lecturas no
- `git-flow.md` — ramas, commits, PR contra `develop` y limpieza de ramas mergeadas

Son una copia de `.cursor/rules/`. Si cambias una regla, cambia las dos copias. Única diferencia: en `git-flow.md` Claude borra él mismo la rama mergeada (local y remota) antes de cambiar de rama.
