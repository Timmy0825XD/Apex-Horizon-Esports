# Interacciones que no son slash

Las mismas reglas de permiso y de “un partido / un schedule” aplican. Ver [../platform/workers.md](../platform/workers.md).

| Acción | Dónde | Qué decide |
|---|---|---|
| Asignarse Judge / Recorder | Post del schedule | Da acceso al ticket; actualiza embeds |
| Confirmed (T-10) | Recordatorio en el ticket | Evita expulsión a T-0 |
| Paginación | Validate, attendance, rooms, help | Recorre listas largas |
| Confirmar borrar categoría | `/utility clear_category` | Sin confirmación no se borra nada |
| Builder de embed | `/utility embed` | Sesión temporal de edición visual |

Asignar por botón de schedule se audita. Ver [../platform/audit.md](../platform/audit.md).
