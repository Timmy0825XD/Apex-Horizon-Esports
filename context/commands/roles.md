# Roles (Discord, no torneo)

`/role user` y `/role list`: Organiser (`manager_role` o Administrator). `admin_role` no entra. `/role add all` y `/role remove all`: Admin (`admin_role` o Administrator). `manager_role` no entra. No persisten nada propio. Respuestas en **Components V2**. Auditan excepto `list`.

Jerarquía Discord siempre gana: no se toca `@everyone`, un rol de integración, ni un rol igual o por encima del actor o del bot. En `/role user` tampoco se gestiona a alguien con rol igual o superior al propio. Ver [../domains/moderation.md](../domains/moderation.md), [../product/actors.md](../product/actors.md).

## `/role user`

**Para qué:** Toggle de un rol en un miembro. Si lo tiene, se lo quita; si no, se lo pone.

| Campo | Tipo | Obligatorio |
|---|---|---|
| target | USER | Sí |
| role | ROLE | Sí |

El objetivo tiene que estar en el servidor. El bot necesita **Manage Roles**. Audita.

## `/role add all` / `/role remove all`

**Para qué:** Asignar o quitar un rol en masa. Omite quien ya está en el estado deseado.

Discord no tiene un cambio de rol en lote: es una llamada por miembro. El bot solo llama para quien necesita el cambio y mantiene **5** en paralelo; los límites de velocidad los gestiona discord.js.

Mientras trabaja, la respuesta es un Components V2 de progreso que se refresca cada **2,5 s**: primero *cargando la lista de miembros* (si no estaba en caché), después barra, porcentaje, `hechos de total`, actualizados, fallidos y tiempo transcurrido.

Al terminar, la misma respuesta pasa a un **resumen** sin lista de miembros: rol, cuántos se cambiaron, cuántos ya estaban (*Already had it* / *Did not have it*), cuántos fallaron (con aviso de revisar la posición del rol del bot) y cuánto tardó, con footer `Triggered by`. Verde salvo que fallen todos. Si nadie necesita el cambio, responde un V2 de info y no toca a nadie. Si la operación pasa de **14 minutos** (el token de la interacción dura 15), deja de refrescar y publica el resumen en el canal.

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | ROLE | Sí |

Admin. El bot necesita **Manage Roles**. Audita solo si al menos un miembro cambió.

## `/role list`

**Para qué:** Conteo de humanos y bots que tienen el rol. Si las menciones caben en el panel, se listan; si no, adjunta un CSV (`ID`, `Kind`) con File V2. Respuesta efímera. No lista `@everyone`.

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | ROLE | Sí |

No audita.
