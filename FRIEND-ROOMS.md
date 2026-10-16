# 🎮 GameAdda — tiny games, big fun.

A lightweight collection of mobile-friendly browser games, hosted on GitHub Pages.

**Play:** https://spacereact.github.io/Games/src/multiplayer.html?game=reaction

## Games

| Game | Modes |
| --- | --- |
| Tic-Tac-Toe | Computer, same-device two-player, online two-player |
| Reaction Test | Solo with personal best, online two-player showdown |
| Rock Paper Scissors | Computer |
| Memory Flip | Solo |

## Online friend rooms

1. Open Reaction Test or Tic-Tac-Toe.
2. Select **Create room**, then **Copy invite link**.
3. Your friend opens that link on another device, or enters the 12-character room code.
4. The host starts reaction rounds and rematches. Tic-Tac-Toe begins with the host as X.

Keep both tabs open and visible. Leaving or refreshing closes your connection; create a new room to reconnect. Rooms hold two players and are invite-only. Public stranger matchmaking is not implemented.

Reaction rounds synchronize the green signal using a small clock-offset estimate. Each browser measures its own reaction time; this is a casual game, not a cheat-resistant competitive system. Early taps forfeit; no tap within about ten seconds is a DNF. Moving either tab to the background cancels a reaction round. The host validates moves, scores, turns, and round IDs. Results synchronize across both devices; reaction wins remain for the current room session.

## Connection services and limits

Solo/local games have no external runtime dependency. Online play bundles pinned PeerJS 1.5.5 (MIT license in `src/vendor/PEERJS-LICENSE`) and uses PeerJS Cloud for signaling plus the client's default Google STUN and shared PeerJS TURN services. Game messages travel through a WebRTC data channel. No API key or custom backend is configured. The host owns the live state; there is no saved match database.

Some carrier, office, VPN, or restrictive NAT networks cannot establish a direct WebRTC connection. Connection errors and timeouts offer a retry path. The bundled client includes shared TURN fallback, but no privately operated relay or service guarantee; connectivity on all network combinations is **not guaranteed**. For production reliability, operate a signaling service and authenticated TURN relay; don't commit relay credentials or server secrets into this public repository. Public matchmaking would need a separate lobby service.

Nicknames and solo personal bests are stored locally. Online opponents receive each other's display names and match data, and WebRTC can reveal peer IP addresses. Third-party signaling/STUN/TURN services receive connection metadata. No chat, accounts, analytics, or advertising are included.

## Development and checks

Serve from the repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/src/multiplayer.html?game=reaction. Test game rules and transport synchronization with Node.js 22+:

```sh
node --test tests/friend-room.test.mjs
```

`src/friend-app.js` renders the site and local games. `src/friend-room.js` owns the room lifecycle, host game rules, clock estimation, message handling, and timeouts. The tests include a simulated two-peer transport; live cross-network connectivity requires separate real-device checks.

## Deploy

The existing `.github/workflows/deploy.yml` publishes `index.html` and `src/` on pushes to `main`. Repository Settings → Pages → Source must be **GitHub Actions**.

Review third-party service availability periodically. GitHub Pages serves static files; it does not run a multiplayer server.

## License

Original site code is released as part of this repository. Third-party software, brand names, and graphics retain their respective licenses and rights.

This optional WebRTC friend mode is isolated from the main site’s WebSocket/Worker multiplayer implementation. Its entry point is `src/multiplayer.html`; the existing deployment copies the entire `src/` directory.
