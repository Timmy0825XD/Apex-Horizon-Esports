# Stack técnico

| Pieza | Decisión |
|---|---|
| Runtime | **Node.js** (>= 20) |
| Lenguaje | **TypeScript** |
| Paquetes | **npm** |
| Cliente Discord | **discord.js** |
| Base de datos | **MongoDB** (almacén de config, torneos, partidos, schedules, asistencia, bans) |
| ORM | **Prisma** (conector MongoDB) |
| Deploy | **HiddenCloud** |

El bot habla con Discord por Gateway (comandos slash, botones) y publica auditoría por **webhooks**. Ver [gateway.md](gateway.md) y [audit.md](audit.md).

Los slash se registran **solo** en los gremios de `ALLOWED_GUILDS`. No se introduce otro runtime ni cola hasta que haga falta de verdad.

El esquema Prisma vive en `prisma/schema.prisma`. Una base (`apex_horizon`): `guilds`, `tournaments`, `matches`, `rooms`, `schedules`, `attendances`, `bans`. El cliente está en `src/lib/prisma.ts`.

## Relacionado

- Estructura: [structure.md](structure.md)
- Alcance de gremios: [ux.md](ux.md)
- Calidad en código: regla local `bot-structure`
