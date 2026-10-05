/**
 * API del Tablero de Resultados Estratégicos de Visión Circular.
 * Cloudflare Worker + base D1. La página (GitHub Pages) lee y escribe aquí.
 *
 * Acceso por código (cabecera X-Codigo):
 *   - código de equipo     → ver el tablero y enviar reportes
 *   - código de validación → además validar, observar y fijar metas
 * Los códigos no están en el repositorio: solo sus hashes SHA-256, como secretos
 * del Worker (HASH_EQUIPO, HASH_VALIDADOR).
 *
 * Ningún reporte se sobrescribe: una corrección es un reporte nuevo con `corrige`.
 * Toda escritura queda en la tabla `bitacora`.
 */

const ORIGENES = [
  "https://amdavil.github.io",
  "http://localhost:7810",
  "http://127.0.0.1:7810",
];
const AREAS = ["IMP", "LB", "INN", "ISP", "TER", "CON", "COM", "FIN"];
const VAR_OK = /^V(0[1-9]|1[0-9]|2[0-9])$/;
const META_OK = /^(K(0[1-9]|1[0-9]))-(20[2-3][0-9])$/;
const FECHA_OK = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORTES = 20000;

const txt = (v, n = 600) => (v == null ? null : String(v).trim().slice(0, n) || null);

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function rolDe(codigo, env) {
  if (!codigo) return null;
  const h = await sha256(codigo.trim().toUpperCase());
  if (env.HASH_VALIDADOR && h === env.HASH_VALIDADOR) return "validador";
  if (env.HASH_EQUIPO && h === env.HASH_EQUIPO) return "equipo";
  return null;
}

async function bitacora(env, accion, detalle, por) {
  await env.DB.prepare("INSERT INTO bitacora (ts, accion, detalle, por) VALUES (?, ?, ?, ?)")
    .bind(new Date().toISOString(), accion, JSON.stringify(detalle).slice(0, 4000), txt(por, 120))
    .run();
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
    const json = (o, status = 200) =>
      new Response(JSON.stringify(o), {
        status,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/" || url.pathname === "/api/salud") return json({ ok: true, servicio: "tablero-vision-circular" });

    const rol = await rolDe(req.headers.get("X-Codigo") || "", env);
    if (!rol) return json({ error: "codigo", mensaje: "Código de acceso no válido." }, 401);

    try {
      /* ---------- leer todo ---------- */
      if (req.method === "GET" && url.pathname === "/api/estado") {
        const [r, v, m] = await Promise.all([
          env.DB.prepare("SELECT * FROM reportes ORDER BY ts").all(),
          env.DB.prepare("SELECT * FROM validaciones").all(),
          env.DB.prepare("SELECT * FROM metas").all(),
        ]);
        const reportes = r.results.map((x) => ({ ...x, incluido: !!x.incluido }));
        const validaciones = {};
        v.results.forEach((x) => (validaciones[x.id] = x));
        const metas = {};
        m.results.forEach((x) => (metas[x.id] = x));
        return json({ rol, reportes, validaciones, metas, ahora: new Date().toISOString() });
      }

      if (req.method !== "POST") return json({ error: "metodo" }, 405);
      let b;
      try { b = await req.json(); } catch { return json({ error: "json", mensaje: "El cuerpo no es JSON." }, 400); }

      /* ---------- nuevo reporte ---------- */
      if (url.pathname === "/api/reportes") {
        const errs = [];
        if (!VAR_OK.test(b.v || "")) errs.push("dato");
        const anio = Number(b.anio);
        if (!Number.isInteger(anio) || anio < 2015 || anio > 2035) errs.push("año");
        if (!FECHA_OK.test(b.corte || "")) errs.push("fecha de corte");
        const valor = Number(b.valor);
        if (!Number.isFinite(valor)) errs.push("valor");
        if (!AREAS.includes(b.quien)) errs.push("área");
        if (!txt(b.fuente)) errs.push("fuente");
        if (errs.length) return json({ error: "datos", mensaje: "Revisa: " + errs.join(", ") + "." }, 400);
        const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM reportes").first();
        if (n && n.n >= MAX_REPORTES) return json({ error: "cupo", mensaje: "La base llegó a su límite de reportes." }, 507);
        const id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const ts = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO reportes (id, v, anio, corte, valor, material, linea, territorio, nivel, cat, metodo, incluido, quien, fuente, evidencia, nota, por, ts, corrige)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, b.v, anio, b.corte, valor,
          txt(b.material, 80), txt(b.linea, 80), txt(b.territorio, 80), txt(b.nivel, 60), txt(b.cat, 80), txt(b.metodo, 200),
          b.incluido ? 1 : 0, b.quien, txt(b.fuente), txt(b.evidencia), txt(b.nota, 1200), txt(b.por, 120) || "Sin nombre", ts, txt(b.corrige, 40)
        ).run();
        await bitacora(env, "reporte", { id, v: b.v, anio, valor, quien: b.quien }, b.por);
        return json({ ok: true, id, ts });
      }

      /* ---------- validar u observar (solo validador) ---------- */
      if (url.pathname === "/api/validaciones") {
        if (rol !== "validador") return json({ error: "rol", mensaje: "Solo el código de validación puede validar." }, 403);
        if (!["validado", "observado"].includes(b.estado)) return json({ error: "datos", mensaje: "Estado no válido." }, 400);
        if (b.estado === "observado" && !txt(b.comentario)) return json({ error: "datos", mensaje: "Para observar escribe qué hay que corregir." }, 400);
        const existe = await env.DB.prepare("SELECT id FROM reportes WHERE id = ?").bind(txt(b.id, 40)).first();
        if (!existe) return json({ error: "datos", mensaje: "El reporte no existe." }, 404);
        const ts = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO validaciones (id, estado, comentario, por, ts) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, comentario = excluded.comentario, por = excluded.por, ts = excluded.ts`
        ).bind(existe.id, b.estado, txt(b.comentario, 1200), txt(b.por, 120) || "Sin nombre", ts).run();
        await bitacora(env, "validacion", { id: existe.id, estado: b.estado, comentario: txt(b.comentario, 300) }, b.por);
        return json({ ok: true, ts });
      }

      /* ---------- metas (solo validador) ---------- */
      if (url.pathname === "/api/metas") {
        if (rol !== "validador") return json({ error: "rol", mensaje: "Solo el código de validación puede fijar metas." }, 403);
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
        await bitacora(env, "meta", { id: b.id, valor: b.valor }, b.por);
        return json({ ok: true, ts });
      }

      return json({ error: "no_encontrado" }, 404);
    } catch (e) {
      return json({ error: "servidor", mensaje: "Error interno. Intenta de nuevo." }, 500);
    }
  },
};
