-- ============================================================
--  Taller de Mecánica Automotriz · Control de herramientas
--  Esquema PostgreSQL (se puede ejecutar varias veces sin romper nada)
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  usuario       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  rol           VARCHAR(20)  NOT NULL DEFAULT 'responsable' CHECK (rol IN ('admin','responsable')),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cursos (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS estudiantes (
  id        SERIAL PRIMARY KEY,
  ci        VARCHAR(20)  NOT NULL UNIQUE,
  nombres   VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  celular   VARCHAR(20),
  curso_id  INT NOT NULL REFERENCES cursos(id),
  activo    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS categorias (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS herramientas (
  id                  SERIAL PRIMARY KEY,
  codigo              VARCHAR(30)  NOT NULL UNIQUE,
  nombre              VARCHAR(120) NOT NULL,
  categoria_id        INT REFERENCES categorias(id),
  cantidad_total      INT NOT NULL DEFAULT 1 CHECK (cantidad_total >= 0),
  cantidad_disponible INT NOT NULL DEFAULT 1 CHECK (cantidad_disponible >= 0),
  estado              VARCHAR(10) NOT NULL DEFAULT 'bueno' CHECK (estado IN ('bueno','regular','malo')),
  ubicacion           VARCHAR(80),
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (cantidad_disponible <= cantidad_total)
);

-- Compañeros que prestan las herramientas (se escribe su nombre al prestar)
CREATE TABLE IF NOT EXISTS responsables (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX IF NOT EXISTS responsables_nombre_uq ON responsables (lower(nombre));

CREATE TABLE IF NOT EXISTS prestamos (
  id             SERIAL PRIMARY KEY,
  estudiante_id  INT NOT NULL REFERENCES estudiantes(id),
  responsable_id INT NOT NULL REFERENCES responsables(id),
  registrado_por INT REFERENCES usuarios(id),
  fecha_prestamo TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_limite   TIMESTAMPTZ NOT NULL,
  fecha_cierre   TIMESTAMPTZ,
  estado         VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','devuelto')),
  observaciones  TEXT
);

-- Un préstamo puede tener 10, 20 o más herramientas (una fila por herramienta)
CREATE TABLE IF NOT EXISTS prestamo_items (
  id                SERIAL PRIMARY KEY,
  prestamo_id       INT NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  herramienta_id    INT NOT NULL REFERENCES herramientas(id),
  cantidad          INT NOT NULL CHECK (cantidad > 0),
  cantidad_devuelta INT NOT NULL DEFAULT 0 CHECK (cantidad_devuelta >= 0),
  cantidad_perdida  INT NOT NULL DEFAULT 0 CHECK (cantidad_perdida >= 0),
  CHECK (cantidad_devuelta + cantidad_perdida <= cantidad)
);

CREATE INDEX IF NOT EXISTS idx_prestamos_estado  ON prestamos (estado, fecha_limite);
CREATE INDEX IF NOT EXISTS idx_prestamos_fecha   ON prestamos (fecha_prestamo);
CREATE INDEX IF NOT EXISTS idx_prestamos_est     ON prestamos (estudiante_id);
CREATE INDEX IF NOT EXISTS idx_items_prestamo    ON prestamo_items (prestamo_id);
CREATE INDEX IF NOT EXISTS idx_items_herramienta ON prestamo_items (herramienta_id);
