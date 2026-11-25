# Política de persistencia

El esquema persistido usa `PERSISTENCE_SCHEMA_VERSION`.

## Compatibilidad

- La carga acepta esquemas iguales o menores al esquema actual.
- Los esquemas superiores se consideran incompatibles.
- Los datos inválidos conservan una copia `_corrupt_*`.
- Las importaciones crean una copia `_backup_*`.
- Las restauraciones crean una copia `_before_restore_*`.

## Cambios permitidos

- Agregar campos opcionales con valores por defecto.
- Aceptar campos antiguos sin borrarlos.
- Aplicar migraciones numéricas acotadas.
- Mantener el estado vigente al fallar una migración.

## Cambios prohibidos sin migración

- Eliminar claves existentes.
- Cambiar tipos de campos históricos.
- Reducir rangos sin preservar compatibilidad.
- Sobrescribir MVP, rondas, temporadas o equipoRecords sin respaldo.

Cada cambio de esquema debe incluir una prueba de carga y una prueba de exportación/importación.
