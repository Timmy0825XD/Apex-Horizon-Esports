# Nombres de slash commands

Detalle: [context/commands/_index.md](context/commands/_index.md#nombres-de-comandos).

Comando, grupo y subcomando son **una sola palabra en minúsculas**, sin `_` ni `-`. Si el nombre necesita más de una palabra, cada palabra es un **nivel** (comando → grupo → subcomando), y en Discord se lee con espacios.

Las **opciones** siguen en `snake_case`.

```text
❌ /auto_room · /bracket dq_both · /staff info_add · /utility edit-v2
✅ /room auto · /bracket dq both · /staff info add · /utility v2 edit
✅ opción sheet_link · team1_score (snake_case)
```

- Discord permite como máximo **comando → grupo → subcomando**. Si no cabe, busca otra palabra antes que unir dos.
- Un grupo y un subcomando hermanos no pueden llamarse igual. Si nace un grupo con el nombre de un subcomando que ya existe, ese subcomando entra al grupo con un verbo (`/schedule results` → `/schedule results add`).
- Agrupa por **sustantivo** y deja el verbo al final (`/utility embed create` · `edit`).
- En el handler enruta por la ruta completa con `subcommandPath()` (`lib/register-slash.ts`): `"dq both"`, `"results add"`.

Renombrar un comando es un cambio de catálogo: en el mismo cambio actualiza el builder, el enrutado del handler, `slashMention` / `formatHelpEntry`, `bot/catalog.ts`, `access.md`, `_index.md` y el `.md` de la familia.
