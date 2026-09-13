# Procesos de fondo

Hay tres bucles que no esperan a un comando:

| Bucle | Cada | Qué decide |
|---|---|---|
| **Auto-room** | ~60 s | Si el torneo tiene auto-room encendido, sincroniza el bracket y abre salas elegibles (máx. 3). |
| **Recordatorio de schedule** | ~60 s | T-10: recordar y pedir confirmación. T-0: expulsar no confirmados y pedir reemplazo urgente. |
| **Caducidad de bans** | periódico | Si un ban temporal venció, se levanta. |

Son la misma lógica que los comandos equivalentes, solo que **sin operador delante**.

Las **interacciones** (botones y menús) son comandos fragmentados: confirmar asistencia T-10, tomar un puesto de schedule, paginar listas, confirmar borrar una categoría, construir un embed. Las mismas reglas de permiso y de “un partido / un schedule” aplican.

Los procesos de fondo **no viajan por el WebSocket del usuario**. Corren dentro del mismo proceso vivo: usan la sesión para crear canales y publicar mensajes, y el almacén para saber qué torneos y schedules existen.

## Relacionado

- Auto-room: [../domains/bracket-rooms.md](../domains/bracket-rooms.md)
- T-10/T-0: [../domains/schedules.md](../domains/schedules.md)
- Bans: [../domains/moderation.md](../domains/moderation.md)
- Gateway: [gateway.md](gateway.md)
- Interacciones: [../commands/interactions.md](../commands/interactions.md)
