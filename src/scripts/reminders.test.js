import assert from 'node:assert/strict';
import test from 'node:test';

const OPTIN_KEY = 'fiestasAranda:reminders-optin';

function installGlobals({ permission = 'default', requestResult = 'granted' } = {}) {
  const store = new Map();
  globalThis.window = {
    location: { href: 'https://fiestas.arandadeduero.dev/', origin: 'https://fiestas.arandadeduero.dev' },
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    Notification: class {
      static permission = permission;
      static requestPermission = async () => requestResult;
    },
    dispatchEvent: () => {},
    addEventListener: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    CustomEvent: class { constructor(t, i = {}) { this.type = t; this.detail = i.detail; } },
    focus: () => {}
  };
  globalThis.document = { querySelector: () => null, addEventListener: () => {}, hidden: false };
  Object.defineProperty(globalThis, 'navigator', {
    value: { serviceWorker: { ready: new Promise(() => {}) } },
    configurable: true
  });
  return store;
}

test('sin API de Notification, los avisos no están soportados', async () => {
  installGlobals();
  delete window.Notification;
  const mod = await import(`./reminders.js?a=${Date.now()}`);
  assert.equal(mod.remindersSupported(), false);
  assert.equal(mod.remindersState(), 'unsupported');
});

test('estado por defecto: soportado pero desactivado', async () => {
  installGlobals({ permission: 'default' });
  const mod = await import(`./reminders.js?b=${Date.now()}`);
  assert.equal(mod.remindersSupported(), true);
  assert.equal(mod.remindersState(), 'off');
});

test('activar pide permiso, lo concede y guarda la preferencia', async () => {
  const store = installGlobals({ permission: 'default', requestResult: 'granted' });
  const mod = await import(`./reminders.js?c=${Date.now()}`);
  // requestPermission concede pero Notification.permission sigue 'default' en el mock:
  window.Notification.permission = 'default';
  const originalRequest = window.Notification.requestPermission;
  window.Notification.requestPermission = async () => { window.Notification.permission = 'granted'; return 'granted'; };
  assert.equal(await mod.enableReminders(), 'on');
  assert.equal(store.get(OPTIN_KEY), 'true');
  assert.equal(mod.remindersState(), 'on');
  window.Notification.requestPermission = originalRequest;
});

test('si el permiso se deniega, el estado es "denied" y no se guarda opt-in', async () => {
  const store = installGlobals({ permission: 'default' });
  const mod = await import(`./reminders.js?d=${Date.now()}`);
  window.Notification.requestPermission = async () => { window.Notification.permission = 'denied'; return 'denied'; };
  assert.equal(await mod.enableReminders(), 'denied');
  assert.equal(store.get(OPTIN_KEY), undefined);
  assert.equal(mod.remindersState(), 'denied');
});

test('desactivar borra la preferencia', async () => {
  const store = installGlobals({ permission: 'granted' });
  store.set(OPTIN_KEY, 'true');
  const mod = await import(`./reminders.js?e=${Date.now()}`);
  assert.equal(mod.remindersState(), 'on');
  mod.disableReminders();
  assert.equal(store.get(OPTIN_KEY), 'false');
  assert.equal(mod.remindersState(), 'off');
});
