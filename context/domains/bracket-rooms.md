# Bracket y salas

El organizador crea y siembra el bracket **fuera**. El bot guarda la identidad del torneo en el bracket y una clave cifrada. Con eso:

- **Sincroniza** partidos (ronda, grupo/fase, nombres, estado y si es el partido de 3er puesto).
- **Reporta** un marcador (`/bracket upload`).
- **Descalifica** los dos lados (`/bracket dq both`): lado 1 avanza con `0` y pierde la llave siguiente sin ticket.
- **Corrige** un marcador ya subido (`/bracket correct`) y deja rastro de “antes / después”.

Empates en el bracket **no se aceptan**. El ganador se deduce del marcador.

## Estados del partido

| Estado | Significado operativo |
|---|---|
| `pending` | El cuadro lo proyecta, pero **aún no se puede jugar**. No se crea sala. |
| `open` | Ambos lados están definidos y el partido está listo. **Candidato a ticket.** |
| `completed` | Ya hay ganador en el bracket. No se reabre sala por auto-room. |

## Auto-room

Auto-room **no** se elige al dar de alta el torneo. Nace apagado. Solo `/room auto` lo cambia (`tournament` + `status`).

Al pasar de **off a on**, el bot abre en ese momento los partidos `open` que aún no tienen sala.

Mientras sigue **on**:

- Completar una llave **no** abre el siguiente ticket al instante.
- A las **00:00 UTC** y a las **12:00 UTC** se abre, de golpe, toda la cola que siga esperando.
- Si el bot estaba caído en esa hora, al volver recupera **la franja más reciente** que se perdió y abre la cola en ese momento (una sola vez, no una por cada franja perdida). El log **Rooms** lo indica como franja recuperada.
- `/room create` abre esa misma cola en el momento, sin esperar al reloj. También sirve con auto-room apagado y no lo enciende. `group` y `round` son opcionales: si van, solo se abren los partidos de ese grupo y/o esa ronda.

Apagarlo no cierra tickets ya abiertos. No abre salas nuevas hasta el próximo off → on, un `/room create`, o las 00:00 / 12:00 si se vuelve a encender antes.

**Elegibilidad (siempre):** estado `open` + nombres reales (no placeholders tipo “Winner of…”) + no existe sala.

## Qué es un battle ticket

Canal de texto privado = un partido. Nombre tipo `r1-equipo-vs-equipo` (con grupo: `a-r1-…`; ronda de perdedores: `lr1-…`).

La descripción del canal queda `Tournament ID: <id de Challonge guardado en add> | Match ID: <id del match>` para que se lea de un vistazo y schedule / upload reconozcan el partido. El vínculo también vive en la sala guardada.

Permisos del canal:

- `@everyone` no lo ve.
- Rol admin y rol helper **de ese torneo** pueden chatear (el mensaje pide a los capitanes hacer ping al helper; el bot no lo pingea).
- De la hoja solo entran los **capitanes** que están en el servidor. Cada uno puede ver el canal, leer el historial, escribir, reaccionar, adjuntar archivos, embeds y emojis externos.

El canal abre con **un solo** mensaje Components V2, fijado:

- Encima del container, un Text Display `Battle Ticket Open!` (emoji `party`) con la mención de los capitanes que están en el servidor. Es lo único del V2 que notifica.
- Dentro del container: torneo y fase (`Group A · Round 2`, `Losers Round 1`, sin grupo si no hay) en `-#` con el emoji `torneo`, y el título `lado VS lado` (emoji `vs`). En `1vs1` cada lado es el **tag** del capitán; en formatos de equipo, el **nombre del equipo**.
- Un párrafo que pide acordar fecha y hora con el rival y hacer ping al rol helper para crear el schedule. El rol se menciona sin ping.
- Cada equipo: nombre en `###`, el capitán mencionado (emoji `captains`), los **in-game ID** y el avatar del capitán (sin avatar si no está en el servidor).
- **Before you play**: canal de reglas, canal de deadline y la fecha y hora en que terminan las **36 horas** (absoluta y relativa, en la zona horaria de quien ve el mensaje). Debajo, en cita, el aviso de descalificación automática (emoji `alert`).
- Footer: **Match ID** y cuándo se abrió el ticket.

El lado de Challonge se busca en la copia de la hoja: en `1vs1` por el tag del capitán; en `2vs2`…`5vs5` por el nombre del equipo. Si un lado no está, o el capitán no tiene Discord ID o es inválido, ese partido no se abre y se reporta.

Si el Discord ID es válido pero el capitán **no está en el servidor**, el ticket se abre igual: el V2 sale completo, ese capitán no entra al canal ni recibe ping, y justo después del V2 el bot publica un mensaje de **texto plano** (emoji `alert`) que hace **ping al rol admin del torneo** y dice qué capitán (mención y equipo) no está en el servidor, para que lo añadan cuando entre. Si faltan los dos, un solo mensaje los nombra a ambos. El partido sale en el reporte como creado y el capitán en **Issues · Not in this server**.

## Torneos de dos etapas

- En grupos (`group_stages_underway`): solo partidos de grupo.
- Cuando los grupos cierran: **no** se crean salas para slots `pending` del cuadro final.
- En eliminación: solo partidos de etapa final que el bracket ya abrió.

## Desbordamiento de categorías

Discord limita 50 canales por categoría. El bot llena categoría 1 → 2 → 3 → 4. Si todas están llenas, el resto de la cola se reporta y no se abre.

`/room create`, y encender auto-room cuando abre salas, publican ese reporte en el canal: cuántas se crearon, cuántas quedaron bien, cuántas fallaron y cuántas no cupieron. **Issues** lista capitanes fuera del servidor (su ticket sí se abrió) o con Discord ID inválido (su ticket no). No nombra cada canal. En consola, el worker escribe el motivo de cada partido que no abrió.

## Corrección aguas abajo

Si `/bracket correct` cambia quién avanza y ya había ticket(s) en partidos descendientes con los equipos viejos, esos tickets se **borran**, sus puntajes en el bracket se **reinician**, y solo se **recrean** los que queden `open` con capitanes correctos. Antes de borrar/recrear hace falta confirmación (Confirm correction / Cancel): un Components V2 con el logo de Challonge, la lista de esos tickets y las consecuencias.

`/room available` no crea nada: enseña la cola (quién podría tener sala ahora, y quién está bloqueado por la hoja).

`/bracket upload` solo se usa **dentro del ticket**. Reporta al bracket, completa el match, renombra (sin `🔴`, solo `✅`), cierra/archiva, genera con el renderer propio el transcript del estado final visible (nombre = título del canal) y publica su Components V2 índice en el canal de transcripts, con el emoji `transcript_thumnail` de thumbnail. Si supera el límite seguro, lo divide en páginas HTML sin cortar mensajes. Enlaza la URL del índice al título de los posts de `/schedule results add` si existen (sin botón). En el ticket responde con un solo Components V2 que se edita en cada paso (marcador guardado, ticket archivado, transcript publicado) y termina con el botón **View transcript**. La advertencia y el éxito de `/bracket correct` son Components V2; el éxito lleva el emoji de Challonge como thumbnail. El siguiente ticket, si auto-room está on, espera a 00:00 o 12:00 UTC. Empate prohibido.

`/bracket dq both` tampoco tiene campos y solo se usa dentro del ticket. Reporta **lado 1 = 0** y **lado 2 = -1**, cierra el ticket igual que `upload`, y marca al lado 1. Esa marca hace que su siguiente partido `open` se reporte antes de crear sala: el marcado pierde **-1** y el rival gana **0**, sin ticket. Si los dos lados de esa llave están marcados, el marcador es otra vez lado 1 **0** / lado 2 **-1**, sin ticket, y el lado 1 sigue marcado hacia la próxima llave. `/room available` no las enseña. Corregir un marcador con negativo quita la marca de esos dos lados.

## Relacionado

- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Tickets: [tickets.md](tickets.md)
- Worker auto-room: [../platform/workers.md](../platform/workers.md)
- Comandos: [../commands/rooms-bracket.md](../commands/rooms-bracket.md)
