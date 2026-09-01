# WhatsApp Event Dashboard

A system that extracts events (birthdays, parties, trips) from selected WhatsApp groups and displays them on a dashboard. Sync is on-demand — you tap a button, nothing listens in the background.

## Project structure

```
src/config.js          ← whitelist of groups + keywords (edit this!)
src/baileys-client.js  ← WhatsApp connection + whitelist filtering
src/extractor.js       ← calls the Claude API to extract events
src/db.js              ← SQLite database
src/server.js          ← Express server (/sync, /events)
public/index.html      ← the dashboard (PWA)
public/qr.html          ← page for scanning the QR code
```

## Step 1: Set up GitHub and a repo

1. On github.com (works fine from an iPhone), create a new **private** repo called `whatsapp-dashboard`
2. Push this whole folder to it — or, if you're on mobile without a terminal, just drag the files in through GitHub's web UI ("Add file → Upload files")

## Step 2: Set up the VPS

1. Sign up for Hetzner Cloud or DigitalOcean (via browser)
2. Create a small Ubuntu 24.04 server (Hetzner cx22 / a basic droplet, ~$5/month)
3. Add an SSH key (if working from an iPhone — **Termius** can generate a key and connect to the server)

## Step 3: Connect to the server and install

Via an SSH app (Termius recommended for iPhone):

```bash
# Install Node.js and git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# Clone the code from GitHub
git clone https://github.com/USERNAME/whatsapp-dashboard.git
cd whatsapp-dashboard
npm install

# Set up environment variables
cp .env.example .env
nano .env   # fill in ANTHROPIC_API_KEY and SYNC_TOKEN
```

## Step 4: Set up the whitelist

Edit `src/config.js` and add the relevant group IDs to `ALLOWED_GROUPS`. The list starts empty on purpose — run the server, send a test message in the group, and the console will print that group's ID so you can copy it in.

## Step 5: First run + QR scan

```bash
npm run start
```

On first run you'll see a message that a QR code was written. Open in a browser (from any device):
```
http://<server-address>:3000/qr
```
and scan it with WhatsApp → Settings → Linked Devices → Link a Device.

**No second device to scan with?** Set `LINK_PHONE_NUMBER` in `.env` to your
number (digits only, country code included, e.g. `972501234567`), restart
the app, and trigger a sync — instead of a QR, the console prints an
8-character pairing code. In WhatsApp, go to Linked Devices → Link a Device
→ "Link with phone number instead" and type that code in.

## Step 6: Keep it running with pm2

```bash
npm install -g pm2
pm2 start src/server.js --name whatsapp-dashboard
pm2 save
pm2 startup   # ensures the server restarts after a reboot
```

## Step 7: Add HTTPS (strongly recommended)

The `SYNC_TOKEN` travels as a plain header — without HTTPS it's visible to
anyone on the network path. `deploy/Caddyfile` sets up a reverse proxy with
automatic Let's Encrypt certificates; see the comments in that file for the
install command and a `nip.io` option if you don't have a domain yet.

Once it's running, use the HTTPS URL (e.g. `https://your-domain.example.com`)
in place of `http://<server-address>:3000` for the rest of this guide.

## Step 8: Access from your iPhone

Open in Safari: your server's URL (HTTPS if you did Step 7, otherwise
`http://<server-address>:3000`) → Share → Add to Home Screen (turns it into
a PWA that looks like an app).

On first load you'll be asked to enter the `SYNC_TOKEN` you set in `.env` (it's saved locally on the phone).

## Security notes
- Raw message text is never stored in the database — only the extracted event
- The `/sync` endpoint requires a secret token (`x-sync-token`) — without it, no one can trigger a sync
- Strongly recommended: add HTTPS (Step 7) before regular use, so the token doesn't travel in plain text
