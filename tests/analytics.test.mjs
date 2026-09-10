import assert from 'node:assert/strict';
import test from 'node:test';

const CONSENT_STORAGE_KEY = 'fiestasAranda:analytics-consent';
const TRACKED_FAVORITES_STORAGE_KEY = 'fiestasAranda:analytics:saved-activities';
const TRACKED_CASETA_FAVORITES_STORAGE_KEY = 'fiestasAranda:analytics:saved-casetas';
const TRACKED_CASETA_DISH_LIKES_STORAGE_KEY = 'fiestasAranda:analytics:liked-caseta-dishes';
const TRACKED_COMMUNITY_PLANS_STORAGE_KEY = 'fiestasAranda:analytics:added-community-plans';

// consent: 'granted' | 'denied' | '' (sin decidir)
function installBrowserGlobals({ consent = 'granted' } = {}) {
  const values = new Map();
  if (consent) values.set(CONSENT_STORAGE_KEY, consent);
  const signals = [];

  globalThis.window = {
    location: {
      hostname: 'fiestas.arandadeduero.dev',
      href: 'https://fiestas.arandadeduero.dev/'
    },
    navigator: { doNotTrack: '0' },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    },
    dataLayer: [],
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    dispatchEvent: (event) => signals.push(event)
  };

  globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, addEventListener: () => {} }),
    head: { append: () => {} }
  };

  return { values, signals };
}

// Eventos GA enviados: [action, params].
function gaEvents() {
  return [...window.dataLayer]
    .map((args) => Array.from(args))
    .filter((args) => args[0] === 'event')
    .map((args) => [args[1], args[2]]);
}

test('envía a GA y deduplica los guardados de actividad', async () => {
  const { values } = installBrowserGlobals();
  const analytics = await import(`../src/scripts/analytics.js?test=${Date.now()}`);

  assert.equal(analytics.trackFavoriteChanged('307', true), true);
  assert.equal(analytics.trackFavoriteChanged('307', true), false);
  assert.deepEqual(gaEvents(), [['save', { event_category: 'activity', event_label: '307' }]]);
  assert.deepEqual(JSON.parse(values.get(TRACKED_FAVORITES_STORAGE_KEY)), ['307']);
});

test('carga gtag.js y lo configura solo una vez al conceder el consentimiento', async () => {
  installBrowserGlobals({ consent: '' });
  const scripts = [];
  const realCreate = document.createElement;
  document.createElement = (tag) => {
    const el = realCreate(tag);
    scripts.push(el);
    return el;
  };
  const analytics = await import(`../src/scripts/analytics.js?load=${Date.now()}`);

  // Sin consentimiento: nada de GA.
  assert.equal(analytics.trackFavoriteChanged('1', true), false);
  assert.equal(scripts.length, 0);
  assert.equal(typeof window.gtag, 'undefined');

  analytics.grantAnalyticsConsent();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-BXMC22W46S');
  const config = [...window.dataLayer].map((a) => Array.from(a)).find((a) => a[0] === 'config');
  assert.deepEqual(config, ['config', 'G-BXMC22W46S', { anonymize_ip: true }]);

  analytics.grantAnalyticsConsent();
  assert.equal(scripts.length, 1, 'no debe recargar gtag.js');
});

test('con el consentimiento denegado nunca carga GA ni envía eventos', async () => {
  installBrowserGlobals({ consent: 'denied' });
  const scripts = [];
  const realCreate = document.createElement;
  document.createElement = (tag) => { const el = realCreate(tag); scripts.push(el); return el; };
  const analytics = await import(`../src/scripts/analytics.js?denied=${Date.now()}`);

  assert.equal(analytics.trackFavoriteChanged('1', true), false);
  assert.equal(scripts.length, 0);
  assert.deepEqual(gaEvents(), []);
});

test('respeta Do Not Track aunque haya consentimiento guardado', async () => {
  installBrowserGlobals({ consent: 'granted' });
  window.navigator.doNotTrack = '1';
  const analytics = await import(`../src/scripts/analytics.js?dnt=${Date.now()}`);

  assert.equal(analytics.trackFavoriteChanged('1', true), false);
  assert.deepEqual(gaEvents(), []);
});

test('registra el id estable al añadir un plan vecinal', async () => {
  const { values } = installBrowserGlobals();
  const analytics = await import(`../src/scripts/analytics.js?community=${Date.now()}`);

  assert.equal(analytics.trackCommunityPlanAdded('grandes-conciertos'), true);
  assert.equal(analytics.trackCommunityPlanAdded('grandes-conciertos'), false);
  assert.deepEqual(gaEvents(), [['add_community', { event_category: 'plan', event_label: 'grandes_conciertos' }]]);
  assert.deepEqual(JSON.parse(values.get(TRACKED_COMMUNITY_PLANS_STORAGE_KEY)), ['grandes_conciertos']);
});

test('deduplica favoritos de caseta de forma independiente a las actividades', async () => {
  const { values } = installBrowserGlobals();
  const analytics = await import(`../src/scripts/analytics.js?caseta=${Date.now()}`);

  assert.equal(analytics.trackCasetaFavoriteChanged('Z1-05', true), true);
  assert.equal(analytics.trackCasetaFavoriteChanged('z1-05', true), false);
  assert.deepEqual(gaEvents(), [['save', { event_category: 'caseta', event_label: 'z1_05' }]]);
  assert.deepEqual(JSON.parse(values.get(TRACKED_CASETA_FAVORITES_STORAGE_KEY)), ['z1-05']);
  assert.equal(values.has(TRACKED_FAVORITES_STORAGE_KEY), false);
});

test('registra retiradas de caseta y rechaza IDs no válidos', async () => {
  installBrowserGlobals();
  const analytics = await import(`../src/scripts/analytics.js?caseta-remove=${Date.now()}`);

  assert.equal(analytics.trackCasetaFavoriteChanged('z2-07', false), true);
  assert.equal(analytics.trackCasetaFavoriteChanged('event-307', true), false);
  assert.deepEqual(gaEvents(), [['remove_save', { event_category: 'caseta', event_label: 'z2_07' }]]);
});

test('no envía eventos cuando la analítica está desactivada por configuración', async () => {
  installBrowserGlobals();
  window.__FIESTAS_ANALYTICS_CONFIG__ = { enabled: false };
  const disabled = await import(`../src/scripts/analytics.js?disabled=${Date.now()}`);
  assert.equal(disabled.trackCasetaFavoriteChanged('z1-01', true), false);
  assert.deepEqual(gaEvents(), []);
});

test('deduplica un «me gusta» por plato de caseta con nombre técnico estable', async () => {
  const { values } = installBrowserGlobals();
  const analytics = await import(`../src/scripts/analytics.js?dish=${Date.now()}`);

  assert.equal(analytics.trackCasetaDishLiked('Z2-07', 'pincho-brocheta-pollo'), true);
  assert.equal(analytics.trackCasetaDishLiked('z2-07', 'pincho-brocheta-pollo'), false);
  assert.equal(analytics.trackCasetaDishUnliked('z2-07', 'pincho-brocheta-pollo'), true);
  assert.equal(analytics.trackCasetaDishLiked('z2-07', 'pincho-brocheta-pollo-renamed'), true);
  assert.deepEqual(gaEvents(), [
    ['like', { event_category: 'caseta_dish', event_label: 'z2_07_pincho_brocheta_pollo' }],
    ['remove_like', { event_category: 'caseta_dish', event_label: 'z2_07_pincho_brocheta_pollo' }],
    ['like', { event_category: 'caseta_dish', event_label: 'z2_07_pincho_brocheta_pollo_renamed' }]
  ]);
  assert.deepEqual(JSON.parse(values.get(TRACKED_CASETA_DISH_LIKES_STORAGE_KEY)), [
    'z2_07_pincho_brocheta_pollo',
    'z2_07_pincho_brocheta_pollo_renamed'
  ]);
});

test('registra una acción explícita de instalación PWA', async () => {
  installBrowserGlobals();
  const analytics = await import(`../src/scripts/analytics.js?pwa=${Date.now()}`);

  assert.equal(analytics.trackPwaInstallClicked('menu'), true);
  assert.deepEqual(gaEvents(), [['install_clicked', { event_category: 'pwa', event_label: 'install', event_detail: 'menu' }]]);
  assert.equal('trackPwaInstallAvailable' in analytics, false);
});

test('registra vistas, clics de canal y descartes del aviso de comunidad', async () => {
  installBrowserGlobals();
  const analytics = await import(`../src/scripts/analytics.js?community-prompt=${Date.now()}`);

  assert.equal(analytics.trackCommunityPromptViewed(1), true);
  assert.equal(analytics.trackCommunityPromptClicked('facebook', 1), true);
  assert.equal(analytics.trackCommunityPromptDismissed('snooze_5d', 1), true);
  assert.equal(analytics.trackCommunityPromptDismissed('never_again', 2), true);
  assert.equal(analytics.trackCommunityPromptClicked('unknown', 1), false);
  assert.equal(analytics.trackCommunityPromptViewed(3), false);

  assert.deepEqual(gaEvents(), [
    ['view', { event_category: 'community_prompt', event_label: 'shown', value: 1 }],
    ['click', { event_category: 'community_prompt', event_label: 'facebook', value: 1 }],
    ['dismiss', { event_category: 'community_prompt', event_label: 'snooze_5d', value: 1 }],
    ['dismiss', { event_category: 'community_prompt', event_label: 'never_again', value: 2 }]
  ]);
});

test('emite señales de engagement aunque la analítica esté desactivada', async () => {
  const { signals } = installBrowserGlobals();
  window.__FIESTAS_ANALYTICS_CONFIG__ = { enabled: false };
  const analytics = await import(`../src/scripts/analytics.js?signal=${Date.now()}`);

  assert.equal(analytics.trackCommunityPromptViewed(1), false);
  assert.deepEqual(signals.map((event) => ({ type: event.type, detail: event.detail })), [{
    type: 'fiestas:engagement',
    detail: { category: 'community_prompt', action: 'view', name: 'shown', value: 1 }
  }]);
});
