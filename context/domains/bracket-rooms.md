# Bracket y salas

El organizador crea y siembra el bracket **fuera**. El bot guarda la identidad del torneo en el bracket y una clave cifrada. Con eso:

- **Sincroniza** partidos (ronda, grupo/fase, nombres, estado).
- **Reporta** un marcador (`/upload_score`).
- **Corrige** un marcador ya subido (`/correct_bracket`) y deja rastro de “antes / después”.

Empates en el bracket **no se aceptan**. El ganador se deduce del marcador.

## Estados del partido

| Estado | Significado operativo |
|---|---|
| `pending` | El cuadro lo proyecta, pero **aún no se puede jugar**. No se crea sala. |
| `open` | Ambos lados están definidos y el partido está listo. **Candidato a ticket.** |
| `completed` | Ya hay ganador en el bracket. No se reabre sala por auto-room. |

## Auto-room vs sala manual

`auto_room_creation` al dar de alta el torneo solo dice “este torneo *puede* automatizarse”. Las salas no aparecen hasta que alguien **enciende** la automatización (`/auto_room run`) o crea a mano (`/room create`).

Mientras auto-room está **encendido**:

- Un proceso de fondo, cada minuto, mira el bracket y abre hasta **3** salas por torneo.
- Tras cada `/upload_score`, se dispara la misma lógica (también tope de 3).
- Un `run` manual puede abrir hasta **25** de una vez.

Mientras está **apagado** (`stop` / `toggle` off): no se abren salas nuevas. Los tickets ya abiertos siguen vivos.

**Elegibilidad (siempre):** estado `open` + nombres reales + no existe sala.

## Torneos de dos etapas

- En grupos (`group_stages_underway`): solo partidos de grupo.
- Cuando los grupos cierran: **no** se crean salas fantasma para slots `pending` del cuadro final.
- En eliminación: solo partidos de etapa final, y solo cuando el bracket ya los abrió. Lo habitual es volver a dar `/auto_room run` al empezar la etapa 2.

## Desbordamiento de categorías

Discord limita 50 canales por categoría. El bot llena categoría 1 → 2 → 3 → 4.

## Corrección aguas abajo

Si `/correct_bracket` cambia quién avanza y ya había un ticket abierto con los equipos viejos, ese ticket se **borra y se recrea** con los equipos correctos.

`/room available` no crea nada: enseña la cola (quién podría tener sala ahora).

`/upload_score` solo se usa **dentro del ticket**. Reporta al bracket, completa el match, cierra/archiva, genera transcript y encadena auto-room. Empate prohibido.

## Relacionado

- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Tickets: [tickets.md](tickets.md)
- Worker auto-room: [../platform/workers.md](../platform/workers.md)
- Comandos: [../commands/rooms-bracket.md](../commands/rooms-bracket.md)
