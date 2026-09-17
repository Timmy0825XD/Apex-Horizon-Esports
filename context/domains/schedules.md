# Schedules: tiempo, staff y confirmación

Un partido tiene **como máximo un schedule activo**. Se crea **dentro del ticket**. La hora es UTC y debe quedar **al menos 10 minutos en el futuro**.

Sin `schedules_channel` de `/settings` no hay `/schedule create`.

## Al crear

- Se publican dos embeds (ticket + canal de schedules).
- Si hay Judge/Recorder en el comando, se asignan *después* de publicar (el anuncio no espera a la hoja).
- El canal del partido lleva prefijo `🔴` mientras el schedule vive.
- Miniatura opcional en el canal de thumbnails de `/settings`.

## Al actualizar fecha/hora

Se **reinicia** el flujo de recordatorio y urgencia (se borran mensajes viejos de T-10 / T-0). La nueva hora también debe cumplir +10 minutos.

## Botones del post de schedule

- Asignarse Judge o Recorder (mientras la ventana de botones esté viva; `/schedule refresh` la renueva).
- El recordatorio T-10 pide **Confirmed** por rol.

A las T-0, el staff no confirmado **pierde el acceso al ticket**. El canal de schedules recibe un embed rojo y menciona solo los roles que siguen faltando (`@Judge` y/o `@Recorder`).

## Salidas y borrado

- `/schedule resign` es la salida voluntaria (Judge, Recorder o ambos). El partido puede volver a `/schedule unassigned`.
- `/schedule delete` (con confirmación) borra embeds, recordatorios, urgencias y quita el `🔴`. No se recupera.

## Results (declaración pública, no bracket)

`/schedule results` exige: schedule existente, hora ya pasada, no empate, al menos una imagen de prueba, un solo resultado por schedule. El título del embed enlaza al transcript cuando exista.

`/schedule results_delete` quita esa declaración; **no** borra el schedule. **No** deshace `/upload_score`.

## Relacionado

- Ciclo: [../product/match-lifecycle.md](../product/match-lifecycle.md)
- Worker T-10/T-0: [../platform/workers.md](../platform/workers.md)
- Asistencia: [attendance-payroll.md](attendance-payroll.md)
- Comandos: [../commands/schedule.md](../commands/schedule.md)
