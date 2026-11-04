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

La respuesta es un Components V2 con el avatar del miembro de thumbnail. Al dar el rol es verde, con `## Role Granted` y *@miembro now has @rol*. Al quitarlo es rojo, con `## Role Removed` y *no longer has*. Debajo dice cuántos roles tiene en total, sin contar `@everyone`. El footer es `Granted by` / `Removed by` con mención y hora.

## `/role add all` / `/role remove all`

**Para qué:** Asignar o quitar un rol en masa. Omite quien ya está en el estado deseado.

Discord no tiene un cambio de rol en lote: es una llamada por miembro. El bot solo llama para quien necesita el cambio y mantiene **5** en paralelo; los límites de velocidad los gestiona discord.js.

Mientras trabaja, la respuesta es un Components V2 naranja de progreso que se refresca cada **2,5 s**. Primero dice que está *cargando la lista de miembros* (si no estaba en caché). Después muestra `## Giving Role in Bulk` / `Removing Role in Bulk` con `@rol → N members…`, la barra con el porcentaje y, en `-#`, `hechos de total`, actualizados, fallidos y tiempo transcurrido.

Al terminar, la misma respuesta pasa a un **resumen** sin lista de miembros: rol y a cuántos se aplicó. Debajo, en una línea, cuántos se cambiaron, cuántos ya estaban (*Already had it* / *Did not have it*) y cuántos fallaron. Si hubo fallos, añade un aviso con `alert` para subir el rol del bot. El footer es `Granted by` / `Removed by` con mención, duración y hora. Verde salvo que fallen todos (`Could Not Update Roles`, rojo). Si nadie necesita el cambio, responde un V2 de info y no toca a nadie. Si la operación pasa de **14 minutos** (el token de la interacción dura 15), deja de refrescar y publica el resumen en el canal.

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | ROLE | Sí |

Admin. El bot necesita **Manage Roles**. Audita solo si al menos un miembro cambió.

## `/role list`

**Para qué:** Conteo de humanos y bots que tienen el rol. Bajo el título `## Members of @rol` van **Total**, **Humans** y **Bots** en una línea. Si las menciones caben en el panel, se listan seguidas en dos bloques, **Humans** y **Bots**. Si no caben, adjunta un CSV (`ID`, `Kind`) con File V2. El footer es `Requested by` con mención y hora. Respuesta efímera. No lista `@everyone`.

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | ROLE | Sí |

No audita.
