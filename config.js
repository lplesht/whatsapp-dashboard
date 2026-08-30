// ============================================================
// WHITELIST — the ONLY groups this app will ever process.
// Everything else is dropped in memory before it touches
// any other part of the code (see baileys-client.js).
//
// To find your group IDs: run `npm run dev`, scan the QR once,
// then send any message in the groups you care about — the
// console will log "Unlisted group seen:" with the ID so you
// can copy it here.
// ============================================================

const ALLOWED_GROUPS = [
  // '123456789-1234567890@g.us', // e.g. "כיתה א׳2 - הורים"
  // '123456789-1234567890@g.us', // e.g. "גן פרפרים"
];

// Keyword pre-filter (optional but recommended): only messages
// containing at least one of these are sent to the Claude API.
// Everything else stays local and is discarded after processing.
const EVENT_KEYWORDS = [
  'יום הולדת', 'מסיבה', 'טיול', 'אירוע', 'חג', 'חופש',
  'פגישת הורים', 'אסיפה', 'תאריך', 'מפגש', 'הפעלה',
  'birthday', 'party', 'event', 'trip', 'holiday'
];

module.exports = {
  ALLOWED_GROUPS,
  EVENT_KEYWORDS,
  DB_PATH: process.env.DB_PATH || './data/events.db',
  SESSION_PATH: process.env.SESSION_PATH || './data/session',
  PORT: process.env.PORT || 3000,
  // Simple shared-secret auth for the /sync endpoint so random
  // internet traffic can't trigger a WhatsApp sync.
  SYNC_TOKEN: process.env.SYNC_TOKEN || 'change-me',
};
