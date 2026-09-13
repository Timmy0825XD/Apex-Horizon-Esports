# Permisos — resumen

Fuente de actores: [../product/actors.md](../product/actors.md).

| Etiqueta en context | Significa |
|---|---|
| Admin | Administrator de Discord **o** `admin_role` de `/settings` |
| Organiser | `manager_role` de `/staff config` **o** Administrator |
| Discord Administrator | Solo el permiso nativo (recruit/fire, a veces `clear_category`) |
| Staff de torneo | Roles judge/recorder/staff del servidor, o admin/helper del torneo |
| Público | Cualquier miembro, solo en servidor |

Jerarquía Discord siempre gana: el bot no puede asignar un rol por encima del suyo, ni un humano puede gestionar roles iguales o superiores al propio.
