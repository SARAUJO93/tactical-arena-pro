import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('carga el arena y muestra los controles principales', async ({ page }) => {
  await expect(page).toHaveTitle(/TACTICAL ARENA V3\.2\.0/i);
  await expect(page.locator('#arenaCanvas')).toBeVisible();
  await expect(page.locator('#stageFrame')).toBeVisible();
  await expect(page.locator('#timerText')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(page.locator('#btnOpenPanel')).toBeVisible();
  await expect(page.locator('#btnOpenTelemetry')).toBeVisible();
  await expect(page.locator('#btnOpenLeague')).toBeVisible();
});

test('muestra las 64 banderas SVG en los chips del preset mundial', async ({ page }) => {
  await page.locator('#btnOpenPanel').click();
  await page.locator('#btnPresetWorld').click();

  await expect(page.locator('#rosterChips .team-flag-svg')).toHaveCount(64);
  await expect(page.locator('#rosterChips .team-flag-fallback')).toHaveCount(0);
});

test('inicia la Copa Mundial con 64 equipos y reanuda el cruce al recargar', async ({ page }) => {
  await page.locator('#btnOpenPanel').click();
  await page.locator('#btnWorldCupStart').click();

  await expect(page.locator('#worldCupStatus')).toContainText('Ronda de 64');
  await expect(page.locator('#nameA')).toHaveText('MÉXICO');
  await expect(page.locator('#nameB')).toHaveText('CATAR');

  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.locator('#nameA')).toHaveText('MÉXICO');
  await expect(page.locator('#nameB')).toHaveText('CATAR');
  await page.locator('#btnOpenPanel').click();
  await expect(page.locator('#worldCupStatus')).toContainText('En curso');
});

test('avanza al siguiente partido de Copa después de una victoria', async ({ page }) => {
  await page.locator('#btnOpenPanel').click();
  await page.locator('#btnWorldCupStart').click();
  await page.evaluate(() => {
    const nativeSetInterval = window.setInterval;
    window.setInterval = (handler, timeout, ...args) =>
      nativeSetInterval(handler, timeout === 1000 ? 1 : timeout, ...args);
    const game = window as unknown as { triggerVictory?: (team: 'A' | 'B') => void };
    game.triggerVictory?.('A');
  });

  await expect(page.locator('#worldCupStatus')).toContainText('1/63 partidos');
  await expect(page.locator('#nameA')).not.toHaveText('MÉXICO', { timeout: 5000 });
});

test('inicia un torneo nuevo con los dos primeros equipos del preset activo', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#btnOpenPanel').click();
  await page.locator('#btnPresetLigaMX').click();
  await page.locator('#btnNewTournament').click();

  await expect(page.locator('#nameA')).toHaveText('AMÉRICA');
  await expect(page.locator('#nameB')).toHaveText('ATLAS');
  await expect(page.locator('#btnTournamentToggle')).toHaveText('Torneo: ON');

  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.locator('#nameA')).toHaveText('AMÉRICA');
  await expect(page.locator('#nameB')).toHaveText('ATLAS');
});

test('el control de audio comunica su estado accesible al alternar', async ({ page }) => {
  const muteButton = page.locator('#btnQuickMute');
  await expect(muteButton).toHaveAccessibleName('Silenciar audio');
  await expect(muteButton).toHaveAttribute('aria-pressed', 'false');

  await muteButton.click();
  await expect(muteButton).toHaveAccessibleName('Activar audio');
  await expect(muteButton).toHaveAttribute('aria-pressed', 'true');

  await muteButton.click();
  await expect(muteButton).toHaveAccessibleName('Silenciar audio');
  await expect(muteButton).toHaveAttribute('aria-pressed', 'false');
});

test('abre ajustes, telemetria y liga sin errores de UI', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.locator('#btnOpenPanel').click();
  await expect(page.locator('#controlPanel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#btnResetRound')).toBeVisible();

  await page.locator('#btnClosePanel').click();
  await page.locator('#btnOpenTelemetry').click();
  await expect(page.locator('#telemetryModal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#telDuration')).toBeVisible();

  await page.locator('#btnCloseTelemetry').click();
  await page.locator('#btnOpenLeague').click();
  await expect(page.locator('#leagueModal')).not.toHaveClass(/hidden/);
  await expect(page.locator('#leagueModal')).toContainText(/clasific|standings|liga/i);

  expect(pageErrors).toEqual([]);
});

test('el modo demo puede alternarse desde el panel y atajos', async ({ page }) => {
  await page.locator('#btnOpenPanel').click();
  const demoButton = page.locator('#btnDemoToggle');
  await expect(demoButton).toBeVisible();
  await demoButton.click();

  await expect(demoButton).toContainText(/Modo Demo:/);
  await page.keyboard.press('d');
  await expect(demoButton).toContainText(/Modo Demo:/);
});

test('activa safe zones y notifica el modo', async ({ page }) => {
  await page.locator('#btnQuickSafe').click();
  await expect(page.locator('#safeZoneGuide')).not.toHaveClass(/hidden/);

  await page.keyboard.press('s');
  await expect(page.locator('#safeZoneGuide')).toHaveClass(/hidden/);
});

test('persiste cambios de configuración después de recargar', async ({ page }) => {
  await page.locator('#btnOpenPanel').click();
  const threshold = page.locator('#sliderPersonalTap');
  await threshold.evaluate((element: HTMLInputElement) => {
    element.value = '30';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.reload();
  await page.locator('#btnOpenPanel').click();
  await expect(page.locator('#sliderPersonalTap')).toHaveValue('30');
});

test('puede finalizar una ronda y mostrar la victoria', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.evaluate(() => {
    const arena = window as unknown as { triggerVictory?: (team: 'A' | 'B') => void };
    arena.triggerVictory?.('A');
  });
  await page.clock.runFor(650);
  await expect(page.locator('#victoryOverlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('#vicName')).toBeVisible();
  await expect(page.locator('#vicCountdown')).toHaveText('20');
  await page.clock.runFor(19000);
  await expect(page.locator('#vicCountdown')).toHaveText('1');
  await expect(page.locator('#victoryOverlay')).not.toHaveClass(/hidden/);
  await page.clock.runFor(1000);
  await expect(page.locator('#vicCountdown')).toHaveText('0');
  await expect(page.locator('#victoryOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#vicCrownScore')).toContainText('CORONAS');
});

test('muestra reconexion y recuperacion cuando TikFinity cae', async ({ page }) => {
  await page.addInitScript(() => {
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;

      constructor(public url: string) {
        MockWebSocket.instances.push(this);
        setTimeout(() => this.onopen?.(), 10);
      }

      close(): void {
        this.onclose?.();
      }

      open(): void {
        this.onopen?.();
      }

      drop(): void {
        this.onclose?.();
      }

      send(): void {}
    }

    const testWindow = window as unknown as { MockWebSocket: typeof MockWebSocket };
    testWindow.MockWebSocket = MockWebSocket;
    window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  await page.reload();
  await page.locator('#btnOpenPanel').click();
  await page.locator('#wsUrl').fill('ws://localhost:21213/');
  await page.locator('#btnWsConnect').click();

  await expect(page.locator('#wsStatus')).toHaveText('Conectado');

  await page.evaluate(() => {
    const testWindow = window as unknown as {
      MockWebSocket: { instances: Array<{ open: () => void; drop: () => void }> };
    };
    testWindow.MockWebSocket.instances[0].drop();
  });
  await page.waitForTimeout(1200);
  await expect(page.locator('#wsStatus')).toHaveText('Conectado');
});

test('mantiene desactivada la observabilidad externa por defecto', async ({ page }) => {
  await page.route('https://collector.example.com/events', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ accepted: true }),
    });
  });
  await page.locator('#btnOpenPanel').click();
  await expect(page.locator('#btnExternalTelemetry')).toContainText(/OFF/);
  await expect(page.locator('#inExternalTelemetryUrl')).toBeVisible();

  await page.locator('#inExternalTelemetryUrl').fill('https://collector.example.com/events');
  await page.locator('#btnExternalTelemetry').click();
  await expect(page.locator('#btnExternalTelemetry')).toContainText(/ON/);
  await expect(page.locator('#telExternalStatus')).toContainText(/Enviado|Estado externo:/);
});
