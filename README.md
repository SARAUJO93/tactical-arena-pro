# Tactical Arena Pro

Arena interactiva para transmisiones de TikTok Live basada en TypeScript y Vite.

## Requisitos

- Node.js 20.19 o superior
- npm
- Navegador moderno
- Para integración en vivo: TikFinity y un WebSocket local

## Instalación

```powershell
npm ci
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

## Validación

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
```

Para una prueba de estabilidad larga:

```powershell
$env:SOAK_DURATION_SECONDS="1800"
npm run test:soak
```

## Uso en transmisión

1. Ejecuta `npm run dev` o sirve `dist/index.html`.
2. Abre el panel de ajustes y configura TikFinity.
3. Usa el modo Demo para validar escenas antes de recibir interacción real.
4. Conserva el modo seguro de zonas TikTok activado mientras pruebas overlays.

Consulta [TIKFINITY.md](TIKFINITY.md) para la conexión WebSocket y el formato de eventos.

## Persistencia

La aplicación guarda su liga, jugadores, rondas y configuración en `localStorage`.
El esquema actual usa `PERSISTENCE_SCHEMA_VERSION` y incluye `schemaVersion` en el estado persistido.
Los datos de esquemas incompatibles se rechazan y se conserva la aplicación funcional.
Desde Ajustes puedes exportar una copia completa del estado o importar un archivo JSON previamente exportado.
Los estados corruptos se conservan bajo una clave `_corrupt_*` para diagnóstico.

## Operación

- La telemetría muestra duración, monedas, interacción, rondas y errores.
- Los errores de JavaScript y promesas no controladas quedan registrados localmente.
- Los fallos de persistencia y desconexiones WebSocket quedan visibles en la telemetría.
- El build usa `vite-plugin-singlefile`, por lo que `dist/index.html` contiene la aplicación portable.

## Releases

Las etiquetas `v*` generan un artefacto HTML portable y un archivo `SHA256SUMS.txt`.
La publicación requiere aprobación del environment `production` configurado en GitHub Actions.
Cada release incluye además un paquete `.tar.gz`, documentación, notas y `manifest.json`.

## Observabilidad externa

La observabilidad externa está desactivada por defecto. Desde Ajustes puede introducir
una URL HTTPS o una URL HTTP local y aceptar el envío opt-in.
Los payloads contienen versión, identificador aleatorio de sesión, métricas agregadas
y categorías de error. No incluyen nombres de usuarios, chat, regalos, URLs de avatares
ni mensajes completos.

## Cobertura P1

- CI ejecuta auditoría de dependencias de producción.
- El workflow `Soak — Tactical Arena` permite una ejecución manual de hasta 30 minutos.
- La telemetría muestra FPS, frame medio, frame máximo y heap usado cuando el navegador lo expone.
- El estado externo distingue apagado, esperando, enviado y fallido.
