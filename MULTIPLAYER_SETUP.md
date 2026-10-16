# Deploy GameAdda multiplayer 🎮

The complete **online Tic-Tac-Toe beta** is in this repository. It includes:

- Private rooms with 8-character room codes and shareable links (`?room=ABCDEFGH`).
- Random matchmaking between two waiting strangers.
- Server-authoritative turns, legal moves, wins and draws.
- Rematch voting, disconnect indicators, and same-browser rejoining.
- No email, password, or public chat.
- WebSocket hibernation on Cloudflare Durable Objects (SQLite backend), intended for low traffic and low maintenance.
- Automated rules tests and a manual/opt-in GitHub Actions Worker deployment.

**Important:** This code is not publicly connected until the Cloudflare Worker is deployed AND its public URL is set in the website configuration. GitHub Pages alone cannot host live game sessions.

## Option 1 — Deploy from the Cloudflare CLI

1. Create or sign in to a Cloudflare account: https://dash.cloudflare.com/
2. On your computer, install Node.js 22 or newer.
3. Clone this GitHub repository and open its worker folder:

   ```bash
   git clone https://github.com/SPACEreact/Games.git
   cd Games/worker
   npm install
   npx wrangler login
   npm test
   npm run deploy
   ```

4. Cloudflare will print the Worker address. It should resemble:

   `https://gameadda-multiplayer.YOUR_ACTUAL_SUBDOMAIN.workers.dev`

   **Do not guess the subdomain. Copy the exact URL shown by the successful deployment.**

5. Confirm the Worker is reachable by opening `YOUR_WORKER_URL/health` in a browser. It should return JSON with `"ok":true`.
6. Edit `src/online-config.js` in GitHub. Set:

   ```js
   export const WORKER_URL = "https://gameadda-multiplayer.YOUR_ACTUAL_SUBDOMAIN.workers.dev";
   ```

7. Commit the configuration change to `main`. The GitHub Pages workflow will publish the new site if Pages is already enabled. If not, select **Settings → Pages → Build and deployment → Source: GitHub Actions**.
8. Visit the site and use **Play with anyone → Create private room**.

## Option 2 — Deploy from GitHub Actions

The file `.github/workflows/multiplayer.yml` includes a deployment job.

1. In Cloudflare, create an API token with the minimum required permissions to deploy this Worker and use Durable Objects. Copy your Cloudflare Account ID.
2. In this GitHub repo, open **Settings → Secrets and variables → Actions → Repository secrets**. Add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Open **Actions → Test and deploy multiplayer server → Run workflow**.
4. After a successful deployment, copy the actual `workers.dev` URL from the job logs and put it in `src/online-config.js`.
5. Optionally add a GitHub Actions repository **variable** `GAMEADDA_WORKER_DEPLOY=true` for automatic Worker deployments after future changes in `worker/**`. Keep it unset until the initial deployment works.

Never put API tokens, passwords, or private credentials into `src/online-config.js` or source code. The public Worker URL is safe to publish.

## Validate two-player play

Test on **two independent devices**, not just two tabs of the same browser:

1. Phone A opens GameAdda → Public rooms → Create private room.
2. A chooses nickname and copies the room link.
3. Phone B, using another device/network, opens the link and chooses a different nickname.
4. A is X; B is O. Both should see the same 3×3 board and be unable to play out of turn.
5. Complete a game and verify the winner on both screens.
6. Test Request rematch from both devices.
7. Close one player's tab and reload it; that player should rejoin the same room using the same browser session token.
8. To test strangers, open **Find opponent** independently on both devices.
9. Confirm solo games work even if the Worker is temporarily unavailable.

## Safety and long-term cost notes

- The server is a deliberately simple single Durable Object lobby designed for small hobby traffic, not a high-scale system.
- There is a 300-WebSocket connection cap and a basic per-IP concurrent-connection cap. These do **not** replace full bot protection or moderation.
- Private room codes are unguessable 8-character codes. They are not user authentication. Treat room URLs as invite links.
- The Worker keeps game data temporarily in SQLite-backed Durable Object storage and clears inactive/old rooms; your browser keeps guest nicknames locally.
- Cloudflare Workers Free has quotas. Exceeding them may make multiplayer temporarily unavailable; monitor usage.
- Your domain and GitHub Pages setup are separate from the multiplayer Worker.
- Keep backup copies of the repo and review your domain, security, abuse logs, and costs periodically. Ten years without any maintenance cannot be guaranteed.
- For AdSense later, provide required privacy/cookie disclosures and follow ad placement policies.

## Debugging

- **"Server not live yet"**: `src/online-config.js` is still blank.
- **WebSocket error**: check the Worker deployment and its `/health` endpoint, then check Cloudflare Worker logs.
- **403 Origin not allowed**: update `ALLOWED_ORIGINS` in `worker/wrangler.toml` with the exact origin of your custom frontend domain, then redeploy.
- **Room expired/full**: create a new private room and share its link.
- **GitHub Pages not updating**: inspect https://github.com/SPACEreact/Games/actions and ensure Pages source is GitHub Actions.
