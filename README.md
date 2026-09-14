# Apex-Horizon-Esports

Bot de Discord operador de torneos de esports.

La fuente de verdad del producto, reglas de negocio y catálogo de comandos está en [`context/`](context/README.md).

## Arranque local

1. Copia `.env.example` a `.env` y rellena token, client ID, gremios y la URI de Mongo (usuario `apex_bot`).
2. En el [Discord Developer Portal](https://discord.com/developers/applications), activa **Message Content Intent** (hace falta para `a?ping`).
3. Invita el bot solo a gremios que estén en `ALLOWED_GUILDS`.
4. Instala y levanta:

```bash
npm install
npm run dev
```

`/bot ping`, `/bot about` y `/bot help` (también `a?ping`, `a?about`, `a?help`) cubren latencia, identidad y el mapa de comandos.
