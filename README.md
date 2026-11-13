# Stock Atlas

A dark, finance-themed dashboard for exploring global stocks and building your own market view.

## Features

- **500 global companies** across AI, IT, defence/aerospace and medical/healthcare, with sector and country filters, search and a paginated directory.
- **Personal watchlists** saved in your browser. The original 30 AI/defence stocks are the default; choose up to 30 companies and restore the defaults at any time.
- **Auto-follow portfolio presets:** S&P 500 via SPY, Berkshire Hathaway's reported US equity holdings, Nasdaq-100 via QQQ, and ARK Innovation (ARKK). Switch presets from the company selector without losing your personal watchlist.
- **Portfolio-weighted heatmaps** show the latest top 30 tickered holdings (or all when fewer), sized by reported holding weight rather than company size. Full holdings, including untickered positions, remain searchable in a separate list.
- **Holdings-change tracking** records additions, removals and reported weight changes between successful source checks, retaining the latest 60 change events. New published membership automatically updates followed portfolios on reload and during 15-minute checks while the page is visible.
- **Market-cap heatmap** with rectangles sized by company value in USD. Red/green intensity represents daily performance; each tile also shows the weekly change.
- **Sector zoom** to explore smaller companies within each industry.
- **Interactive company charts** for day, week, month, year and maximum available history, with exact values on hover or touch.
- **Period-based chart colors:** green when the ending price is above the selected period's starting price, red when below, and neutral when unchanged. Both the line and shaded area follow the selected period.
- **Compare up to five companies** using percentage returns over their overlapping history. Comparison lines retain distinct colors to identify each company.
- **International listings and currencies**, with USD-converted market caps and charts in each listing's currency.
- **Twice-daily data updates** at 10:00 and 16:00 Europe/Prague, with automatic daylight-saving adjustment.
- **Responsive layout**, on-demand price-history loading, quote timestamps and explicit unavailable/stale-data warnings.

## Understanding the data

- Daily performance means the latest regular-session price versus the previous trading close, not a rolling 24-hour return. Weekly performance uses the last available close at or before seven calendar days earlier.
- Chart colors compare the first and last observations within the selected period, not the daily heatmap change. Price returns exclude dividends.
- Maximum history begins with the earliest data available for that listing, using monthly observations before the recent daily-history window.
- The catalog is a representative selection by sector and market capitalization, not an official ranking of the world's most popular stocks. It includes civilian aerospace businesses as well as defence companies.
- Quotes and history come from Yahoo Finance; company-directory metadata comes from CompaniesMarketCap. Prices may be delayed, and coverage varies by exchange.
- Watchlists track companies, not your share quantities, purchase prices or personal investment returns.
- SPY, QQQ and ARKK holdings come from their fund issuers; Berkshire holdings come from DATAROMA's compilation of reported US holdings. Source links, reporting dates and last successful checks are shown. Berkshire disclosures are quarterly and delayed, not live, and exclude private subsidiaries, cash and unreported foreign holdings.
- Portfolio heatmaps cover only displayed, quoted holdings; coverage is shown explicitly. A missing quote is flagged, not replaced by a lower-ranked holding. Weighted daily moves are for the shown subset, not the fund's total return. Weight changes can reflect price movements rather than trades.
- Holdings are checked during each scheduled update. Failed sources retain the last successful holdings with visible warnings; no holdings are invented.

For research only. Not investment advice.

## Native Android app

The Expo TypeScript app lives in [`android app/`](./android%20app/). It uses native
screens (not a WebView) for the watchlist, company directory, portfolio presets,
and price-history charts. It reads the public GitHub Pages JSON snapshots;
no credentials or environment files are required. Watchlists are stored locally
on the phone. This first native version does not yet include web chart comparisons,
full holdings/change-event browsing, or market-cap-sized heatmap tiles.

Run these commands in WSL Ubuntu with Node LTS, Java 17 and the Android SDK configured:

```bash
cd '/mnt/c/github/stocks/android app'
npm ci
npm test
npx tsc --noEmit
npx expo run:android
```

For an already installed debug app, run `npx expo start --localhost` and
`adb reverse tcp:8081 tcp:8081` with the phone connected through ADB.
Wireless debugging uses `adb pair PHONE_IP:PAIRING_PORT`, followed by
`adb connect PHONE_IP:CONNECTION_PORT`; the ports are different and can change.
Enter pairing codes interactively, never in tracked files.

Expo generates the ignored native `android/` directory. After native dependencies
or app configuration change, rerun `npx expo prebuild --platform android` and
`npx expo run:android`. Metro also watches the parent repository so the native app
can reuse the dashboard's market, watchlist, and portfolio helpers.
Dependencies, native build outputs and `.env*`/`*.env` files are ignored. Never put
secrets in app code: values embedded in a mobile application are extractable.

### Play Store release

The permanent Android ID is `diegocrew.stockatlas`. Run `npm run store:assets`
to generate the branded app/store icons and the privacy page from the same
policy displayed inside the app. The publish workflow includes the policy at
`https://diegocrew.github.io/stocks/android/privacy.html`; that URL becomes
available only after these changes are deployed.

In WSL, run `npm run release:android` inside `android app/` to generate both a
signed Play App Bundle and a standalone APK in the ignored `releases/` folder.
The release embeds its JavaScript and does not need Metro. It supports ARM64
and x86_64 devices. The first run creates a private upload key and credential
file in `~/.config/stock-atlas/` (outside Git, restricted permissions).
**Back up that entire directory securely. Never share or commit it.**
Later releases must reuse the upload key and increment `android.versionCode`.
Missing signing credentials fail release builds instead of using the debug key.

Store text and a submission checklist are in
[`android app/store/listing.txt`](./android%20app/store/listing.txt).
Begin with internal testing and review every Play Console declaration;
having a signed bundle is not approval for production distribution.
