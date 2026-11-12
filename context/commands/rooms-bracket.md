# Salas y bracket

Reglas: [../domains/bracket-rooms.md](../domains/bracket-rooms.md). Worker: [../platform/workers.md](../platform/workers.md).

## `/room auto`

Un solo comando. Organiser.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| status | BOOLEAN | Sí |

`status` true enciende la automatización. Si venía de off, abre en ese momento los partidos `open` sin sala y publica en el canal el mismo reporte que `/room create`. Los que se abran después esperan a **00:00 UTC** o **12:00 UTC**. `status` false apaga el escaneo y no cierra tickets. Ya encendido, apagado, y el error si el bracket no se puede leer, siguen efímeros. Los avisos son V2 con `## Auto-room On` / `Auto-room Off` / `Auto-room Already On` / `Auto-room Already Off` y el torneo. Encendido muestra **Next run** como hora relativa (00:00 o 12:00 UTC) y está en verde; apagado está en rojo; *already* en azul. Llevan footer con autor y hora, o con la mención del comando que toca. Si al encender se abren tickets, el reporte es el de `/room create` titulado *Auto-room On*, con la línea **Next run**. Si el bracket no se puede leer al encender, auto-room **sigue off**. Audita en **Rooms**.

## `/room create`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| group | STRING (Autocomplete) | No |
| round | STRING (Autocomplete) | No |

Abre la cola pendiente de ese torneo ahora. Sin `group` ni `round`, abre toda. Con uno o ambos, solo los partidos de ese grupo y/o esa ronda. Las opciones salen del bracket de **ese** torneo. No exige que auto-room esté encendido y **no cambia** el flag: si estaba off, sigue off. Misma tubería que el encendido y que el worker. Audita en **Rooms**.

La respuesta se publica en el canal (no efímera). V2 con el icono del servidor como thumbnail:

- `## Battle Tickets Created` (verde), `Battle Tickets Opened` (naranja, con errores, partidos esperando o tickets sin un capitán) o `No Tickets Opened` (rojo). Si se filtró, `group`/`round` en `-#`, y el torneo.
- Separador, y **Created**, **Errors** y **Waiting** en una línea, con viñetas para lo que falló (fuera de la hoja, canal no creado, bienvenida fallida) y para los tickets abiertos sin un capitán (los organizadores recibieron ping dentro).
- **Categories** y **Free slots** antes → después, con una viñeta si la cola no cabe.
- Al final **Issues**: capitán que no está en el servidor como `- @capitán · **equipo**`, o `- **tag** · **equipo** · id` cuando el Discord ID es inválido o falta.
- Footer `Opened by` con mención, hora y la mención de `/room available`.

No lista los canales creados.

## `/room available`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |

Solo lectura. Se publica en el canal (no efímero). V2 de barra verde:

- `## Available Rooms`, y el torneo con cuántos partidos están listos.
- Separador, y cada partido en una línea: número, emoji `vs`, los dos lados en negrita y la fase en cursiva (el grupo solo si el torneo tiene grupos). Los `_` van escapados para que Discord no los pinte en cursiva.
- Si hay partidos bloqueados por la hoja, una línea con `alert` y cuántos son.
- Footer `-# Showing a–b of N` con la mención de `/room create`.
- A partir de **20** partidos, flechas e indicador `1/N`. No audita.

## `/bracket upload`

**Solo dentro del ticket.** Admin o helper de ese torneo, u Organiser.

| Campo | Tipo | Obligatorio |
|---|---|---|
| score1 | INTEGER | Sí |
| score2 | INTEGER | Sí |
| note | STRING | No |

Reporta al bracket, completa el match, renombra el canal (quita el `🔴` del schedule si estaba y deja solo el prefijo `✅`), cierra/archiva y genera con el renderer propio un transcript HTML del estado final visible. Incluye texto y markdown, menciones, comandos y respuestas, embeds, Components V2, imágenes, reacciones, stickers, emojis y archivos no audiovisuales; excluye efímeros, hilos, audio, vídeo e historial eliminado/editado. El archivo se nombra como el canal (`✅…html`). En el canal de transcripts publica un **Components V2** con torneo, canal, enlace de descarga, el HTML adjunto y el emoji `transcript_thumnail` como thumbnail. Si supera el límite seguro de subida, publica varias partes HTML y el Components V2 enlaza el índice. Empate prohibido.

Respuesta en el canal (no efímera): **un solo Components V2** que se edita en cada paso. Thumbnail: el logo de Challonge.

- `## Score Uploaded` y la fase en `-#` (`Group X · Round N`; sin grupo, solo la ronda).
- Marcador en `###` con el emoji `winner` en el ganador, y debajo el torneo y la mención del ticket.
- `note`, si la hay, en cita.
- Pasos: **Score saved** on Challonge → **Ticket archived** (emoji `open_close`) → **Transcript published** con el canal de transcripts (emoji `transcript`). El paso en curso sale en `-#` (*Archiving the ticket…*, *Publishing the transcript…*). Uno fallido sale con el emoji `error` y lo que hay que hacer a mano.
- Footer `-# Uploaded by` con mención y la fecha y hora. Al publicar el transcript se añade el botón de enlace **View transcript** al mensaje del HTML.
- Acento naranja mientras trabaja o si falla un paso; verde cuando termina todo.

Al publicar el transcript llama `attachResultsTranscript` con la URL de ese mensaje para enlazar el título de los embeds de `/schedule results add` (ticket y canal de resultados). El siguiente ticket espera al reloj si auto-room está on. Log: **Score Upload**, publicado en cuanto Challonge acepta el marcador (antes de cerrar el ticket).

Si Challonge ya aceptó el marcador y después falla un paso de Discord (categorías de archivados llenas, transcript), el comando **no** dice que la subida falló: avisa en privado de qué quedó pendiente (*Ticket not archived* o *Transcript not generated*) para terminarlo a mano. `/bracket dq both` sigue la misma regla.

## `/bracket dq both`

**Solo dentro del ticket.** Sin campos. Mismo rol que `upload` (admin o helper de ese torneo, u Organiser).

Marca ese partido **lado 1 = 0**, **lado 2 = -1**. En Challonge gana el número más alto, así que el lado 1 avanza y el lado 2 queda eliminado. El lado 1 queda marcado: debe perder la llave a la que avanza. El ticket actual se cierra como `upload` (renombre `✅`, archivo, transcript). La respuesta es la misma tarjeta única de `upload`, en rojo, con `## Both Sides Disqualified` y el emoji `banned` como thumbnail. Lleva el marcador `0` vs `-1`, **Advances** (con la nota de que pierde su próxima llave) y **Eliminated**. Si la marca sigue esperando rival, lo dice en `-#`. Los forfeits automáticos van en **Forfeited before a ticket**, cada uno con marcador y fase. Siguen los mismos pasos de cierre y el footer `Disqualified by`. Log: **Score Upload**.

Cuando la llave siguiente ya tiene los dos lados y está `open`, el bot la reporta **antes** de crear sala:

- Si solo uno viene marcado: ese lado recibe **-1** y el otro **0**. El limpio avanza. No hay ticket. Se le quita la marca al que perdió.
- Si los dos vienen marcados (el comando se usó en las dos llaves que alimentan ese partido): lado 1 recibe **0** y lado 2 **-1**. No hay ticket. El lado 1 **sigue marcado**, y la llave de después se descalifica igual.

Si el rival todavía no está, la marca espera. Completar el otro partido (`upload`, otro `dq both` o `correct`), `/room create`, encender auto-room o el reloj de 00:00 / 12:00 UTC aplican la marca en cuanto el partido está `open`. Esas llaves no se listan en `/room available` ni abren ticket. Cada forfeit automático también va a **Score Upload**.

`/bracket correct` sobre un marcador que tenía un negativo quita la marca de los dos lados de ese partido.

## `/bracket correct`

Organiser. Enmienda un marcador ya reportado.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| match | STRING (Autocomplete) | Sí |
| score1 | INTEGER | Sí |
| score2 | INTEGER | Sí |

Empate prohibido. Deja rastro de marcador anterior → nuevo en el embed y en el log **Score Upload**.

Si el **ganador no cambia** (solo el marcador), o cambia pero **no hay tickets aguas abajo** que dependan de esa llave: un solo Components V2 de éxito, con el emoji de Challonge como thumbnail: `## Bracket Corrected`, la fase, el marcador nuevo en `###` con `winner`, **Before** → **now**, **Rooms rebuilt** si se rehicieron tickets, y footer `Corrected by` con mención y hora. El mismo V2 reemplaza la advertencia al confirmar.

Si el ganador **cambia** y ya existían tickets abiertos/cerrados en partidos descendientes (llaves que se completaron con el ganador viejo):

1. Primero un **Components V2** naranja de confirmación (`## Confirm Bracket Correction`, la fase en `-#`, thumbnail con el logo de Challonge). Muestra el marcador actual → nuevo, el ganador nuevo, el torneo, y cada ticket que se borrará en una línea (canal · fase · **Open**/**Closed**, máx. 12 y *and N more*). Después, en tres viñetas, qué pasa al confirmar: se borran esos tickets y sus schedules, se reinician sus puntajes, se recrean los que queden `open` y los demás esperan su ronda. Botones **Confirm correction** (rojo) y **Cancel**, que solo pulsa quien lanzó el comando, como dice el `-#` de encima. Al pulsar cualquiera, ambos se bloquean al instante y el resultado reemplaza el aviso cuando termina.
2. Al confirmar: esos tickets se **borran**, sus puntajes en Challonge se **reinician** (reopen), se aplica el marcador nuevo, y se **recrean** solo los tickets de partidos que queden `open` con ambos lados definidos y capitanes correctos. Los que queden a la espera de un ganador no se reabren hasta que esa llave vuelva a estar lista.
3. Al cancelar: no se toca nada. El aviso pasa a un V2 azul `## Correction Cancelled` con el footer `Cancelled by`.

Relación: distinto de `/ticket delete` (ese no toca el bracket).
