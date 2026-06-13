function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS panel_users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inbounds (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      protocol        TEXT NOT NULL,
      port            INTEGER NOT NULL UNIQUE,
      listen          TEXT DEFAULT '0.0.0.0',
      enabled         INTEGER DEFAULT 1,
      stream_settings TEXT,
      sniffing        INTEGER DEFAULT 1,
      remark          TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      inbound_id INTEGER NOT NULL REFERENCES inbounds(id) ON DELETE CASCADE,
      email      TEXT NOT NULL,
      uuid       TEXT NOT NULL,
      enabled    INTEGER DEFAULT 1,
      total_gb   REAL DEFAULT 0,
      used_bytes INTEGER DEFAULT 0,
      expiry_at  TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS traffic_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id  INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      inbound_id INTEGER REFERENCES inbounds(id) ON DELETE CASCADE,
      up_bytes   INTEGER DEFAULT 0,
      down_bytes INTEGER DEFAULT 0,
      recorded_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { migrate };
