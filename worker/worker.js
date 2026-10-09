/**
 * API del Tablero de Resultados Estratégicos de Visión Circular.
 * Cloudflare Worker + base D1. La página (GitHub Pages) lee y escribe aquí.
 *
 * Acceso:
 *   - Leer (tablero, línea base, bitácora): abierto para todo el equipo, sin código.
 *   - Reportar: un código por área. Cada código solo puede reportar los datos de su área.
 *   - Validar, observar y fijar metas: código de validación (Sistemas de Información),
 *     que además puede reportar en nombre de cualquier área.
 * Los códigos no están en el repositorio: el secreto CODIGOS guarda un JSON
 * { "<sha256 del código en mayúsculas>": "IMP" | "LB" | ... | "VALIDADOR" }.
 *
 * Preformulación de proyectos (taller de formulación): cada área guarda un proyecto con su
 * código. Quién va en qué estado es abierto; el contenido solo se ve con un código válido.
 *
 * Ningún reporte se sobrescribe: una corrección es un reporte nuevo con `corrige`.
 * Toda escritura queda en la tabla `bitacora`.
 *
 * Las listas de abajo se generan desde assets/catalogo.js: si cambia el catálogo,
 * regenerarlas (ver README).
 */

const ORIGENES = ["https://amdavil.github.io", "http://localhost:7810", "http://127.0.0.1:7810"];
const AREAS = ["IMP", "LB", "INN", "ISP", "TER", "CON", "COM", "FIN"];
const VAR_AREAS = {"V01":["IMP"],"V02":["LB"],"V03":["IMP","INN","ISP","TER"],"V04":["LB"],"V05":["LB"],"V06":["IMP"],"V07":["IMP"],"V08":["IMP"],"V09":["ISP","TER"],"V10":["INN","ISP","TER"],"V11":["INN"],"V12":["INN"],"V13":["INN","TER","FIN"],"V14":["INN","TER","FIN"],"V15":["INN"],"V16":["ISP","TER"],"V17":["ISP","TER"],"V18":["ISP","TER","INN"],"V19":["ISP","TER"],"V31":["ISP","TER"],"V20":["ISP","TER"],"V21":["ISP","TER"],"V22":["ISP"],"V32":["ISP"],"V23":["IMP","CON","TER"],"V24":["COM"],"V25":["CON"],"V26":["FIN"],"V27":["FIN"],"V28":["FIN"],"V29":["FIN"],"V30":["INN"]};
const CAT_POR_AREA = {"V10":{"INN":["Prototipo de producto","Piloto de proceso"],"ISP":["Solución tecnológica adoptada"],"TER":["Solución tecnológica adoptada"]},"V23":{"IMP":["Eventos masivos y campañas","Actores de la cadena"],"CON":["Colegios (Evolución circular)"],"TER":["Proyectos sectoriales"]}};
const LINEAS_POR_AREA = {"IMP":["Fortalecimiento de cadenas de valor","Consumo responsable (jornadas y eventos)"],"LB":["Innovación para el cierre de ciclo"],"INN":["Innovación para el cierre de ciclo"],"ISP":["Inclusión social y productiva"],"TER":["Proyectos territoriales y sectoriales"],"CON":["Consumo responsable"],"COM":["Comunicaciones y relacionamiento"],"FIN":["Competitividad financiera"]};

const META_OK = /^(K(0[1-9]|1[0-9]|20))-(20[2-3][0-9])$/;
const FECHA_OK = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORTES = 20000;
const MAX_PREF = 5000;
const txt = (v, n = 600) => (v == null ? null : String(v).trim().slice(0, n) || null);

/* Deja solo los campos esperados de una ficha de preformulación, con largo y cantidad acotados.
   Orden de la ficha: quién la diligencia, análisis del problema, posibles soluciones, definición y alcance,
   propósito, objetivo general, objetivos específicos con actividades y conexiones. */
function limpiarPref(d) {
  d = d && typeof d === "object" ? d : {};
  return {
    responsable: txt(d.responsable, 100), area: txt(d.area, 100),
    problema: txt(d.problema, 1500), afectados: txt(d.afectados, 800), causas: txt(d.causas, 1000), consecuencias: txt(d.consecuencias, 800),
    alternativas: (Array.isArray(d.alternativas) ? d.alternativas.slice(0, 5) : []).map((x) => txt(x, 300)).filter(Boolean),
    elegida: txt(d.elegida, 300), elegidaN: txt(d.elegidaN, 12), porque: txt(d.porque, 800),
    nombre: txt(d.nombre, 150), tipo: txt(d.tipo, 40), incluye: txt(d.incluye, 800), noIncluye: txt(d.noIncluye, 800),
    proposito: txt(d.proposito, 800), objetivoGeneral: txt(d.objetivoGeneral, 500), conexiones: txt(d.conexiones, 700),
    objetivos: (Array.isArray(d.objetivos) ? d.objetivos.slice(0, 6) : []).map((o) => ({
      texto: txt(o && o.texto, 400),
      actividades: (o && Array.isArray(o.actividades) ? o.actividades.slice(0, 6) : []).map((x) => txt(x, 250)).filter(Boolean),
    })).filter((o) => o.texto || o.actividades.length),
  };
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function rolDe(codigo, env) {
  if (!codigo) return null;
  let mapa = {};
  try { mapa = JSON.parse(env.CODIGOS || "{}"); } catch { return null; }
  return mapa[await sha256(codigo.trim().toUpperCase())] || null;
}
async function bitacora(env, accion, detalle, por, rol) {
  await env.DB.prepare("INSERT INTO bitacora (ts, accion, detalle, por) VALUES (?, ?, ?, ?)")
    .bind(new Date().toISOString(), accion, JSON.stringify({ ...detalle, rol }).slice(0, 4000), txt(por, 120)).run();
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Codigo",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const json = (o, status = 200) => new Response(JSON.stringify(o), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/" || url.pathname === "/api/salud") return json({ ok: true, servicio: "tablero-vision-circular" });

    try {
      /* ---------- lectura abierta ---------- */
      if (req.method === "GET" && url.pathname === "/api/estado") {
        const [r, v, m] = await Promise.all([
          env.DB.prepare("SELECT * FROM reportes ORDER BY ts").all(),
          env.DB.prepare("SELECT * FROM validaciones").all(),
          env.DB.prepare("SELECT * FROM metas").all(),
        ]);
        const validaciones = {}; v.results.forEach((x) => (validaciones[x.id] = x));
        const metas = {}; m.results.forEach((x) => (metas[x.id] = x));
        return json({ reportes: r.results.map((x) => ({ ...x, incluido: !!x.incluido })), validaciones, metas, ahora: new Date().toISOString() });
      }

      /* ---------- preformulaciones: libre acceso ---------- */
      if (url.pathname === "/api/preformulaciones" && req.method === "GET") {
        const r = await env.DB.prepare("SELECT id, datos, ts FROM preformulaciones ORDER BY ts DESC LIMIT 500").all();
        return json({ fichas: r.results.map((x) => ({ id: x.id, ts: x.ts, ...JSON.parse(x.datos) })), ahora: new Date().toISOString() });
      }
      if (url.pathname === "/api/preformulaciones" && req.method === "POST") {
        let b;
        try { b = await req.json(); } catch { return json({ error: "json", mensaje: "El cuerpo no es JSON." }, 400); }
        if (txt(b.web)) return json({ ok: true, id: "x", ts: new Date().toISOString() }); // campo trampa para robots
        const o = limpiarPref(b);
        const falta = [];
        if (!o.responsable) falta.push("quién diligencia");
        if (!o.area) falta.push("la línea o área");
        if (!o.problema) falta.push("qué está pasando");
        if (!o.causas) falta.push("por qué está pasando");
        if (o.alternativas.length < 2) falta.push("al menos dos posibles soluciones");
        if (!o.elegida) falta.push("cuál solución se va a trabajar");
        if (!o.nombre) falta.push("el nombre del proyecto");
        if (!o.incluye) falta.push("qué incluye el proyecto");
        if (!o.proposito) falta.push("el propósito superior");
        if (!o.objetivoGeneral) falta.push("el objetivo general");
        if (o.objetivos.filter((x) => x.texto && x.actividades.length).length < 3) falta.push("tres objetivos específicos con al menos una actividad");
        if (falta.length) return json({ error: "datos", mensaje: "Falta " + falta.join(", ") + "." }, 400);
        const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM preformulaciones").first();
        if (n && n.n >= MAX_PREF) return json({ error: "cupo", mensaje: "La base llegó a su límite de fichas." }, 507);
        const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const ts = new Date().toISOString();
        await env.DB.prepare("INSERT INTO preformulaciones (id, area, estado, datos, por, ts) VALUES (?, ?, 'enviada', ?, ?, ?)")
          .bind(id, o.area, JSON.stringify(o), o.responsable, ts).run();
        await bitacora(env, "preformulacion", { id, area: o.area, nombre: o.nombre }, o.responsable, "libre");
        return json({ ok: true, id, ts });
      }

      /* ---------- todo lo demás exige código ---------- */
      const rol = await rolDe(req.headers.get("X-Codigo") || "", env);
      if (!rol) return json({ error: "codigo", mensaje: "Código de acceso no válido." }, 401);
      if (req.method === "GET" && url.pathname === "/api/quien") return json({ rol });
      if (req.method !== "POST") return json({ error: "metodo" }, 405);
      let b;
      try { b = await req.json(); } catch { return json({ error: "json", mensaje: "El cuerpo no es JSON." }, 400); }

      /* ---------- nuevo reporte ---------- */
      if (url.pathname === "/api/reportes") {
        if (!AREAS.includes(b.quien)) return json({ error: "datos", mensaje: "Área no válida." }, 400);
        if (rol !== "VALIDADOR" && rol !== b.quien)
          return json({ error: "rol", mensaje: "Tu código solo permite reportar los datos de tu área." }, 403);
        const permitidas = VAR_AREAS[b.v];
        if (!permitidas) return json({ error: "datos", mensaje: "Dato no válido." }, 400);
        if (!permitidas.includes(b.quien)) return json({ error: "rol", mensaje: "Este dato no le corresponde a tu área." }, 403);
        const linea = txt(b.linea, 80);
        if (linea && !(LINEAS_POR_AREA[b.quien] || []).includes(linea))
          return json({ error: "datos", mensaje: "Tu área no puede atribuir cifras a esa línea." }, 400);
        const cat = txt(b.cat, 80);
        if (cat && CAT_POR_AREA[b.v] && !(CAT_POR_AREA[b.v][b.quien] || []).includes(cat))
          return json({ error: "datos", mensaje: "Tu área no reporta esa categoría." }, 400);
        const errs = [];
        const anio = Number(b.anio);
        if (!Number.isInteger(anio) || anio < 2015 || anio > 2035) errs.push("año");
        if (!FECHA_OK.test(b.corte || "")) errs.push("fecha de corte");
        const valor = Number(b.valor);
        if (!Number.isFinite(valor)) errs.push("valor");
        if (!txt(b.fuente)) errs.push("fuente");
        if (errs.length) return json({ error: "datos", mensaje: "Revisa: " + errs.join(", ") + "." }, 400);
        const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM reportes").first();
        if (n && n.n >= MAX_REPORTES) return json({ error: "cupo", mensaje: "La base llegó a su límite de reportes." }, 507);
        const id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const ts = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO reportes (id, v, anio, corte, valor, material, linea, programa, territorio, nivel, cat, metodo, incluido, quien, fuente, evidencia, nota, por, ts, corrige)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, b.v, anio, b.corte, valor,
          txt(b.material, 80), linea, txt(b.programa, 80), txt(b.territorio, 80), txt(b.nivel, 60), cat, txt(b.metodo, 200),
          b.incluido ? 1 : 0, b.quien, txt(b.fuente), txt(b.evidencia), txt(b.nota, 1200), txt(b.por, 120) || "Sin nombre", ts, txt(b.corrige, 40)
        ).run();
        await bitacora(env, "reporte", { id, v: b.v, anio, valor, quien: b.quien }, b.por, rol);
        return json({ ok: true, id, ts });
      }

      /* ---------- validar y metas: solo validación ---------- */
      if (rol !== "VALIDADOR") return json({ error: "rol", mensaje: "Solo el código de validación puede hacer esto." }, 403);

      if (url.pathname === "/api/validaciones") {
        if (!["validado", "observado"].includes(b.estado)) return json({ error: "datos", mensaje: "Estado no válido." }, 400);
        if (b.estado === "observado" && !txt(b.comentario)) return json({ error: "datos", mensaje: "Para observar escribe qué hay que corregir." }, 400);
        const existe = await env.DB.prepare("SELECT id FROM reportes WHERE id = ?").bind(txt(b.id, 40)).first();
        if (!existe) return json({ error: "datos", mensaje: "El reporte no existe." }, 404);
        const ts = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO validaciones (id, estado, comentario, por, ts) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, comentario = excluded.comentario, por = excluded.por, ts = excluded.ts`
        ).bind(existe.id, b.estado, txt(b.comentario, 1200), txt(b.por, 120) || "Sin nombre", ts).run();
        await bitacora(env, "validacion", { id: existe.id, estado: b.estado, comentario: txt(b.comentario, 300) }, b.por, rol);
        return json({ ok: true, ts });
      }

      if (url.pathname === "/api/metas") {
        const mm = META_OK.exec(b.id || "");
        if (!mm) return json({ error: "datos", mensaje: "Meta no válida." }, 400);
        const ts = new Date().toISOString();
        if (b.valor === null || b.valor === "") {
          await env.DB.prepare("DELETE FROM metas WHERE id = ?").bind(b.id).run();
        } else {
          const valor = Number(b.valor);
          if (!Number.isFinite(valor)) return json({ error: "datos", mensaje: "La meta debe ser un número." }, 400);
          await env.DB.prepare(
            `INSERT INTO metas (id, k, anio, valor, por, ts) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET valor = excluded.valor, por = excluded.por, ts = excluded.ts`
          ).bind(b.id, mm[1], Number(mm[3]), valor, txt(b.por, 120) || "Sin nombre", ts).run();
        }
        await bitacora(env, "meta", { id: b.id, valor: b.valor }, b.por, rol);
        return json({ ok: true, ts });
      }

      return json({ error: "no_encontrado" }, 404);
    } catch (e) {
      return json({ error: "servidor", mensaje: "Error interno. Intenta de nuevo." }, 500);
    }
  },
};
