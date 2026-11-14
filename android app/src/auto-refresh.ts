import type { AppStateStatus } from 'react-native';

type AppLifecycle = {
  currentState: string | null | undefined;
  addEventListener(type: 'change', listener: (state: AppStateStatus) => void): { remove(): void };
};

export function startAutoRefresh(lifecycle: AppLifecycle, refresh: () => void): () => void {
  const subscription = lifecycle.addEventListener('change', state => {
    if (state === 'active') refresh();
  });
  const timer = setInterval(() => {
    if (lifecycle.currentState === 'active') refresh();
  }, 15 * 60 * 1000);
  refresh();
  return () => {
    subscription.remove();
    clearInterval(timer);
  };
}
