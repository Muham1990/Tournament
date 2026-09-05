declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        colorScheme?: string;
      };
    };
  }
}

export function initTelegramMiniApp() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  tg.ready();
  tg.expand();
  document.documentElement.classList.add("tg-app");
}
