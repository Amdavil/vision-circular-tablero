-- Preformulación de proyectos (taller de formulación, oct 2026): un proyecto por área.
-- Nada se sobrescribe: cada guardado es una versión nueva; la vigente es la más reciente del área.
CREATE TABLE IF NOT EXISTS preformulaciones (
  id TEXT PRIMARY KEY,
  area TEXT NOT NULL,        -- IMP, LB, INN, ISP, TER, CON, COM, FIN
  estado TEXT NOT NULL,      -- borrador | enviada
  datos TEXT NOT NULL,       -- JSON con problema, propósito, objetivos y actividades
  por TEXT,                  -- nombre de quien guarda
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pref_area_ts ON preformulaciones (area, ts);
