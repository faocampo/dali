# Traspaso de Dalí

Corte de trabajo: **2026-10-07**. El usuario retoma el desarrollo manualmente. La automatización queda detenida; este cierre integra el trabajo existente y conserva sus checkpoints. **No hay aceptación de piloto ni de release interno.** La colaboración sigue siendo opt-in.

## Consolidación

Repositorio: [faocampo/dali](https://github.com/faocampo/dali). Código consolidado evaluado: `d7c12ab89a81d8ce288e4d6a3ba2f750613b1288`; las modificaciones posteriores de este cierre son documentación y referencias Git.

- `d83d990`: conserva los últimos arreglos existentes de feedback de permisos y foco de recuperación.
- `6918823`: incorpora el checkpoint de revisión `c072cb9` y su documentación histórica.
- `d7c12ab`: incorpora la ascendencia del checkpoint original `184b731`, conservando la implementación seleccionada en la [reconciliación documentada](.planning/phases/05-real-time-collaborative-editing/05-RECONCILIATION-2026-10-06.md). Sus variantes superpuestas no se mezclaron.

Antes del cierre había dos ramas remotas (`main`, `codex/internal-release-20261006`) y ningún PR. La continuación tenía cuatro ramas locales y el checkout original tres. Objetivo del cierre: una sola rama activa, `main`, y estos dos checkpoints recuperables como etiquetas:

| Etiqueta | Commit conservado |
|---|---|
| `archive/original-checkpoint-20261006` | `184b73178020c59a0e2dbdf51edec41fd2a23325` |
| `archive/internal-release-20261006` | `c072cb9f5113839445787ab3eab87392dee93007` |

Los bundles locales completos anteriores al cierre son una segunda copia de recuperación. Los checkouts de revisión y original conservarán sus archivos en el mismo commit, con HEAD separado de una rama. No se reinicia ninguna demo ni se cambia su almacenamiento. El resultado remoto definitivo se registra al finalizar la fusión.

## Pruebas del código consolidado

| Comprobación | Resultado |
|---|---|
| Cliente, suite completa | **291/291**, 26 archivos |
| Servidor, suite completa serializada | **402/402**, 20 archivos |
| TypeScript cliente y servidor | Ambos aprobados |
| Chromium: colaboración y Viewer restaurado | **117/117**, 23 minutos; cero fallos, omisiones o reintentos |
| Firefox: recuperación privada y latest/download | **17 aprobados / 1 fallido**, los 18 casos ejecutados |
| WebKit: recuperación privada y latest/download | **17 aprobados / 1 fallido**; último caso confirmado en ejecución focalizada posterior |
| Inspección visual de recuperación | Diálogos legibles a 320 y 1280 px; no equivale a zoom nativo |

La ejecución conjunta Firefox/WebKit se interrumpió después de 35 de 36 resultados. El único caso sin resultado (foco y reflow de WebKit) pasó después **1/1** en 43,9 segundos; no se repitieron los casos aprobados. Su primer intento de arranque encontró un puerto ocupado por fixtures huérfanos propios, que se identificaron y cerraron antes de ejecutarlo. No hubo skips ni reintentos automáticos.

El primer intento de servidor se interrumpió por desconexión del entorno; el resultado de 402/402 corresponde a una ejecución completa posterior. Se conservan los fallos y correcciones históricos en los informes de cada plan. El escaneo de 2.416 blobs históricos no encontró los patrones revisados de claves/tokens ni rutas privadas; no sustituye una auditoría de seguridad.

**Fallo observado en Firefox:** `tests/collaboration-fork.spec.ts:270`, caso de resolver una pestaña y conservar otra para revisión posterior. Tras aceptar la segunda versión y ver “Saved”, la comprobación inmediata esperaba un journal vacío y encontró dos registros. Las verificaciones previas de conservación y reapertura del segundo candidato pasaron. Se conserva la traza; la causa y si se trata de sincronización transitoria o estado persistente quedan sin determinar. El cierre no modifica el código para resolver este pendiente de 05-06.

**Fallo observado en WebKit:** `tests/collaboration-fork.spec.ts:204`, reintento de cargar la versión actual tras un fallo de red. Geometría e imágenes esperadas pasaron; la comprobación inmediata del journal vacío encontró registros pendientes. La causa queda sin determinar y la evidencia se conserva. Estos fallos pertenecen al código existente; la consolidación no modifica su comportamiento ni completa 05-06.

Estos resultados mantienen el flujo de recuperación sin aceptación. Los puntos comprobados no muestran pérdida de contenido; tampoco establecen la seguridad completa de reaperturas posteriores. La consolidación conserva este trabajo pendiente, sin ejecutar servicios ni migraciones ni reutilizar almacenamiento existente.

No se reejecutó toda la matriz histórica de producto, ni se validaron un proveedor real, almacenamiento independiente, despliegue compartido o aceptación humana. El resultado histórico de Phase 4 sigue siendo **2.051/2.052**, con la excepción aceptada; no se transforma en un resultado completamente aprobado.

Para repetir los gates relevantes, con dependencias y navegadores ya instalados:

```sh
npm test
npm run typecheck
npm run typecheck:server
npm run test:server -- --maxWorkers=1
DALI_TEST_PORT_OFFSET=2000 npm exec playwright test -- 'tests/collaboration.*spec.ts' tests/restored-viewer.spec.ts --project=prod
DALI_TEST_PORT_OFFSET=2000 npm exec playwright test -- tests/collaboration-fork.spec.ts --project=prod-firefox --project=prod-webkit
```

Usar un solo gate de navegador/build a la vez y puertos libres. Los fixtures son sintéticos y desechables.

## Estado funcional que se entrega

| Alcance del roadmap | Estado real |
|---|---|
| Phases 1–4 | Aceptadas con las excepciones históricas: canvas/imágenes, mind maps, acceso autenticado y persistencia/recuperación |
| 05-01 a 05-05 | Aceptación automatizada documentada: sincronización, reservas, presencia, historial personal y divergencia |
| 05-06 | Parcial: copia privada completa, imágenes, recibos tras recarga, descargar/cargar versión actual/cancelar, permisos y foco implementados; falta cerrar la matriz íntegra del plan |
| 05-07 a 05-09 | Pendientes: transiciones completas de permisos, mind maps colaborativos y aceptación con 20 editores simultáneos distintos/convergencia durable |
| Phases 6–13 | Pendientes: Follow Me, comentarios, timer, votación, plantillas, mockups, paletas técnicas y Gantt manual |

La carrera de cambios tipográficos consecutivos tiene reparación y pruebas deterministas; la disposición de [issue #1](https://github.com/faocampo/dali/issues/1) queda al mantenedor. Una acción rechazada por la reserva de otro editor no se reproduce automáticamente. La apertura de Viewer se evalúa con su prueba nativa actual, sin asumir vigente un defecto histórico.

En 05-06 siguen pendientes límites combinados de almacenamiento/permisos, generaciones y callbacks obsoletos, acciones repetidas y la matriz completa de aceptación. No se presentan como defectos confirmados ni se desarrollan durante este cierre. Permanecen las excepciones 999.3 (tecnología asistiva hablada), 999.4 (proveedor real), 999.6 (almacenamiento/capacidad) y 999.7 (WebKit histórico), además de Finder/clipboard del sistema y zoom de navegador sin verificación nativa completa.

## Continuación manual

El [roadmap](.planning/ROADMAP.md), [estado](.planning/STATE.md) y [runbook de release](docs/internal-release.md) conservan los requisitos aprobados. Este traspaso sustituye instrucciones anteriores de continuar automáticamente; no elimina pendientes ni amplía su aceptación.

**No reutilizar la base de datos del checkpoint original con esta implementación.** Ambas variantes tienen migración 11, pero una usa `document_property_changes` y la consolidada `document_action_properties`. No se realizó conversión. Mantener el almacenamiento anterior intacto y elegir un directorio nuevo y vacío para una prueba local de `main`.

Desde el checkout canónico de `main`:

```sh
git switch main
git pull --ff-only
npm ci
DALI_DEV_STATE_DIR="$HOME/.local/share/dali-main-fresh" npm run start:local
# Detener esa misma instancia:
DALI_DEV_STATE_DIR="$HOME/.local/share/dali-main-fresh" npm run stop:local
```

El [README](README.md) describe cuentas sintéticas, puertos y arranque. Si los puertos están ocupados, elegir otros con las opciones documentadas; no detener servicios ajenos. El cierre no ejecuta estos comandos de arranque ni configura credenciales o proveedores.
