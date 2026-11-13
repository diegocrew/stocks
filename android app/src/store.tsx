import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MAX_STOCKS, toggleStock, validateSelection } from '../../src/watchlist.js';
import { message, parseCatalog, parsePortfolios, parseSnapshot, requestData, type Catalog, type Portfolio, type Snapshot } from './data';

const STORAGE_KEY = 'stock-atlas.android.watchlist.v1';

function useMarketStore() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [portfolioId, setPortfolioId] = useState('custom');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [portfolioError, setPortfolioError] = useState('');
  const initialized = useRef(false);
  const saving = useRef(false);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const [marketJSON, catalogJSON] = await Promise.all([requestData('market.json'), requestData('companies.json')]);
      const nextSnapshot = parseSnapshot(marketJSON);
      const nextCatalog = parseCatalog(catalogJSON);
      if (!initialized.current) {
        let nextSelected = nextCatalog.defaultSymbols;
        try {
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          nextSelected = validateSelection(saved === null ? nextSelected : JSON.parse(saved), nextCatalog.companies);
        } catch (cause) {
          setSelectionError(`Could not restore your watchlist: ${message(cause)} Using the default list.`);
        }
        setSelected(nextSelected);
        initialized.current = true;
      }
      setSnapshot(nextSnapshot);
      setCatalog(nextCatalog);
      setError('');
    } catch (cause) {
      setError(`Could not update market data: ${message(cause)}`);
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, []);

  const refreshPortfolios = useCallback(async () => {
    try {
      setPortfolios(parsePortfolios(await requestData('portfolios.json')));
      setPortfolioError('');
    } catch (cause) {
      setPortfolioError(`Could not update portfolios: ${message(cause)}`);
    }
  }, []);

  // Both loaders update React state only after asynchronous I/O.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); void refreshPortfolios(); }, [refresh, refreshPortfolios]);

  async function saveSelection(next: string[]) {
    if (saving.current) return;
    saving.current = true;
    setSelectionError('');
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSelected(next);
      setPortfolioId('custom');
    } catch (cause) {
      setSelectionError(`Could not save your watchlist: ${message(cause)}`);
    } finally {
      saving.current = false;
    }
  }

  async function toggle(symbol: string) {
    if (!catalog || !initialized.current) return;
    try {
      await saveSelection(validateSelection(toggleStock(selected, symbol), catalog.companies));
    } catch (cause) {
      setSelectionError(message(cause));
    }
  }

  return {
    snapshot, catalog, portfolios, selected, portfolioId, setPortfolioId, loading, error,
    selectionError, portfolioError,
    refresh: () => { setLoading(true); return refresh(); },
    refreshPortfolios, toggle,
    reset: () => catalog && saveSelection(catalog.defaultSymbols), maxStocks: MAX_STOCKS,
  };
}

const MarketContext = createContext<ReturnType<typeof useMarketStore> | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  return <MarketContext.Provider value={useMarketStore()}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const store = useContext(MarketContext);
  if (!store) throw new Error('Market screens must be inside MarketProvider.');
  return store;
}
