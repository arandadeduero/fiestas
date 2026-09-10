import { test, expect, loadClientEvents } from './fixtures.js';

// Flujo 13: ninguna ruta debe escupir errores de consola ni pedir algo que no
// exista. Es la red de seguridad barata que caza imports rotos, assets
// renombrados, hashes SRI mal copiados y referencias muertas en plantillas.
//
// Una ruta por test a propósito: así el fallo dice cuál se ha roto, y ninguno
// se acerca al límite de tiempo por acumular navegaciones.

// El service worker se prueba en su propio flujo; aquí estorba, porque puede
// servir respuestas cacheadas de navegaciones anteriores.
test.use({ serviceWorkers: 'block' });

const routes = [
  ['/', '[data-fiestas-card]'],
  ['/mapa/', '[data-fiestas-map]'],
  ['/plan/', '[data-fiestas-plans-page]'],
  ['/plan/importar/', '[data-plan-import-title]'],
  ['/planes/', '[data-community-plans-page]'],
  ['/colaboradores/', '[data-fiesta-collaborators-page]'],
  ['/populares/', '[data-fiestas-popular-page]']
];

function assertClean(page, route) {
  expect(page.failedResponses, `${route} · respuestas fallidas: ${page.failedResponses.join(' | ')}`).toEqual([]);
  expect(page.consoleErrors, `${route} · errores de consola: ${page.consoleErrors.join(' | ')}`).toEqual([]);
}

for (const [route, marker] of routes) {
  test(`${route} carga sin errores de consola ni respuestas fallidas`, async ({ page }) => {
    await page.goto(route);
    await page.locator(marker).first().waitFor({ state: 'attached' });
    assertClean(page, route);
  });
}

// La ficha se elige del propio catálogo: no depende de un evento concreto, así
// que cambiar el programa no rompe el test.
test('una ficha de evento carga sin errores de consola ni respuestas fallidas', async ({ page }) => {
  await page.goto('/');
  const events = await loadClientEvents(page);
  const urlPath = events[0]?.urlPath || '';
  expect(urlPath).toBeTruthy();

  await page.goto(urlPath);
  await page.locator('[data-fiestas-detail]').waitFor({ state: 'attached' });
  assertClean(page, urlPath);
});
