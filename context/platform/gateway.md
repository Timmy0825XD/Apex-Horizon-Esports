# Presencia viva: Gateway y latencia

El bot no “entra y sale” de Discord en cada comando. Mantiene una **sesión persistente por WebSocket** (el Gateway):

- Ahí llegan slash commands, botones, autocompletados, altas/bajas de miembros, y la prueba de que el proceso sigue vivo. `/server info` usa el privileged intent **Server Members** para contar humanos y bots.
- El “ping WebSocket” de `/bot ping` es el **latido de esa sesión**, no el tiempo de un comando concreto.
- El “bot latency” es el tiempo de ida y vuelta de **esa** interacción.
- El “database latency” es si Prisma / Mongo responde (`ping`). El embed de `/bot ping` también muestra RAM, uptime y alcance.

Los cortes de red transitorios (`ECONNRESET`, DNS, timeouts) se cuentan: al **4.º seguido** el proceso se detiene para que el host lo reinicie. Cada reconexión sana (`ShardReady` / `ShardResume`) pone el contador a cero, así que cortes aislados a lo largo de semanas no apagan el bot.

Si el WebSocket se cae, el bot deja de oír al servidor aunque los datos sigan existiendo. Si el almacén se cae, oye pero no puede operar torneos. `/bot ping` enseña las dos mitades.

## Relacionado

- Workers: [workers.md](workers.md)
- Comando: [../commands/bot.md](../commands/bot.md)
