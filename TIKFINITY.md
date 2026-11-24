# Configuración de TikFinity

## Requisitos

- TikFinity configurado para una transmisión activa.
- El servidor WebSocket habilitado en `localhost`.
- Puerto WebSocket disponible desde el navegador.

## Conexión

1. Abre Tactical Arena.
2. Presiona el botón de ajustes.
3. Introduce la URL WebSocket de TikFinity, normalmente `ws://localhost:21213/`.
4. Pulsa Conectar.

El indicador superior cambia a `TikFinity ON` al establecer la conexión.

## Eventos admitidos

El cliente admite:

- `chat`: alineación de usuarios a equipos.
- `like`: taps; acepta `likeCount`.
- `follow`: sigue a un usuario.
- `share`: comparte la transmisión.
- `gift`: regalos y repeticiones.
- Objetos directos con `team`, `tier`, `count`, `user`, `gift`, `avatar` y `coins`.

## Formato directo de regalo

```json
{
  "team": "A",
  "tier": 5,
  "count": 1,
  "user": "@viewer",
  "gift": "Escudo",
  "avatar": "https://example.com/avatar.png",
  "coins": 100
}
```

El puerto, equipo y nivel deben validarse en TikFinity antes de enviarlos.
Los paquetes JSON malformados, números fuera de rango y usuarios vacíos se descartan o normalizan.

## Reconexión

El cliente usa backoff con intervalos crecientes hasta 15 segundos.
La desconexión manual evita reintentos adicionales.
