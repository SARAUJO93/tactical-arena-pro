import { TeamId } from '../core/EventBus';

export interface ShortcutActions {
  togglePanel: () => void;
  toggleTelemetry: () => void;
  toggleSafeZones: () => void;
  toggleDemoMode: () => void;
  activateSuddenDeath: () => void;
  activateFrenzy: () => void;
  triggerMeteorShower: () => void;
  simulateFollow: () => void;
  simulateShare: () => void;
  simulateTap: (team: TeamId) => void;
  manualTestGift: (team: TeamId, tier: number) => void;
}

export function initInputShortcuts(actions: ShortcutActions): void {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      actions.activateFrenzy();
      return;
    }

    const k = e.key.toLowerCase();
    switch (k) {
      case 'h': actions.togglePanel(); break;
      case 'i': actions.toggleTelemetry(); break;
      case 's': actions.toggleSafeZones(); break;
      case 'd': actions.toggleDemoMode(); break;
      case 'm': actions.activateSuddenDeath(); break;
      case 'b': actions.triggerMeteorShower(); break;
      case 'f': actions.simulateFollow(); break;
      case 'g': actions.simulateShare(); break;

      // Equipo A (Norte)
      case '1': actions.manualTestGift('A', 1); break;
      case '2': actions.manualTestGift('A', 2); break;
      case '3': actions.manualTestGift('A', 3); break;
      case '4': actions.manualTestGift('A', 4); break;
      case '5': actions.manualTestGift('A', 5); break;
      case 'q': actions.manualTestGift('A', 6); break;
      case 'z': actions.manualTestGift('A', 7); break;
      case 't': actions.simulateTap('A'); break;

      // Equipo B (Sur)
      case '7': actions.manualTestGift('B', 1); break;
      case '8': actions.manualTestGift('B', 2); break;
      case '9': actions.manualTestGift('B', 3); break;
      case '0': actions.manualTestGift('B', 4); break;
      case '6': actions.manualTestGift('B', 5); break;
      case 'e': actions.manualTestGift('B', 6); break;
      case 'x': actions.manualTestGift('B', 7); break;
      case 'y': actions.simulateTap('B'); break;
    }
  });
}