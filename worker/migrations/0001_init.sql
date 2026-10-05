-- Esquema del Tablero de Resultados Estratégicos de Visión Circular
CREATE TABLE IF NOT EXISTS reportes (
  id TEXT PRIMARY KEY,
  v TEXT NOT NULL,           -- dato de entrada (V01..V29)
  anio INTEGER NOT NULL,
  corte TEXT NOT NULL,       -- AAAA-MM-DD, acumulado del año hasta esta fecha
  valor REAL NOT NULL,
  material TEXT, linea TEXT, territorio TEXT, nivel TEXT, cat TEXT, metodo TEXT,
  incluido INTEGER DEFAULT 0, -- 1 = ya está dentro del consolidado de Traza (atribución)
  quien TEXT NOT NULL,       -- área que reporta
  fuente TEXT, evidencia TEXT, nota TEXT,
  por TEXT,                  -- nombre de quien reporta
  ts TEXT NOT NULL,          -- fecha y hora del envío
  corrige TEXT               -- id del reporte que reemplaza, si es corrección
);
CREATE TABLE IF NOT EXISTS validaciones (
  id TEXT PRIMARY KEY,       -- mismo id del reporte
  estado TEXT NOT NULL,      -- validado | observado
  comentario TEXT, por TEXT, ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS metas (
  id TEXT PRIMARY KEY,       -- K08-2026
  k TEXT NOT NULL, anio INTEGER NOT NULL, valor REAL NOT NULL, por TEXT, ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bitacora (
  n INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT, accion TEXT, detalle TEXT, por TEXT
);
