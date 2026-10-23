# Salas y bracket

Reglas: [../domains/bracket-rooms.md](../domains/bracket-rooms.md). Worker: [../platform/workers.md](../platform/workers.md).

## `/auto_room`

Un solo comando. Organiser.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| status | BOOLEAN | Sí |

`status` true enciende la automatización. Si venía de off, abre en ese momento los partidos `open` sin sala y publica en el canal el mismo reporte que `/room create`. Los que se abran después esperan a **00:00 UTC** o **12:00 UTC**. `status` false apaga el escaneo y no cierra tickets. Ya encendido, apagado, y el error si el bracket no se puede leer, siguen efímeros. Si el bracket no se puede leer al encender, auto-room **sigue off**. Audita en **Bot Logs**.

## `/room create`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| group | STRING (Autocomplete) | No |
| round | STRING (Autocomplete) | No |

Abre la cola pendiente de ese torneo ahora. Sin `group` ni `round`, abre toda. Con uno o ambos, solo los partidos de ese grupo y/o esa ronda. Las opciones salen del bracket de **ese** torneo. No exige que auto-room esté encendido y **no cambia** el flag: si estaba off, sigue off. Misma tubería que el encendido y que el worker. Audita en **Bot Logs**.

La respuesta se publica en el canal (no efímera). V2 con **Created**, **Succeeded** y **Errors**, el cupo de las categorías abiertas (slots libres antes y después; si la cola no cabe, cuántos partidos siguen esperando) y, al final, **Issues**: capitán que no está en el servidor como `- @capitán (**tag** / **equipo**)`, o tag y equipo cuando el Discord ID es inválido o falta. No lista los canales creados.

## `/room available`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |

Solo lectura. Se publica en el canal (no efímero). V2 con barra verde: título *Available Rooms for* el torneo, `Showing 1 - 20 of N`, y cada partido en dos líneas: emoji `vs` **Match N** - Round N - Group N (el grupo solo si el torneo tiene grupos) y `nombre vs nombre`, con `_` escapado para que Discord no lo pinte en cursiva. A partir de **20** partidos hay Previous / Next. No audita.

## `/bracket upload`

**Solo dentro del ticket.** Staff de torneo (admin/helper del torneo, o roles staff/judge/recorder del servidor). Organiser también.

| Campo | Tipo | Obligatorio |
|---|---|---|
| score1 | INTEGER | Sí |
| score2 | INTEGER | Sí |
| note | STRING | No |

Reporta al bracket, completa el match, renombra el canal (quita el `🔴` del schedule si estaba y deja solo el prefijo `✅`), cierra/archiva y genera con el renderer propio un transcript HTML del estado final visible. Incluye texto y markdown, menciones, comandos y respuestas, embeds, Components V2, imágenes, reacciones, stickers, emojis y archivos no audiovisuales; excluye efímeros, hilos, audio, vídeo e historial eliminado/editado. El archivo se nombra como el canal (`✅…html`). En el canal de transcripts publica un **Components V2** con torneo, canal, enlace de descarga, el HTML adjunto y el emoji `transcript_thumnail` como thumbnail. Si supera el límite seguro de subida, publica varias partes HTML y el Components V2 enlaza el índice. Empate prohibido.

Respuesta en el canal (no efímera), **tres Components V2** con título grande, en este orden:

1. Confirmación de que el marcador se subió (torneo, enfrentamiento, score, ganador, canal). Thumbnail: avatar de quien ejecutó el comando.
2. Confirmación de que el canal se cerró y movió a categoría de archivados. Thumbnail: emoji `open_close`.
3. Confirmación de que se generó el transcript, con enlace al mensaje del HTML. Thumbnail: emoji `transcript_thumnail`.

Al publicar el transcript llama `attachResultsTranscript` con la URL de ese mensaje para enlazar el título de los embeds de `/schedule results` (ticket y canal de resultados). El siguiente ticket espera al reloj si auto-room está on. Log: **Score Upload**.

## `/bracket dq_both`

**Solo dentro del ticket.** Sin campos. Mismo rol que `upload` (staff de torneo u Organiser).

Marca ese partido **lado 1 = 0**, **lado 2 = -1**. En Challonge gana el número más alto, así que el lado 1 avanza y el lado 2 queda eliminado. El lado 1 queda marcado: debe perder la llave a la que avanza. El ticket actual se cierra como `upload` (renombre `✅`, archivo, transcript). La primera confirmación es un Components V2 rojo de descalificación doble (avatar de quien ejecutó). El cierre y el transcript reutilizan sus propios V2. Log: **Score Upload**.

Cuando la llave siguiente ya tiene los dos lados y está `open`, el bot la reporta **antes** de crear sala:

- Si solo uno viene marcado: ese lado recibe **-1** y el otro **0**. El limpio avanza. No hay ticket. Se le quita la marca al que perdió.
- Si los dos vienen marcados (el comando se usó en las dos llaves que alimentan ese partido): lado 1 recibe **0** y lado 2 **-1**. No hay ticket. El lado 1 **sigue marcado**, y la llave de después se descalifica igual.

Si el rival todavía no está, la marca espera. Completar el otro partido (`upload`, otro `dq_both` o `correct`), `/room create`, encender auto-room o el reloj de 00:00 / 12:00 UTC aplican la marca en cuanto el partido está `open`. Esas llaves no se listan en `/room available` ni abren ticket. Cada forfeit automático también va a **Score Upload**.

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

Si el **ganador no cambia** (solo el marcador), o cambia pero **no hay tickets aguas abajo** que dependan de esa llave: un solo Components V2 de éxito, con el emoji de Challonge como thumbnail. El mismo V2 reemplaza la advertencia al aceptar.

Si el ganador **cambia** y ya existían tickets abiertos/cerrados en partidos descendientes (llaves que se completaron con el ganador viejo):

1. Primero un **Components V2** de confirmación (título grande, thumbnail con el logo de Challonge). Muestra el marcador actual → nuevo, el ganador nuevo, cada ticket que se borrará, en viñetas **Channel**, **Round** (con grupo si hay) y **Status** y qué pasa al aceptar: se borran esos tickets y sus schedules, se reinician sus puntajes, se recrean los que queden `open` y los que sigan esperando ganador no se abren. Botones **Aceptar** / **Cancelar** (solo quien lanzó el comando). Al pulsar cualquiera, ambos se bloquean al instante y el resultado reemplaza el aviso cuando termina.
2. Al aceptar: esos tickets se **borran**, sus puntajes en Challonge se **reinician** (reopen), se aplica el marcador nuevo, y se **recrean** solo los tickets de partidos que queden `open` con ambos lados definidos y capitanes correctos. Los que queden a la espera de un ganador no se reabren hasta que esa llave vuelva a estar lista.
3. Al cancelar: no se toca nada.

Relación: distinto de `/ticket delete` (ese no toca el bracket).
