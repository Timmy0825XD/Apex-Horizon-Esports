# Apex-Horizon-Esports

Bot de Discord operador de torneos de esports.

La fuente de verdad del producto, reglas de negocio y catálogo de comandos está en [`context/`](context/README.md).

## Arranque local

1. Copia `.env.example` a `.env` y rellena token, client ID, gremios, la URI de Mongo (usuario `apex_bot`) y `ENCRYPTION_KEY` (64 caracteres hex, 32 bytes). Ejemplo: `openssl rand -hex 32`.
2. En el [Discord Developer Portal](https://discord.com/developers/applications), activa **Server Members Intent** (hace falta para `/server info`).
3. Invita el bot solo a gremios que estén en `ALLOWED_GUILDS`.
4. Instala y levanta:

```bash
npm install
npm run dev
```

`/bot ping`, `/bot about` y `/bot help` cubren latencia, identidad y el mapa de comandos.
