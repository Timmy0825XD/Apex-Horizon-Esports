# Stack técnico

| Pieza | Decisión |
|---|---|
| Runtime | **Node.js** (>= 20) |
| Lenguaje | **TypeScript** |
| Paquetes | **npm** |
| Cliente Discord | **discord.js** |
| Transcripts | **discord-html-transcripts** (archivo HTML de battle tickets) |
| Base de datos | **MongoDB** (almacén de config, torneos, partidos, schedules, asistencia, bans) |
| ORM | **Prisma** (conector MongoDB) |
| Deploy | **HiddenCloud** |

El bot habla con Discord por Gateway (comandos slash, botones) y publica auditoría por **webhooks**. Ver [gateway.md](gateway.md) y [audit.md](audit.md).

Los slash se registran **solo** en los gremios de `ALLOWED_GUILDS`. No se introduce otro runtime ni cola hasta que haga falta de verdad.

El esquema Prisma vive en `prisma/schema.prisma`. Una base (`apex_horizon`): `guilds`, `tournaments`, `stored_sheets`, `matches`, `rooms`, `schedules`, `attendances`, `bans`. El cliente está en `src/lib/prisma.ts`. Las claves de Challonge se guardan cifradas (`ENCRYPTION_KEY`, AES-256-GCM).

## Deploy en HiddenCloud

El host no recibe un zip. El archivo de arranque es [`startup.js`](../../startup.js), subido **una vez** a la raíz del contenedor. El comando del egg es `node startup.js`. El egg tiene que ser **Node.js 20 o superior**, con `git` y `npm`.

En cada apagado/encendido, con `AUTO_UPDATE=1` (el defecto):

1. Clona o actualiza la rama (`BRANCH`, por defecto `develop`) en `apex-horizon/`.
2. `npm install` con devDependencies (`tsc` y el CLI de Prisma no están en dependencies).
3. `npm run build` (`prisma generate` y `tsc`).
4. `node apex-horizon/dist/index.js`.

Si el binario de `sharp` no corresponde a la plataforma del host, borra `node_modules` y reinstala.

HiddenCloud no tiene panel de variables. Los secretos van en `apex-horizon/.env` (el mismo archivo que en local). `startup.js` lo lee antes de instalar y de arrancar, y lo guarda fuera de la carpeta antes de un clone destructivo para volver a dejarlo en su sitio. Un `git checkout` no lo toca: está en `.gitignore`.

| Clave en `.env` | Uso |
|---|---|
| `DISCORD_TOKEN` | Token del bot. Obligatoria para arrancar. |
| `DISCORD_CLIENT_ID` | Application ID. Obligatoria. |
| `ALLOWED_GUILDS` | IDs de gremio, separados por coma. Obligatoria. |
| `DATABASE_URL` | MongoDB. Obligatoria: Prisma la lee al generar el cliente. |
| `ENCRYPTION_KEY` | 64 hex. Hace falta para Challonge; el proceso arranca sin ella. |

La rama y el repo van por defecto a `develop` y al GitHub del proyecto. `BRANCH`, `GIT_ADDRESS`, `USERNAME`, `ACCESS_TOKEN` y `AUTO_UPDATE` solo hacen falta si eso cambia; el token de git no se escribe en el remote ni en el log.

El log imprime el commit corto (`develop @ abc1234`) antes de instalar. Apagar y prender el servidor es el deploy.

## Relacionado

- Estructura: [structure.md](structure.md)
- Alcance de gremios: [ux.md](ux.md)
- Calidad en código: regla local `bot-structure`
