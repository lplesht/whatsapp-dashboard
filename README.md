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

## Future direction: a full family dashboard

The longer-term goal for this project is broader than WhatsApp — a single
dashboard aggregating multiple sources per family member (WhatsApp, Gmail,
possibly bank accounts; medical portals like כללית/מכבי are deliberately
out of scope for now — no public API found, and higher privacy stakes than
the rest). Notes from that research, for when this gets picked back up:

**Per-source feasibility**
- **Gmail** — easy, official OAuth2 API, low risk. Natural next connector.
- **Bank accounts** — no accessible official API yet (Israel's Open Banking
  standard targets licensed fintechs, not hobby projects). The practical
  route is the open-source [`israeli-bank-scrapers`](https://github.com/eshaham/israeli-bank-scrapers)
  (headless-browser login with real credentials) — works, but unofficial
  and requires careful credential handling.
- **כללית/מכבי** — no public API found; not planned for now.

**Preferred architecture — Raspberry Pi as the credential vault**

Rather than running credentialed connectors (bank, etc.) on a
public-facing cloud server, run them on a Raspberry Pi at home instead:

- The Pi only ever makes *outbound* calls (to each service, and to the
  Claude API to normalize scraped data into structured records) — it never
  needs to accept inbound connections, so there's nothing to expose to the
  internet. Meaningfully smaller attack surface than a VPS for anything
  credential-heavy.
- A daily `cron` job runs each connector (Gmail, bank, and possibly
  WhatsApp too), then only the already-structured, sanitized output
  — never raw credentials or raw messages — leaves the Pi.
- Needs real RAM if bank scraping is involved (`israeli-bank-scrapers`
  runs headless Chromium under the hood) — a Pi 4 (4GB) or Pi 5, not a
  Pi Zero.

Two options for where the dashboard itself then lives:
- **Option A**: keep this VPS as the display layer — the Pi pushes
  structured records to a new authenticated endpoint here, same pattern
  as `/sync` today.
- **Option B (leaning this way)**: retire the VPS entirely, host the
  dashboard on the Pi itself, and have family members reach it over
  [Tailscale](https://tailscale.com/) (a free private mesh VPN) instead
  of a public IP/domain — no public exposure at all, no HTTPS/Caddy/domain
  setup needed, and no monthly VPS cost. Trade-off: dashboard uptime is
  then tied to home power/internet.
