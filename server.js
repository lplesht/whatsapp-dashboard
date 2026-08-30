require('dotenv').config();
const express = require('express');
const path = require('path');
const { runSync } = require('./baileys-client');
const { extractEvent } = require('./extractor');
const { insertEvent, logSync, getUpcomingEvents, getLastSync } = require('./db');
const { PORT, SYNC_TOKEN } = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let syncInProgress = false;

// Simple shared-secret check so random internet traffic can't
// trigger a WhatsApp connection.
function requireToken(req, res, next) {
  const token = req.headers['x-sync-token'];
  if (token !== SYNC_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.post('/sync', requireToken, async (req, res) => {
  if (syncInProgress) {
    return res.status(409).json({ error: 'sync already running' });
  }
  syncInProgress = true;

  let messagesSeen = 0;
  let eventsFound = 0;

  try {
    await runSync(async ({ groupId, text, senderName, timestamp }) => {
      messagesSeen++;
      const messageDateISO = new Date(timestamp).toISOString().slice(0, 10);
      const event = await extractEvent(text, messageDateISO);
      if (event) {
        eventsFound++;
        insertEvent({
          groupId,
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          senderName,
        });
      }
    });

    logSync({ messagesSeen, eventsFound });
    res.json({ ok: true, messagesSeen, eventsFound });
  } catch (err) {
    console.error('Sync failed:', err);
    res.status(500).json({ error: err.message });
  } finally {
    syncInProgress = false;
  }
});

app.get('/events', (req, res) => {
  res.json({ events: getUpcomingEvents(), lastSync: getLastSync() });
});

app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'qr.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
