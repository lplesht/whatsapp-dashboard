const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { ALLOWED_GROUPS, EVENT_KEYWORDS, SESSION_PATH } = require('./config');

const logger = pino({ level: 'warn' });

// Written whenever a new QR is generated, so it can be served
// as an image at /qr for scanning from another device/browser.
const QR_IMAGE_PATH = path.join(__dirname, '..', 'public', 'qr.png');

let sock = null;
let connectionReady = false;

/**
 * Connects, drains any messages that arrived while disconnected,
 * runs them through the whitelist + keyword filter, hands
 * survivors to onEvent(text, groupId, timestamp), then
 * disconnects. Resolves when the sync is done.
 */
async function runSync(onMessage) {
  if (!fs.existsSync(path.dirname(SESSION_PATH))) {
    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
  const { version } = await fetchLatestBaileysVersion();

  return new Promise((resolve, reject) => {
    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Save QR as an image so it can be opened in a browser
        // from a different device and scanned there.
        await qrcode.toFile(QR_IMAGE_PATH, qr);
        console.log('New QR code written to public/qr.png — open /qr to scan it.');
      }

      if (connection === 'open') {
        connectionReady = true;
        console.log('Connected to WhatsApp.');
      }

      if (connection === 'close') {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (!shouldReconnect) {
          reject(new Error('Logged out — delete session folder and re-scan QR.'));
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;

      for (const msg of messages) {
        try {
          const groupId = msg.key.remoteJid;

          // --- WHITELIST GATE — first check, nothing else runs before it ---
          if (!ALLOWED_GROUPS.includes(groupId)) {
            continue; // dropped immediately, never touches anything else
          }

          const text = extractText(msg);
          if (!text) continue;

          // --- KEYWORD PRE-FILTER — reduces what leaves the server ---
          const hasKeyword = EVENT_KEYWORDS.some((k) => text.includes(k));
          if (!hasKeyword) continue;

          const senderName = msg.pushName || 'Unknown';
          const timestamp = Number(msg.messageTimestamp) * 1000;

          await onMessage({ groupId, text, senderName, timestamp });
        } catch (err) {
          console.error('Error processing message:', err.message);
        }
      }
    });

    // After a short idle window post-connection, assume the
    // backlog has drained and close the connection cleanly.
    let idleTimer = null;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        await sock.end(undefined);
        connectionReady = false;
        resolve();
      }, 8000);
    };

    sock.ev.on('connection.update', (u) => {
      if (u.connection === 'open') resetIdleTimer();
    });
    sock.ev.on('messages.upsert', () => resetIdleTimer());
  });
}

function extractText(msg) {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    null
  );
}

module.exports = { runSync };
