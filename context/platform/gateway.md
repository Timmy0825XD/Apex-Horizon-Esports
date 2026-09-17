# Presencia viva: Gateway y latencia

El bot no “entra y sale” de Discord en cada comando. Mantiene una **sesión persistente por WebSocket** (el Gateway):

- Ahí llegan slash commands, mensajes prefix (`a?`), botones, autocompletados, altas/bajas de miembros, y la prueba de que el proceso sigue vivo. El prefix exige el privileged intent **Message Content**. `/server info` usa el privileged intent **Server Members** para contar humanos y bots.
- El “ping WebSocket” de `/bot ping` y `a?ping` es el **latido de esa sesión**, no el tiempo de un comando concreto.
- El “bot latency” es el tiempo de ida y vuelta de **esa** interacción o mensaje.
- El “database latency” es si Prisma / Mongo responde (`ping`). El embed de `/bot ping` también muestra RAM, uptime y alcance.

Si el WebSocket se cae, el bot deja de oír al servidor aunque los datos sigan existiendo. Si el almacén se cae, oye pero no puede operar torneos. `/bot ping` y `a?ping` enseñan las dos mitades.

## Relacionado

- Workers: [workers.md](workers.md)
- Comando: [../commands/bot.md](../commands/bot.md)
