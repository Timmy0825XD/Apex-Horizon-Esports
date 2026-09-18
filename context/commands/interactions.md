# Interacciones que no son slash

Las mismas reglas de permiso y de “un partido / un schedule” aplican. Ver [../platform/workers.md](../platform/workers.md).

| Acción | Dónde | Qué decide |
|---|---|---|
| Asignarse Judge / Recorder | Post del schedule | Da acceso al ticket; actualiza embeds |
| Confirmed (T-10) | Recordatorio en el ticket | Evita expulsión a T-0 |
| About / Help / Ping | Paneles de `/bot` | Cambia de vista en el mismo mensaje |
| Paginación de help | `/bot help` | Previous / Next por familia de comandos |
| Paginación | Validate, attendance, rooms | Recorre listas largas |
| Confirmar borrar categoría | `/utility clear_category` | Sin confirmación no se borra nada |
| Builder de embed | `/utility embed` · `/utility edit_embed` | Sesión temporal de edición visual (embed clásico) |
| Builder de Components V2 | `/utility v2` · `/utility edit_v2` | Sesión temporal de edición visual (container, text, section, media) |

Asignar por botón de schedule se audita. Ver [../platform/audit.md](../platform/audit.md).
