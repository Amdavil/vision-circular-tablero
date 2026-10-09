# Tablero de Resultados Estratégicos · Visión Circular

Prototipo de trabajo de la consultoría Soluciones PAL para Visión Circular ANDI (contrato CO3113).

**Sitio:** https://amdavil.github.io/vision-circular-tablero/

## Qué hace

1. **Cada área reporta sus datos** (no indicadores): Implementación, Línea Base, Innovación y PMO, Inclusión, Territoriales, Consumo responsable, Comunicaciones y Financiera.
2. **La herramienta calcula los indicadores** con la fórmula publicada en cada ficha.
3. **Sistemas de Información valida u observa** cada dato. Nada se sobrescribe: una corrección es un reporte nuevo que reemplaza al anterior.
4. **El tablero se actualiza**: 12 indicadores titulares agrupados por tema, 7 complementarios, 3 de contexto y la salud del dato por área.

La priorización parte del cruce de la Matriz de Disponibilidad (17 ago 2026) con la planeación presentada a la Junta Directiva (12 feb 2026). Ver la pestaña "Cómo se priorizó".

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | Página (estilos y estructura) |
| `preformulacion.html` | Tarea del taller de formulación: cada área preformula un proyecto (problema, propósito, objetivos, actividades) |
| `assets/catalogo.js` | Indicadores, datos de entrada, cotejo y destino de los trazadores |
| `assets/app.js` | Cálculo, reporte, validación y tablero |
| `assets/config.js` | URL de la API |
| `worker/` | API en Cloudflare Workers con base D1 (`vc-tablero`) |

## Acceso

- **Ver** el tablero, el panorama de línea base, la cola de validación y la bitácora: abierto para todo el equipo, sin código.
- **Reportar:** un código por área (Implementación, Línea Base, Innovación y PMO, Inclusión, Territoriales, Consumo responsable, Comunicaciones, Administrativa y financiera). Cada código solo puede enviar los datos de su área; el servidor lo verifica.
- **Validar, observar y fijar metas:** código de validación de Sistemas de Información, que además puede reportar en nombre de cualquier área.

Los códigos **no están en este repositorio**. El Worker guarda el secreto `CODIGOS`: un JSON `{"<sha256 del código en MAYÚSCULAS>": "IMP" | ... | "VALIDADOR"}`.

## Preformulación de proyectos

https://amdavil.github.io/vision-circular-tablero/preformulacion.html — ficha de preformulación del taller ejecutivo (oct 2026), con el diseño del `index.html` de la carpeta de la consultoría. Acceso libre, sin código; una ficha por problema u oportunidad. Orden: quién diligencia, análisis del problema, posibles soluciones, definición y alcance, propósito, objetivo general, objetivos con actividades y conexiones.

Cada ficha va a dos destinos: la tabla `preformulaciones` (alimenta la pestaña "Banco de fichas", con búsqueda y descarga a Word) y el receptor `receptor/Code.gs`, desplegado como aplicación web con la cuenta de Daniel (constante `RECEPTOR` de la página). El receptor guarda un documento por ficha en la carpeta "Preformulaciones · Visión Circular" de su Drive, agrega una fila a la hoja de respuestas y manda un correo a Daniel con copia a Pahola. Si se cambia el receptor, usar Implementar > Administrar implementaciones > Nueva versión para conservar la URL.

## Auditoría

La pestaña "Cómo se priorizó" incluye la auditoría del 5 oct 2026: cada dato de entrada contrastado con la matriz (responsable, frecuencia, unidad, fuente), con hallazgos y correcciones.

## Operación

```bash
cd worker
npx wrangler deploy                                   # publicar cambios de la API
npx wrangler d1 migrations apply vc-tablero --remote  # aplicar migraciones
npx wrangler secret put CODIGOS                       # cambiar códigos (pegar el JSON de hashes)
```

Si cambia qué área reporta cada dato en `assets/catalogo.js`, hay que regenerar `VAR_AREAS`, `CAT_POR_AREA` y `LINEAS_POR_AREA` en `worker/worker.js` y volver a desplegar.

La versión definitiva debe migrar al ecosistema Microsoft 365 / Power BI de ANDI, según los términos de referencia de la plataforma unificada.
