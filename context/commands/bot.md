# Bot

Slash: comando `bot`, subcomandos `ping`, `about`, `help`.

Los tres paneles son **Components V2** (container + color de acento, no embed clásico). Los botones **About / Help / Ping** van **dentro** del container, en la **última fila**, después del contenido. Colores: About en **rojo** de marca, Help en **dorado** de marca, Ping según su estado.

## `/bot ping`

**Para qué:** Comprobar que la sesión WebSocket, la respuesta a la interacción y el almacén están vivos.

Cabecera `Pong` con el avatar y una frase del estado general. Debajo, bloque **Latency** citado con Discord gateway, Database y Command response en milisegundos. Estado: verde por debajo de **200 ms**, ámbar por debajo de **500 ms**, rojo más lento o caído. El color del panel es el del peor, y solo lo lento lleva marca en texto (*slow*, *very slow*, *down*). Si el gateway aún no midió, dice *measuring*. Si la base de datos no responde, el error va en letra pequeña debajo. Pie en una línea: RAM del proceso del bot (sin la del host), uptime corto (`1m 7s`, `2d 4h`), servidores y miembros con separador de miles.

**Campos:** ninguno.

**Relación:** Diagnóstico de presencia ([../platform/gateway.md](../platform/gateway.md)). Admin, Organiser o Helper de un torneo. No audita.

## `/bot about`

**Para qué:** Quién es el bot y cómo corre. Cabecera con el nombre, el avatar, una frase de qué hace y una línea con versión, tiempo en línea y miembros. Bloque **Identity**: ID, fecha de alta (timestamp de Discord, absoluto y relativo) y owner. Bloque **Runtime**: Node, npm y OS en una línea, CPU sin el sufijo del fabricante y RAM del proceso frente a la del host. El owner es siempre `<@1017267293471903774>` (no se lee de Discord).

**Campos:** ninguno. Solo en servidor.

**Relación:** Informativo. Admin, Organiser o Helper de un torneo. No audita.

## `/bot help`

**Para qué:** Mapa de comandos por sección y quién puede usarlos. El heading de cada página es la familia (`Bot`, `Settings`, `Schedule`, …) con su descripción. Cada comando va como mención clicable, su resumen y una línea pequeña con quién lo usa (`Admin · Organiser`). Debajo, un menú **Jump to a section** con todas las secciones (el placeholder dice en cuál estás, `7 of 12`) y, en la fila de navegación, flechas ◀ ▶ delante de About / Help / Ping.

**Campos:** ninguno.

**Relación:** Índice vivo ([_index.md](_index.md)). Admin, Organiser, Helper de un torneo o `staff_role`. No audita. Paginación: [interactions.md](interactions.md).
