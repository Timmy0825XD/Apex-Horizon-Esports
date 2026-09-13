# Stack técnico

| Pieza | Decisión |
|---|---|
| Runtime | **Node.js** |
| Lenguaje | **TypeScript** |
| Paquetes | **npm** |
| Base de datos | **MongoDB** (almacén de config, torneos, partidos, schedules, asistencia, bans) |
| Deploy | **HiddenCloud** |

El bot habla con Discord por Gateway (comandos, botones) y publica auditoría por **webhooks**. Ver [gateway.md](gateway.md) y [audit.md](audit.md).

No se introduce otro runtime, ORM o cola hasta que haga falta de verdad. El cliente de Discord se fija al hacer el scaffold, no antes.

## Relacionado

- Estructura: [structure.md](structure.md)
- Calidad en código: regla local `bot-structure`
