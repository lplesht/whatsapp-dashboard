const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('./config');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT,
    time TEXT,
    location TEXT,
    sender_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ran_at TEXT DEFAULT CURRENT_TIMESTAMP,
    messages_seen INTEGER,
    events_found INTEGER
  );
`);
// Note: raw message text is intentionally never stored here —
// only the extracted event fields, per the "don't keep raw
// content" decision.

function insertEvent({ groupId, title, date, time, location, senderName }) {
  db.prepare(
    `INSERT INTO events (group_id, title, date, time, location, sender_name)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(groupId, title, date, time, location, senderName);
}

function logSync({ messagesSeen, eventsFound }) {
  db.prepare(`INSERT INTO sync_log (messages_seen, events_found) VALUES (?, ?)`).run(
    messagesSeen,
    eventsFound
  );
}

function getUpcomingEvents() {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .prepare(`SELECT * FROM events WHERE date >= ? OR date IS NULL ORDER BY date ASC`)
    .all(today);
}

function getLastSync() {
  return db.prepare(`SELECT * FROM sync_log ORDER BY ran_at DESC LIMIT 1`).get();
}

module.exports = { insertEvent, logSync, getUpcomingEvents, getLastSync };
