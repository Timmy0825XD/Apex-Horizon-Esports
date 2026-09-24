# Ciclo de un partido

Orden mental, no siempre lineal:

```text
Bracket marca el partido OPEN
        ↓
Se crea el TICKET (auto o manual)
  · permisos: organizers/helpers del torneo + ambos capitanes
  · embed de bienvenida, nombre tipo ronda_equipo_vs_equipo
        ↓
Se publica el SCHEDULE (hora UTC, mínimo +10 minutos)
  · embed en el ticket y en el canal de schedules del servidor
  · miniatura opcional en el canal de thumbnails
  · el canal se marca con 🔴
  · Judge/Recorder pueden ir vacíos o preasignarse
        ↓
Asignación de staff (comando, botones del schedule, o update)
  · al asignar, Judge/Recorder ganan acceso al ticket
        ↓
T-10: recordatorio en el ticket + botón Confirmed (si hay staff)
T-0: quien no confirmó sale del ticket; aviso urgente en el canal de schedules
        ↓
Se juega el partido
        ↓
ASISTENCIA (quién trabajó + marcador humano + link opcional)
        ↓
RESULTADO DE SCHEDULE (capturas al canal de resultados del torneo)
        ↓
UPLOAD SCORE (el bracket avanza de verdad)
  · ticket se cierra / renombra / mueve a categoría cerrada
  · transcript HTML al canal de transcripts
  · si auto-room está on, las siguientes salas OPEN esperan a 00:00 o 12:00 UTC
```

## Tres registros de “resultado”

La gente los confunde. El bot **no** los fusiona en un solo comando.

| Acto | Qué demuestra | Avanza el bracket |
|---|---|---|
| `/attendance mark` | Staff presente, marcador de trabajo, evidencia de grabación | No |
| `/schedule results` | Declaración pública con capturas en el canal de resultados | No |
| `/upload_score` | Informe oficial al cuadro | **Sí** |

Se puede marcar asistencia sin haber subido el score, y se puede subir el score sin haber declarado resultados de schedule. Operativamente se espera el orden de arriba.

## Cómo se encadenan los sistemas

```text
/settings + /staff config
        → habilitan logs, schedules, roles operativos, thumbnails

/sheet validate + /utility discord_tag
        → limpian la hoja

/tournament add
        → nace el mundo del torneo si ningún in-game ID está en la lista oficial de baneados; la sheet se copia a la BD

/tournament add_sheet
        → otra sheet entra al archivo global (link+name, o CSV nombre/link)

/tournament get_sheet
        → link de una hoja por nombre, o CSV de todo el archivo global

/tournament find_player
        → busca en todas las copias del bot (activas, manuales, histórico, cualquier servidor)

/tournament role + /team *
        → el servidor reconoce a los jugadores

/auto_room status:true  o  /room create
        → el partido se vuelve ticket

00:00 y 12:00 UTC, si auto-room sigue on
        → la cola de partidos que se abrieron después entra de golpe

/schedule *
        → el ticket tiene hora y staff

botones + worker T-10/T-0
        → el staff confirma o se reemplaza

/attendance * + /link *
        → el trabajo se contabiliza

/schedule results
        → el canal de resultados tiene pruebas

/upload_score
        → el bracket avanza. El siguiente ticket no nace al momento: espera 00:00 o 12:00 UTC si auto-room está on, o `/room create`

/correct_bracket
        → el cuadro se enmienda y las salas mentirosas se reconstruyen

/get sheet  /  /staff work  /  /work_done
        → se paga y se evalúa a partir de la asistencia, no del bracket
```

## Relacionado

- Overview: [overview.md](overview.md)
- Bracket y salas: [../domains/bracket-rooms.md](../domains/bracket-rooms.md)
- Schedules: [../domains/schedules.md](../domains/schedules.md)
- Asistencia: [../domains/attendance-payroll.md](../domains/attendance-payroll.md)
- Tickets: [../domains/tickets.md](../domains/tickets.md)
