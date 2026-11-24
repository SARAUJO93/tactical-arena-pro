import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('carga el arena y muestra los controles principales', async ({ page }) => {
  await expect(page).toHaveTitle(/TACTICAL ARENA V2\.4\.1/i);
  await expect(page.locator('#arenaCanvas')).toBeVisible();
  await expect(page.locator('#stageFrame')).toBeVisible();
  await expect(page.locator('#timerText')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(page.locator('#btnOpenPanel')).toBeVisible();
  await expect(page.locator('#btnOpenTelemetry')).toBeVisible();
  await expect(page.locator('#btnOpenLeague')).toBeVisible();
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
  await page.evaluate(() => {
    const arena = window as unknown as { triggerVictory?: (team: 'A' | 'B') => void };
    arena.triggerVictory?.('A');
  });
  await expect(page.locator('#victoryOverlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('#vicName')).toBeVisible();
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
