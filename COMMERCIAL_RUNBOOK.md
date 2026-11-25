# Runbook comercial

## Pre-live

1. Verificar `main` sincronizada y el tag candidato publicado.
2. Ejecutar `npm run prelive`.
3. Configurar TikFinity y probar reconexión.
4. Exportar el estado persistido actual.
5. Mantener una copia del paquete HTML anterior disponible para rollback.
6. Activar modo Demo y ejecutar gift, tap, share, follow, EMP y nuclear.
7. Confirmar telemetría, FPS y estado WebSocket.

## Inicio

1. Abrir el HTML de la versión etiquetada.
2. Confirmar que la versión visible coincide con el tag.
3. Desactivar modo Demo.
4. Confirmar `TikFinity ON`.
5. Ejecutar una ronda corta antes de mostrar el overlay al público.

## Incidentes

### TikFinity desconectado

1. Pulsar Detener si el estado no se estabiliza.
2. Verificar TikFinity y el puerto `21213`.
3. Reconectar y confirmar al menos una interacción real.

### Datos persistidos inválidos

1. Exportar el estado actual desde Ajustes.
2. Usar Restaurar respaldo o Recuperar dato corrupto.
3. Recargar y comprobar liga, temporada y configuración.

### Rendimiento degradado

1. Registrar FPS, frame máximo y heap.
2. Activar modo Demo para aislar carga externa.
3. Reiniciar ronda solo si no afecta ligas abiertas.
4. Recargar el build anterior si el problema persiste.

## Rollback

1. Detener el live y desconectar TikFinity.
2. Exportar el estado actual.
3. Cerrar la pestaña nueva.
4. Abrir el HTML anterior confirmado.
5. Importar el estado exportado solo si es compatible.
6. Ejecutar una ronda de comprobación.
7. Registrar el incidente y el tag usado.

No publicar una migración que elimine ligas, temporadas o configuraciones sin una copia exportada.
