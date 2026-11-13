export const SUPPORT_EMAIL = 'diego.crew@gmail.com';
export const PRIVACY_URL = 'https://diegocrew.github.io/stocks/android/privacy.html';
export const POLICY_DATE = '2026-11-13';
export const privacySections = [
  {
    title: 'About Stock Atlas',
    text: 'Stock Atlas, maintained by diegocrew, is a stock-market research app. It displays public company quotes, price history and disclosed portfolio holdings. It does not offer trading, brokerage accounts, payments or personalized investment advice.',
  },
  {
    title: 'Information stored on your phone',
    text: 'Your selected watchlist tickers are saved in local app storage. We do not send your saved watchlist as a list to our servers. There are no app accounts, advertising SDKs or app analytics. The app does not request access to your contacts, location, microphone, camera, or personal files.',
  },
  {
    title: 'Network requests and hosting',
    text: 'An internet connection is needed to retrieve quotes and holdings from diegocrew.github.io. Opening a chart requests the selected ticker in the history-file URL. GitHub, our hosting provider, receives normal connection information such as your IP address and requested URL and may process it for hosting, security and abuse prevention under its own privacy statement at https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement. We do not use these requests for advertising or create user profiles. Requests use HTTPS.',
  },
  {
    title: 'Retention and deletion',
    text: 'Your saved watchlist remains on your device until changed or removed. To remove it, use Android Settings > Apps > Stock Atlas > Storage > Clear data, or uninstall the app. No developer-operated account or server-side watchlist exists to delete. Hosting-provider logs are subject to that provider\'s retention policy. Android backup is disabled for this app.',
  },
  {
    title: 'Support and privacy requests',
    text: `If you email ${SUPPORT_EMAIL}, your email provider and ours process your address and whatever information you choose to send. We use support correspondence to respond to requests and retain it only as needed for support and applicable obligations. Do not send passwords, account credentials or sensitive financial information. Contact the same address for privacy questions or requests.`,
  },
  {
    title: 'Children and changes to this policy',
    text: 'Stock Atlas is intended for adults conducting market research, not for children. We do not knowingly solicit children\'s personal information. Changes in app behavior or service providers will be reflected in an updated policy before the relevant release.',
  },
] as const;
