# Schedule

Reglas: [../domains/schedules.md](../domains/schedules.md). Todos los de creación/cambio **excepto show / unassigned** se auditan.

Toda la familia responde con **Components V2**, publicado en el canal. Los embeds clásicos son el post del schedule (ticket y canal de schedules) y la declaración de results (ticket y canal de resultados). Ningún mensaje de este flujo es efímero. El capitán no ejecuta ningún subcomando.

| Subcomando | Quién |
|---|---|
| `create` · `update` · `delete` | Rol **admin** o **helper** de ese torneo |
| `show` · `unassigned` · `refresh` | Rol **staff** del servidor (`/staff config`) |
| `results` · `results_delete` | Rol **judge** del servidor |
| `resign` | Solo quien está asignado a ese schedule, dentro del ticket |

## `/schedule create`

**Solo ticket.** Admin o helper del torneo. Requiere canal de schedules.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| hour | INTEGER | Sí | UTC |
| minute | INTEGER | Sí | UTC |
| day | INTEGER | Sí | |
| month | INTEGER | Sí | |
| year | INTEGER | Sí | |
| judge | USER | No | Preasignar. Tiene que tener el rol **judge** |
| recorder | USER | No | Preasignar. Tiene que tener el rol **recorder** |
| remark | STRING | No | Máx. 130 |

Mínimo +10 minutos. Marca `🔴`. Admin o helper del torneo. Posts, punto rojo y evento son una sola operación: si uno falla, se borran el resto y el comando responde el error. Si el create trae juez o recorder, el ticket publica el mismo texto plano que el botón Assign. La respuesta al crear es el texto `Match scheduled successfully. Thumbnail generated.` con el emoji de éxito, no un Components V2. Relación: attendance, results, worker T-10/T-0, thumbnails de settings.

## `/schedule update`

**Solo ticket.** Admin o helper del torneo. `hour`, `minute`, `day`, `month` y `year` son opcionales y se pueden mandar de uno en uno: el trozo que falta se conserva. La fecha resultante no puede estar en el pasado ni a menos de 10 minutos en el momento del comando. También `judge`, `recorder`, `note`, `remove_judge`, `remove_recorder`, `reason`, `regenerate_image`. Al menos un campo. `judge` y `recorder` solo se aceptan si ese usuario tiene el rol correspondiente; si no, no se actualiza nada. Asignar publica en el ticket el texto del botón Assign. Quitar o reemplazar publica el texto de resign del puesto anterior y, si entra alguien nuevo, el de Assign. Recalendarizar resetea recordatorios. `regenerate_image` vuelve a aplicar el fondo ya asignado a ese schedule sobre el embed y el post del canal de thumbnails. No avanza la rotación.

## `/schedule show`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| match | STRING (Autocomplete) | Sí |

Embed publicado en el canal. Rol staff. No audita.

## `/schedule delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

`confirm=False` cancela. Quita `🔴`. Admin o helper del torneo.

## `/schedule unassigned`

| Campo | Tipo | Obligatorio |
|---|---|---|
| filter | STRING (Choice) | Depende de implementación | `all` · `missing_judge` · `missing_recorder` · `any` |

Consulta. Rol staff. Alimenta reclutamiento de staff de mesa.

## `/schedule refresh`

**Solo ticket.** Rol staff. Abre otra vez los botones de reclamar durante 10 minutos. Un puesto ya ocupado sigue apagado. No cambia la hora.

## `/schedule resign`

**Solo ticket, solo el asignado.**

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | STRING (Choice) | No | Judge · Recorder · Both |
| reason | STRING | No | `.` si es privado |
| regenerate_image | BOOLEAN | No | Reaplica el fondo ya asignado |

## `/schedule results`

**Solo ticket.** Rol judge. Hora ya pasada. El único empate permitido es **0 - 0**. Una declaración por schedule. El capitán no declara.

| Campo | Tipo | Obligatorio |
|---|---|---|
| team_1 | INTEGER | Sí | 0–99 |
| team_2 | INTEGER | Sí | 0–99 |
| notes | STRING | No | Máx. 500. Sale como **Remarks** |
| image1 … image10 | ATTACHMENT | No | Pruebas. Todas opcionales |

Publica el mismo embed en el ticket y en `result_channel`. Solo el ticket lleva encima el texto **Match Complete** con los capitanes. Es la tarjeta del schedule, en verde, con la hora de la declaración (**Result UTC Time** / **Result Local Time**), más **Results** (marcador; el ganador lleva el trofeo) y **Links**. Links nace vacío: lo llenan `/attendance mark` y `/link add` cuando existan, llamando `attachResultsLinks` con la lista completa. El título no lleva enlace hasta que `/upload_score` transcriba el ticket y llame `attachResultsTranscript` con la URL de ese mensaje. No sube el bracket. Relación: `/upload_score`, `/schedule results_delete`.

## `/schedule results_delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

Rol judge. No borra el schedule.
