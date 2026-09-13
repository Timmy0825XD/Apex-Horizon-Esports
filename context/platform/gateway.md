# Presencia viva: Gateway y latencia

El bot no “entra y sale” de Discord en cada comando. Mantiene una **sesión persistente por WebSocket** (el Gateway):

- Ahí llegan slash commands, botones, autocompletados, altas/bajas de miembros, y la prueba de que el proceso sigue vivo.
- El “ping WebSocket” de `/ping` es el **latido de esa sesión**, no el tiempo de un comando concreto.
- El “bot latency” es el tiempo de ida y vuelta de **esa** interacción.
- El “database latency” es si el almacén de configuración y partidos responde.

Si el WebSocket se cae, el bot deja de oír al servidor aunque los datos sigan existiendo. Si el almacén se cae, oye pero no puede operar torneos. `/ping` enseña las dos mitades.

## Relacionado

- Workers: [workers.md](workers.md)
- Comando: [../commands/bot.md](../commands/bot.md)
