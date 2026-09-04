# GamePulse roadmap

## Done (foundation pass)
- Design system tokens (dark/OLED/light, accents, density, performance modes)
- Domain models, platform metadata, release date logic, mock data
- i18n (7 locales), preferences, local library (wishlist/follow)
- App shell: sidebar, mobile nav, command center (Ctrl+K)
- Release views: Rail, Timeline, Agenda, Month, Countdown, Recently Released
- Routes: /, /releases, /game/$slug, /deals, /free, /news, /discover, /watchlist, /settings
- PWA: manifest, icons, install prompt (manifest-only, no offline worker)
- Steam connection (mock provider): connect/resync/disconnect + owned library in Settings

## Next passes
- Real data providers + Lovable Cloud backend (accounts, synced watchlist, notifications)
- Swap mock Steam provider for a real server-backed adapter once Cloud is available
