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
