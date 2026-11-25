export async function registerOfflineCache(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  if (!window.isSecureContext) return false;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return true;
  } catch {
    return false;
  }
}
