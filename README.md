# 🎮 GameAdda — tiny games, big fun.

A lightweight, dependency-free collection of mini-games made to live on the web for years. No login, no downloads, and no paid build pipeline.

## Included games
- **Tic-Tac-Toe:** computer or two players using one device.
- **Rock Paper Scissors:** single-player vs computer.
- **Memory Flip:** card-matching challenge.
- **Reaction Test:** reaction-time challenge with a personal best on this device.

## What works
- Mobile-responsive homepage and game catalogue.
- Optional guest nickname stored in your own browser.
- Shareable URLs (for example: `?game=tic`).
- Games work completely client-side, with no external API or subscription.
- A GitHub Actions workflow for deployment.

**Live multiplayer and public matchmaking are not yet connected.** Shareable links open a game's page, not a shared online match. The Public Rooms page makes this clear.

## Host for free on GitHub Pages

The repository includes `.github/workflows/deploy.yml`. To enable it once:

1. Open **Settings → Pages** for this repository.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open **Actions → Deploy GameAdda to GitHub Pages** and run the workflow if it did not deploy automatically.

Once GitHub Pages is enabled and deployment succeeds, the site should be available at:

https://spacereact.github.io/Games/

The repository is public and GitHub Pages is free for public repositories.

## Add a new game

Edit `src/app.js`:
1. Add its metadata to `GAMES`.
2. Add its renderer and interaction handler.
3. Connect it in `gamePage()` and the click dispatcher.

For long-term growth, consider moving each game's renderer into its own `src/games/<id>.js` module when the catalogue becomes larger.

## Test locally

No Node.js or dependencies needed. Serve this repository with any local static server:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/Games/ if serving from the parent folder, or http://localhost:8000/ when inside the repository.

## Ten-year sustainability

- Keep the domain and repo owned by you; enable two-factor authentication.
- GitHub Pages only hosts static games. Real stranger-to-stranger multiplayer will require a synchronized server or hosted backend.
- Review this repository, dependencies (if any), your domain renewal, and service limits periodically.
- Before adding Google AdSense, publish a complete privacy policy and meet its approval and content requirements.
- Don't commit API secrets into this repository.

## License

Original site code is released as part of this repository. Third-party brand names and graphics retain their respective rights.
