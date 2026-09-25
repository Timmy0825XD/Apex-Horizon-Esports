# Bracket y salas

El organizador crea y siembra el bracket **fuera**. El bot guarda la identidad del torneo en el bracket y una clave cifrada. Con eso:

- **Sincroniza** partidos (ronda, grupo/fase, nombres, estado y si es el partido de 3er puesto).
- **Reporta** un marcador (`/upload_score`).
- **Corrige** un marcador ya subido (`/correct_bracket`) y deja rastro de “antes / después”.

Empates en el bracket **no se aceptan**. El ganador se deduce del marcador.

## Estados del partido

| Estado | Significado operativo |
|---|---|
| `pending` | El cuadro lo proyecta, pero **aún no se puede jugar**. No se crea sala. |
| `open` | Ambos lados están definidos y el partido está listo. **Candidato a ticket.** |
| `completed` | Ya hay ganador en el bracket. No se reabre sala por auto-room. |

## Auto-room

Auto-room **no** se elige al dar de alta el torneo. Nace apagado. Solo `/auto_room` lo cambia (`tournament` + `status`).

Al pasar de **off a on**, el bot abre en ese momento los partidos `open` que aún no tienen sala.

Mientras sigue **on**:

- Completar una llave **no** abre el siguiente ticket al instante.
- A las **00:00 UTC** y a las **12:00 UTC** se abre, de golpe, toda la cola que siga esperando.
- `/room create` abre esa misma cola en el momento, sin esperar al reloj. También sirve con auto-room apagado y no lo enciende. `group` y `round` son opcionales: si van, solo se abren los partidos de ese grupo y/o esa ronda.

Apagarlo no cierra tickets ya abiertos. No abre salas nuevas hasta el próximo off → on, un `/room create`, o las 00:00 / 12:00 si se vuelve a encender antes.

**Elegibilidad (siempre):** estado `open` + nombres reales (no placeholders tipo “Winner of…”) + no existe sala.

## Qué es un battle ticket

Canal de texto privado = un partido. Nombre tipo `r1-equipo-vs-equipo` (con grupo: `a-r1-…`; ronda de perdedores: `lr1-…`).

La descripción del canal queda `Tournament ID: <id de Challonge guardado en add> | Match ID: <id del match>` para que se lea de un vistazo y schedule / upload reconozcan el partido. El vínculo también vive en la sala guardada.

Permisos del canal:

- `@everyone` no lo ve.
- Rol admin y rol helper **de ese torneo** pueden chatear (el mensaje pide ping al helper).
- De la hoja solo entran los **capitanes**. Cada uno puede ver el canal, leer el historial, escribir, reaccionar, adjuntar archivos, embeds y emojis externos.

El primer mensaje es un Components V2: título `lado VS lado` (emoji `vs`). En `1vs1` cada lado es el **tag** del capitán; en formatos de equipo, el **nombre del equipo**. Debajo, al mismo nivel, **Tournament:**, **Round:** y **Group:** (el grupo solo si el partido tiene grupo). Luego cada equipo: la línea del capitán al mismo nivel que los **in-game ID** (no como subtítulo) y el avatar del capitán, y los canales de reglas y deadline. El footer es el **Match ID** y la fecha y hora exactas en que terminan las **36 horas** (`día/mes/año` y hora), en la zona horaria de quien ve el mensaje. Ese V2 queda fijado en el canal. Después un mensaje de texto: el párrafo que menciona a los dos capitanes y al rol helper, y un blockquote de las **36 horas** o descalificación.

El lado de Challonge se busca en la copia de la hoja: en `1vs1` por el tag del capitán; en `2vs2`…`5vs5` por el nombre del equipo. Si un lado no está, o el capitán no tiene Discord ID o no está en el servidor, ese partido no se abre y se reporta.

## Torneos de dos etapas

- En grupos (`group_stages_underway`): solo partidos de grupo.
- Cuando los grupos cierran: **no** se crean salas para slots `pending` del cuadro final.
- En eliminación: solo partidos de etapa final que el bracket ya abrió.

## Desbordamiento de categorías

Discord limita 50 canales por categoría. El bot llena categoría 1 → 2 → 3 → 4. Si todas están llenas, el resto de la cola se reporta y no se abre.

`/room create`, y encender auto-room cuando abre salas, publican ese reporte en el canal: cuántas se crearon, cuántas quedaron bien, cuántas fallaron y cuántas no cupieron. **Issues** lista capitanes fuera del servidor o con Discord ID inválido. No nombra cada canal.

## Corrección aguas abajo

Si `/correct_bracket` cambia quién avanza y ya había un ticket abierto con los equipos viejos, ese ticket se **borra y se recrea** con los equipos correctos.

`/room available` no crea nada: enseña la cola (quién podría tener sala ahora, y quién está bloqueado por la hoja).

`/upload_score` solo se usa **dentro del ticket**. Reporta al bracket, completa el match, cierra/archiva, genera transcript. El siguiente ticket, si auto-room está on, espera a 00:00 o 12:00 UTC. Empate prohibido.

## Relacionado

- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Tickets: [tickets.md](tickets.md)
- Worker auto-room: [../platform/workers.md](../platform/workers.md)
- Comandos: [../commands/rooms-bracket.md](../commands/rooms-bracket.md)
