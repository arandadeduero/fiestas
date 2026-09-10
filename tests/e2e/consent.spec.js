import { test, expect } from './fixtures.js';

// El script de Google Analytics no puede cargarse ni enviar datos hasta que la
// persona pulsa «Aceptar». La suite fuerza analytics activada (en 127.0.0.1
// estaría desactivada) bloqueando la config para que layout.njk no la pise.
async function forceAnalyticsEnabled(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__FIESTAS_ANALYTICS_CONFIG__', {
      value: { enabled: true, measurementId: 'G-BXMC22W46S' },
      writable: false,
      configurable: false
    });
  });
}

const gaRequested = (page) => {
  const hits = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host === 'www.googletagmanager.com' || host.endsWith('google-analytics.com')) hits.push(req.url());
  });
  return hits;
};

test('el aviso aparece y enlaza a la política de privacidad', async ({ page }) => {
  await forceAnalyticsEnabled(page);
  await page.goto('/');

  const banner = page.locator('[data-analytics-consent]');
  await expect(banner).toBeVisible();
  const policy = banner.getByRole('link', { name: /política de privacidad/i });
  await expect(policy).toHaveAttribute('href', 'https://www.arandadeduero.es/politica-privacidad/');
  await expect(banner.getByRole('button', { name: 'Aceptar' })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Denegar' })).toBeVisible();
});

test('sin aceptar no se carga Google Analytics', async ({ page }) => {
  await forceAnalyticsEnabled(page);
  const hits = gaRequested(page);
  await page.goto('/');
  await expect(page.locator('[data-analytics-consent]')).toBeVisible();
  await page.waitForTimeout(600);

  expect(hits, `no debe pedir GA antes de aceptar: ${hits.join(', ')}`).toEqual([]);
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
});

test('«Denegar» oculta el aviso y no carga GA, ni al recargar', async ({ page }) => {
  await forceAnalyticsEnabled(page);
  const hits = gaRequested(page);
  await page.goto('/');

  await page.locator('[data-analytics-consent] [data-analytics-consent-deny]').click();
  await expect(page.locator('[data-analytics-consent]')).toBeHidden();

  await page.reload();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-analytics-consent]')).toBeHidden();
  expect(hits, `denegar nunca carga GA: ${hits.join(', ')}`).toEqual([]);
  expect(await page.evaluate(() => window.localStorage.getItem('fiestasAranda:analytics-consent'))).toBe('denied');
});

test('«Aceptar» carga gtag.js y persiste la decisión', async ({ page }) => {
  await forceAnalyticsEnabled(page);
  const hits = gaRequested(page);
  await page.goto('/');

  await page.locator('[data-analytics-consent] [data-analytics-consent-accept]').click();
  await expect(page.locator('[data-analytics-consent]')).toBeHidden();

  await expect.poll(() => hits.length).toBeGreaterThan(0);
  expect(hits.some((url) => url.includes('googletagmanager.com/gtag/js?id=G-BXMC22W46S'))).toBe(true);
  expect(await page.evaluate(() => typeof window.gtag)).toBe('function');
  expect(await page.evaluate(() => window.localStorage.getItem('fiestasAranda:analytics-consent'))).toBe('granted');

  await page.reload();
  await expect(page.locator('[data-analytics-consent]')).toBeHidden();
});
