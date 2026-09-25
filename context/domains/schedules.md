# Schedules: tiempo, staff y confirmación

Un partido tiene **como máximo un schedule activo**. Se crea **dentro del ticket**. La hora es UTC y debe quedar **al menos 10 minutos en el futuro**.

Sin `schedules_channel` de `/settings` no hay `/schedule create`.

Las respuestas del comando son Components V2, publicadas en el canal. El post del schedule creado (ticket y canal de schedules) es el embed clásico. Nada de este flujo es efímero.

| Acción | Rol |
|---|---|
| Crear, actualizar, borrar | Admin o helper **de ese torneo** |
| Ver (`show`), listar sin asignar, refresh | **Staff** del servidor |
| Declarar o borrar results | **Judge** del servidor |
| Resign | Solo el asignado, en el ticket |

El capitán no ejecuta ningún subcomando.

## Al crear

- Crear es atómico: posts, punto rojo y evento quedan juntos. Si un paso falla o tarda demasiado, se deshace todo y el comando responde con el error. No se queda en “pensando”.
- Se publican dos embeds (ticket + canal de schedules).
- `judge` y `recorder` solo se asignan si ese usuario tiene el rol de juez o de grabador. Si no lo tiene, no se crea ni se actualiza el schedule.
- Se crea un evento externo del servidor: nombre `lado vs lado`, portada del thumbnail, inicio a la hora UTC y fin 30 minutos después, ubicación el nombre del servidor, y la descripción con torneo, grupo, ronda, hora local, canal, capitanes y staff.
- Si hay Judge/Recorder en el comando, se asignan *después* de publicar (el anuncio no espera a la hoja).
- El canal del partido lleva prefijo `🔴` mientras el schedule vive.
- Miniatura en el canal de thumbnails de `/settings`, con el fondo que le toca en la rotación.

## Fondos de thumbnail

Los archivos viven en `assets/backgrounds/`, numerados `1.png` … `10.png`. No existe `0.png`. Cada schedule nuevo del servidor toma el siguiente número. Después de `10` vuelve a `1`. Dos schedules seguidos no comparten fondo; a partir del undécimo el ciclo se repite.

El bot compone sobre ese fondo una tarjeta 16:9 de estilo esports con la identidad negra, dorada y roja de Apex Horizon. De arriba abajo: icono del servidor donde se ejecuta (si tiene), nombre del torneo, etapa, `team_1 vs team_2`, fecha y hora UTC, y el nombre del servidor. El nombre del torneo usa **Ubuntu Medium** (peso 500; [Google Fonts](https://fonts.google.com/specimen/Ubuntu)). Los textos se normalizan en mayúsculas; los nombres largos primero reducen la fuente y, si aún no caben, terminan en elipsis. Ningún texto puede salir del lienzo ni invadir el `VS`.

Etapa impresa: con grupo, `GROUP A · ROUND n`; ronda negativa, `LOSERS ROUND n`; la última ronda del cuadro de ganadores es `FINAL` (`GRAND FINAL` si hay cuadro de perdedores); la anterior a la final en eliminación simple es `SEMIFINAL`; el partido cuyos dos lados llegan como perdedores de otro partido es `3RD PLACE`. El resto: `ROUND n`. El indicador de 3er puesto lo trae Challonge (`player1_is_prereq_match_loser` y `player2_is_prereq_match_loser`) y se guarda en el partido al sincronizar el bracket.

El schedule guarda su número. `regenerate_image` reconstruye la tarjeta con **ese** fondo y los datos actuales, la aplica al embed, al mensaje del canal de thumbnails y a la portada del evento. No consume el siguiente número. Cambiar la fecha u hora también reconstruye la imagen automáticamente.

## Al actualizar fecha/hora

Basta un trozo (`hour`, `minute`, `day`, `month` o `year`). El resto se conserva de la hora ya guardada. La fecha resultante, en el momento del comando, no puede estar en el pasado ni a menos de 10 minutos. Si la hora cambia, se **reinicia** el flujo de recordatorio y urgencia (se borran mensajes viejos de T-10 / T-0).

## Botones

Los botones verdes **Assign** viven solo en el post del canal de schedules. El ticket no los lleva. Al crear, el staff chat recibe **New Schedule** solo por los puestos que quedaron libres: si ya hay juez, menciona solo grabador, y al revés. Si ambos vienen asignados, no se envía. Quien tiene el rol pulsa, el bot guarda el puesto, abre el ticket, actualiza el embed, escribe en el ticket, en texto plano, que quedó asignado y cierra con el emoji de arrive. La renuncia usa el mismo texto y cierra con el emoji de resign. Ese mismo aviso sale siempre que un juez o recorder se vincula o se suelta: al preasignarlo en `/schedule create`, al asignarlo, reemplazarlo o quitarlo en `/schedule update`, al pulsarlo, al hacer `/schedule resign` y cuando el worker lo saca a las T-0. Le responde en privado. El mismo botón se apaga. Siguen activos **10 minutos** tras crear, tras `/schedule refresh`, o tras el post urgente. Después se bloquean. Un puesto lleno sigue apagado aunque se refresque.

El recordatorio T-10 va en el ticket: menciona capitanes y staff, pide leer las reglas del torneo, y repite el embed del schedule con el pie **Staff Confirmation Required**. Cada puesto ocupado tiene un botón **Present** (azul) que pasa a **Confirmed** (verde, apagado). Solo el asignado puede pulsarlo, y solo antes de la hora. El ticket anuncia la confirmación.

Dos minutos antes, si falta un puesto o alguien asignado no confirmó, el canal de schedules recibe un **mensaje rojo nuevo** que menciona solo ese rol y reactiva los botones 10 minutos en ese mensaje y en el post original. Si ambos confirmaron, no hay urgencia. A las T-0, quien estaba asignado y no confirmó queda como renuncia, pierde el ticket y el ticket lo dice.

## Salidas y borrado

- `/schedule resign` es la salida voluntaria (Judge, Recorder o ambos). El partido puede volver a `/schedule unassigned`.
- `/schedule delete` (con confirmación) borra embeds, recordatorios, urgencias y quita el `🔴`. No se recupera.

## Results (declaración pública, no bracket)

`/schedule results` lo ejecuta quien tiene el rol **judge**. Exige: schedule existente, hora ya pasada, un solo resultado por schedule. El único empate permitido es **0 - 0**. Las imágenes son opcionales. Publica el embed en el ticket y en el canal de resultados: la misma tarjeta del schedule, con **Results** y **Links**. **Links** queda vacío hasta que `/attendance mark` o `/link add` (aún no implementados) llamen `attachResultsLinks`. El título se enlaza al mensaje del transcript cuando `/upload_score` lo publique y llame `attachResultsTranscript`. El capitán no interviene.

`/schedule results_delete` también lo ejecuta el rol **judge**. Quita la declaración del ticket y del canal de resultados; **no** borra el schedule. **No** deshace `/upload_score`.

## Relacionado

- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Worker T-10/T-0: [../platform/workers.md](../platform/workers.md)
- Asistencia: [attendance-payroll.md](attendance-payroll.md)
- Comandos: [../commands/schedule.md](../commands/schedule.md)
