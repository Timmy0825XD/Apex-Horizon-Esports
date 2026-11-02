# Procesos de fondo

Hay tres bucles que no esperan a un comando:

| Bucle | Cada | Qué decide |
|---|---|---|
| **Auto-room** | 00:00 UTC y 12:00 UTC (o al volver, si se perdió la franja) | Si el torneo tiene auto-room encendido, sincroniza el bracket y abre **toda** la cola de salas `open` que aún no existen. |
| **Recordatorio de schedule** | ~60 s | T-10: recordatorio en el ticket. T-2: alerta roja si falta un puesto o no confirmaron. T-0: expulsar no confirmados (solo si esa misma persona sigue en el puesto sin confirmar; un reclamo hecho mientras corre el worker se respeta). Si ya hay resultado o el ticket está cerrado, T-2 y T-0 no abren puestos ni publican el reemplazo. Atiende hasta 4 schedules a la vez; si uno falla, los demás siguen. Si el bot ya no está en ese servidor, el schedule se da por cerrado (`t0`) y deja de revisarse. |
| **Caducidad de bans** | periódico | Si un ban temporal venció, se levanta. |

El reloj de auto-room se revisa cada minuto. Cada torneo guarda la última franja atendida (`autoRoomLastSlot`); el worker la toma de forma atómica, así que cada franja abre la cola una sola vez por torneo. Si el bot estuvo caído durante una franja, al volver abre la más reciente que se perdió (nunca un atraso de varias) y el log la marca como recuperada. Encender auto-room marca la franja en curso como atendida, porque ya abre la cola en ese momento. Un torneo encendido que aún no tenía franja guardada (anterior a este registro) se marca sin abrir nada, para no abrir tickets fuera de hora al desplegar. No abre una sala en el momento en que una llave anterior se completa. Antes de abrir, reporta las llaves `open` que traen un lado marcado por `/bracket dq both` y no les crea ticket.

Son la misma lógica que los comandos equivalentes, solo que **sin operador delante**. El actor del log de esa franja es el bot.

Las **interacciones** (botones y menús) son comandos fragmentados: confirmar asistencia T-10, tomar un puesto de schedule, paginar listas, confirmar borrar una categoría, construir un embed. Las mismas reglas de permiso y de “un partido / un schedule” aplican.

Los procesos de fondo **no viajan por el WebSocket del usuario**. Corren dentro del mismo proceso vivo: usan la sesión para crear canales y publicar mensajes, y el almacén para saber qué torneos y schedules existen.

## Relacionado

- Auto-room: [../domains/bracket-rooms.md](../domains/bracket-rooms.md)
- T-10/T-0: [../domains/schedules.md](../domains/schedules.md)
- Bans: [../domains/moderation.md](../domains/moderation.md)
- Gateway: [gateway.md](gateway.md)
- Interacciones: [../commands/interactions.md](../commands/interactions.md)
