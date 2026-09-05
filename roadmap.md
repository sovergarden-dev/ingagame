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
- Full surfaces for /deals (sort + store filters), /free (expiry countdowns), /news (source filters + lead story), /discover (search, genre/platform filters, sorting), /watchlist (wishlist/following tabs + released section)

- Lovable Cloud backend: profiles + watchlist_items tables with owner-only access
- Accounts: email/password + Google sign-in (/auth), account panel in Settings,
  session-aware sidebar with clean sign-out
- Watchlist syncs to the account after sign-in (local-first when signed out)
- Security linter: clean


## Next passes
- Real data providers (releases, deals, news) + notifications
- Swap mock Steam provider for a real server-backed adapter

