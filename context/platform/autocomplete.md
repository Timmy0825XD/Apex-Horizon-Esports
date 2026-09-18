# Autocomplete

Los campos que piden **datos que el bot ya almacena**, o una **opción específica de una lista viva**, son autocomplete. El usuario elige por **nombre**. No memoriza IDs internos. No puede mandar un string inventado y que el bot lo acepte como si existiera.

Ejemplo: ver la config de un torneo → el campo torneo lista los torneos **creados en ese servidor**, no un texto libre.

## Cuándo qué

| Tipo Discord | Cuándo |
|---|---|
| **Autocomplete** | Lista viva desde el almacén (torneos, partidos, grupos del bracket, …) |
| **Choice** | Enumeración **fija en código**, corta (`1vs1`…`5vs5`, duraciones de ban) |
| **STRING libre** | El humano inventa el valor (nota, reason, link, remark libre) |
| USER / ROLE / CHANNEL | Pickers nativos de Discord; no se sustituyen por autocomplete |

El autocomplete vive **dentro de la carpeta del comando** que lo usa. Ver [structure.md](structure.md).

Filtro: se busca por nombre. El valor que Discord envía al comando es el identificador interno; lo que se **enseña** es el nombre.

Ámbito: solo entidades de **ese servidor** (y de ese torneo, si el campo es de un torneo). Nada se mezcla entre gremios, **salvo** el archivo global de sheets: `/tournament get_sheet` `name` lista copias de **todo el bot** (se enseña nombre · servidor).

## Relacionado

- Catálogo (qué campo es Autocomplete vs Choice): [../commands/_index.md](../commands/_index.md)
- UI al mostrar la entidad elegida: [discord-ui.md](discord-ui.md)
