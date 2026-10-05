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
| `assets/catalogo.js` | Indicadores, datos de entrada, cotejo y destino de los trazadores |
| `assets/app.js` | Cálculo, reporte, validación y tablero |
| `assets/config.js` | URL de la API |
| `worker/` | API en Cloudflare Workers con base D1 (`vc-tablero`) |

## Acceso

Los datos requieren código de acceso:

- **Código de equipo:** ver el tablero y reportar.
- **Código de validación:** además validar, observar y fijar metas.

Los códigos **no están en este repositorio**. El Worker solo guarda sus hashes SHA-256 como secretos (`HASH_EQUIPO`, `HASH_VALIDADOR`).

## Operación

```bash
cd worker
npx wrangler deploy                                   # publicar cambios de la API
npx wrangler d1 migrations apply vc-tablero --remote  # aplicar migraciones
npx wrangler secret put HASH_EQUIPO                   # cambiar un código (pegar el SHA-256 del código en MAYÚSCULAS)
```

La versión definitiva debe migrar al ecosistema Microsoft 365 / Power BI de ANDI, según los términos de referencia de la plataforma unificada.
