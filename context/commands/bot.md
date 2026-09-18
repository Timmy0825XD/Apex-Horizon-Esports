# Bot

Slash: comando `bot`, subcomandos `ping`, `about`, `help`.

Los tres paneles son **Components V2** (container + color de acento, no embed clásico). Los botones **About / Help / Ping** van **dentro** del container. Help pagina por familia con Previous / Next. El título de cada página de help es el **comando principal** (`Bot`, `Settings`, `Schedule`, …), sin la barra `Nombre · APP · hora`.

## `/bot ping`

**Para qué:** Comprobar que la sesión WebSocket, la respuesta a la interacción y el almacén están vivos. También muestra RAM, uptime y alcance (servidores / miembros).

**Campos:** ninguno.

**Relación:** Diagnóstico de presencia ([../platform/gateway.md](../platform/gateway.md)). Público. No audita.

## `/bot about`

**Para qué:** Identidad y salud de runtime (nombre, ID, fecha de alta, owner, servidores, miembros, uptime, memoria, CPU, plataforma, Node, versión). El owner es siempre `<@1017267293471903774>` (no se lee de Discord).

**Campos:** ninguno. Solo en servidor.

**Relación:** Informativo. Público. No audita.

## `/bot help`

**Para qué:** Mapa de comandos por sección y quién puede usarlos. El heading de cada página es el comando raíz de esa familia. Los de `/bot`, `/settings`, `/server`, `/staff` y `/utility` se mencionan como slash; el resto del catálogo va en monospace hasta que existan en Discord.

**Campos:** ninguno.

**Relación:** Índice vivo ([_index.md](_index.md)). Público. No audita. Paginación: [interactions.md](interactions.md).
