import { test, expect } from './fixtures.js';

// La página /populares/ está desactivada (FIESTAS_POPULAR_ENABLED) porque el
// backend de contadores todavía no existe; sus pruebas se reactivan con ella.

test('sitemap.xml lista las páginas indexables y excluye las noindex y redirecciones', async ({ page }) => {
  const res = await page.request.get('/sitemap.xml');
  expect(res.ok()).toBe(true);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  expect(locs.length).toBeGreaterThan(10);
  expect(locs).toContain('https://fiestas.arandadeduero.dev/');
  expect(locs.some((loc) => /\/e\/\d+\//.test(loc))).toBe(true);
  expect(locs.some((loc) => loc.endsWith('/planes/'))).toBe(true);

  // Nada de páginas noindex ni de utilidad en el sitemap.
  for (const loc of locs) {
    expect(loc).not.toMatch(/\/plan\/(importar\/)?$/);
    expect(loc).not.toMatch(/\/qr\/$/);
  }

  const robots = await (await page.request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap: https://fiestas.arandadeduero.dev/sitemap.xml');
});

test('el catálogo de planes vecinales renderiza y sus fichas abren', async ({ page }) => {
  const planDataRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/data/community-plans/')) planDataRequests.push(url.pathname);
  });
  await page.goto('/planes/');
  await expect(page.locator('[data-community-plans-page]')).toBeVisible();

  const firstPlan = page.locator('a[href^="/planes/"]').first();
  await expect(firstPlan).toBeVisible();
  await expect(page.locator('.fiestas-community-plan-card-meta').first()).not.toBeEmpty();
  expect(planDataRequests).toEqual([]);
  const href = await firstPlan.getAttribute('href');

  await page.goto(href);
  await expect(page.locator('h1')).not.toBeEmpty();
});

test('los planes vecinales pliegan las actividades finalizadas', async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalDate = Date;
    const fixedNow = OriginalDate.parse('2026-09-16T12:00:00+02:00');
    class TestDate extends OriginalDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow]));
      }

      static now() {
        return fixedNow;
      }
    }
    window.Date = TestDate;
  });
  await page.goto('/planes/de-tardeo-en-tardeo/');

  const finishedToggle = page.locator('[data-plan-finished-toggle]');
  const finishedList = page.locator('[data-plan-finished-list]');
  const pastGroup = page.locator('[data-plan-day-group="2026-09-13"]');
  await expect(finishedToggle).toHaveCount(1);
  await expect(finishedToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(finishedList).toBeHidden();
  await expect(pastGroup).toBeHidden();

  await finishedToggle.click();
  await expect(finishedToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(finishedList).toBeVisible();
  await expect(pastGroup).toBeVisible();
});

test('mi plan renderiza vacío sin errores', async ({ page }) => {
  await page.goto('/plan/');
  await expect(page.locator('[data-fiestas-plans-page]')).toBeVisible();
});
