# 🎮 GameAdda — tiny games. big fun.

A lightweight, no-login browser gaming playground. The website is hosted as static files, and an optional Cloudflare Worker handles live two-player games.

## Games

| Game | Solo | Same-device multiplayer | Real-time online |
| --- | --- | --- | --- |
| Tic-Tac-Toe | ✅ vs computer | ✅ | ✅ when Cloudflare Worker is deployed |
| Rock Paper Scissors | ✅ | — | — |
| Memory Flip | ✅ | — | — |
| Reaction Test | ✅ | — | — |

## Main features

- No accounts, email addresses or passwords
- Mobile-friendly game catalogue and temporary nicknames
- Shareable game links
- Online Tic-Tac-Toe private rooms with invite links
- Stranger matchmaking for online Tic-Tac-Toe
- Validated moves, rematches and reconnect support
- Original four games remain playable without any backend

## Live site

GitHub Pages URL **after Pages is enabled**: https://spacereact.github.io/Games/

To enable Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow `.github/workflows/deploy.yml` publishes the static site on pushes to `main`.

## Important: online multiplayer requires a one-time deploy

The multiplayer backend code is committed under `worker/`, but adding it to GitHub does **not** deploy the Cloudflare Worker or connect players.

Follow **[MULTIPLAYER_SETUP.md](MULTIPLAYER_SETUP.md)** to:

1. Deploy the Worker to your Cloudflare account.
2. Copy the actual `workers.dev` URL.
3. Set it in `src/online-config.js` and commit.
4. Test with two phones.

Until step 3 is complete, the website visibly explains that online multiplayer is not yet connected.

## Build and run the static website

No Node dependencies are needed for the frontend.

```bash
git clone https://github.com/SPACEreact/Games.git
cd Games
python3 -m http.server 8000
```

Open http://localhost:8000/

## Developer checks

Run multiplayer rule tests from the `worker` folder:

```bash
cd worker
npm test
```

## Long-term maintenance

Keep the GitHub repository, your domain registrar, and your Cloudflare account under your control. Enable 2FA, keep backups, monitor Cloudflare free-tier usage, and review security and privacy requirements before adding Google AdSense.

**No hosting setup is guaranteed to run untouched for ten years.** This design minimizes infrastructure and moving parts, but occasional checks are important.
