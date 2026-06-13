const Database = require('better-sqlite3');
const config = require('../config');
const { migrate } = require('./migrate');

let db;

function getDb() {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

module.exports = { getDb };
