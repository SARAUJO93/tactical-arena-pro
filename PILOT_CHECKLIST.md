# Checklist de piloto controlado

## Antes del live

- [ ] Configurar TikFinity y comprobar el WebSocket.
- [ ] Activar modo Demo y recorrer mapas, gifts y acciones instantáneas.
- [ ] Iniciar `npm run pilot:collector` en un equipo confiable.
- [ ] Configurar `http://127.0.0.1:8080/events` en Ajustes.
- [ ] Activar observabilidad externa y confirmar estado `Enviado`.
- [ ] Probar reconexión de TikFinity una vez.
- [ ] Ejecutar el soak manual recomendado de 30 minutos.
- [ ] Confirmar que `pilot-output/quality-events.ndjson` contiene eventos agregados.

## Durante el live

- [ ] Mantener visibilidad de telemetría y estado WebSocket.
- [ ] Registrar duración real del piloto.
- [ ] Registrar rondas, desconexiones y errores.
- [ ] Revisar FPS, frame medio, frame máximo y heap.
- [ ] No mostrar nombres ni datos personales en capturas compartidas.

## Después del live

- [ ] Revisar el número de eventos recibidos.
- [ ] Comparar rondas locales y rondas enviadas.
- [ ] Exportar estado persistido.
- [ ] Exportar telemetría JSON y CSV.
- [ ] Archivar logs del collector sin combinar datos personales.
- [ ] Evaluar latencia, fallos y reintentos externos.
- [ ] Abrir issues para cualquier pérdida de ronda, reconexión o caída visual.

## Criterio de aprobación

El piloto se considera aprobado cuando:

- no existen errores de JS no controlados;
- no hay reinicios inesperados;
- TikFinity se reconecta sin perder controles;
- no hay degradación sostenida de FPS;
- los payloads contienen solo datos agregados;
- persisten ligas, rondas y estado al recargar.
