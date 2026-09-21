# Actores y autoridad

La autoridad no es “quien tiene un rol bonito”. Es **alcance**.

| Actor | Alcance real |
|---|---|
| **Administrador del servidor** (permiso Discord o rol admin del bot) | Configura el servidor, crea/borra torneos, recluta/despide staff, ve nómina agregada |
| **Organiser** (rol manager del servidor) | Opera el torneo a nivel de salas, tickets, lookup de equipos (`/team`), rol de participantes (`/tournament role`), roles masivos, bans de usuario, muchas acciones de bracket |
| **Admin / Helper del torneo** | Roles *de ese torneo*: scores, schedules, ayuda operativa |
| **Judge** | Entra al ticket cuando hay schedule; marca asistencia; confirma T-10 |
| **Recorder** | Igual que Judge en el ticket; dueño de los links de YouTube de *su* asistencia |
| **Capitán** | Solo su ticket; puede declarar resultado de schedule con pruebas (no sube el bracket) |
| **Público** | Consultas que no mutan estado (info de servidor, headers de hoja, ping, about/help) |

Jerarquía Discord siempre gana: el bot no puede asignar un rol por encima del suyo, ni un humano puede gestionar roles iguales o superiores al propio.

## Recruit vs fire

Reclutar un puesto **añade un paquete de roles** (p. ej. Judge implica también Staff). Despedir puede ser selectivo o **Complete** (todos los roles de staff configurados). Eso no toca asignaciones de partidos ya jugados; solo Discord.

## Etiquetas de permiso (resumen operativo)

| Etiqueta | Significa |
|---|---|
| Admin | Administrator de Discord **o** `admin_role` de `/settings` |
| Organiser | `manager_role` de `/staff config` **o** Administrator |
| Discord Administrator | Solo el permiso nativo (recruit/fire, a veces `clear_category`) |
| Staff de torneo | Roles judge/recorder/staff del servidor, o admin/helper del torneo |
| Público | Cualquier miembro, solo en servidor |

Detalle por comando: [../commands/permissions.md](../commands/permissions.md)

## Relacionado

- Config servidor: [../commands/settings.md](../commands/settings.md), [../commands/staff.md](../commands/staff.md)
- Config torneo: [../commands/tournament.md](../commands/tournament.md)
