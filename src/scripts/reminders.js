// Avisos locales para actividades marcadas como favoritas: una notificación
// ~15 min antes de que empiecen. Requiere consentimiento explícito de
// notificaciones. Solo funciona mientras la web/PWA está abierta o en segundo
// plano reciente (los `setTimeout` de la página no sobreviven al cierre total
// del navegador). El recordatorio fiable con el móvil bloqueado es el del
// calendario del sistema (VALARM en el .ics de "Añadir al calendario").
import { readFavoriteIds } from './plan-storage.js';
import { loadEvents } from './events-data.js';

const OPTIN_KEY = 'fiestasAranda:reminders-optin';
const FIRED_KEY = 'fiestasAranda:reminders-fired';
const LEAD_MINUTES = 15;
const LEAD_MS = LEAD_MINUTES * 60 * 1000;
const HORIZON_MS = 26 * 60 * 60 * 1000;      // solo se programan avisos de las próximas ~26 h
const MAX_DELAY = 2 ** 31 - 1;
const CHANGED_EVENT = 'fiestas:reminders-changed';

let events = [];
const timers = new Map();

export function remindersSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && typeof window.localStorage !== 'undefined';
}

// 'unsupported' | 'denied' | 'on' | 'off'
export function remindersState() {
  if (!remindersSupported()) return 'unsupported';
  if (window.Notification.permission === 'denied') return 'denied';
  return window.Notification.permission === 'granted' && optedIn() ? 'on' : 'off';
}

function optedIn() {
  try {
    return window.localStorage.getItem(OPTIN_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

export async function enableReminders() {
  if (!remindersSupported()) return 'unsupported';
  let permission = window.Notification.permission;
  if (permission === 'default') {
    try {
      permission = await window.Notification.requestPermission();
    } catch (_) {
      permission = 'default';
    }
  }
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'dismissed';
  writeOptin(true);
  scheduleAll();
  emitChanged();
  return 'on';
}

export function disableReminders() {
  writeOptin(false);
  clearTimers();
  emitChanged();
}

function writeOptin(value) {
  try {
    window.localStorage.setItem(OPTIN_KEY, value ? 'true' : 'false');
  } catch (_) {
    // Sin localStorage el aviso no se recuerda entre cargas; nunca se activa solo.
  }
}

function emitChanged() {
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { state: remindersState() } }));
}

// Todas las fiestas son en septiembre de 2026 (horario de verano, CEST = UTC+2).
function eventStartMs(event) {
  if (!event?.date || !event?.startTime) return NaN;
  const ms = Date.parse(`${event.date}T${event.startTime}:00+02:00`);
  return Number.isFinite(ms) ? ms : NaN;
}

function eventUrl(event) {
  if (event?.urlPath) return event.urlPath;
  const id = String(event?.id || '');
  return id && event?.slug ? `/e/${id}/${event.slug}/` : '/';
}

function readFired() {
  try {
    const value = JSON.parse(window.localStorage.getItem(FIRED_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (_) {
    return {};
  }
}

function rememberFired(id) {
  const fired = readFired();
  const now = Date.now();
  fired[id] = now;
  // Poda: quita avisos disparados hace más de una semana.
  for (const key of Object.keys(fired)) {
    if (now - Number(fired[key]) > 7 * 24 * 60 * 60 * 1000) delete fired[key];
  }
  try {
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch (_) {}
}

function clearTimers() {
  for (const id of timers.values()) window.clearTimeout(id);
  timers.clear();
}

export function scheduleAll() {
  clearTimers();
  if (remindersState() !== 'on' || !events.length) return;

  const favorites = new Set(readFavoriteIds().map(String));
  const fired = readFired();
  const now = Date.now();

  for (const event of events) {
    const id = String(event.id);
    if (!favorites.has(id) || fired[id]) continue;

    const start = eventStartMs(event);
    if (!Number.isFinite(start) || start <= now) continue;

    const fireAt = start - LEAD_MS;
    if (fireAt > now + HORIZON_MS) continue;   // demasiado lejos: se reprogramará más adelante

    const delay = Math.max(0, Math.min(fireAt - now, MAX_DELAY));
    timers.set(id, window.setTimeout(() => notify(event), delay));
  }
}

async function notify(event) {
  const id = String(event.id);
  timers.delete(id);
  if (remindersState() !== 'on') return;
  if (!readFavoriteIds().map(String).includes(id)) return;   // se quitó de favoritos entretanto

  const start = eventStartMs(event);
  if (Number.isFinite(start) && start <= Date.now()) return;  // ya ha empezado
  rememberFired(id);

  const minutesLeft = Number.isFinite(start)
    ? Math.max(1, Math.round((start - Date.now()) / 60000))
    : LEAD_MINUTES;
  const bodyParts = [`Empieza en ${minutesLeft} min`];
  if (event.startTime) bodyParts.push(event.startTime);
  if (event.location || event.zone) bodyParts.push(event.location || event.zone);

  const title = event.title || 'Actividad de las fiestas';
  const options = {
    body: bodyParts.join(' · '),
    tag: `fiesta-reminder-${id}`,
    icon: '/assets/favicon-128.png',
    badge: '/assets/favicon-128.png',
    lang: 'es',
    data: { url: eventUrl(event) }
  };

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
  } catch (_) {
    try {
      const notification = new window.Notification(title, options);
      notification.addEventListener('click', () => {
        window.focus();
        window.location.href = options.data.url;
        notification.close();
      });
    } catch (__) {
      // Sin permiso o sin soporte: no hay aviso, pero la actividad sigue en favoritos.
    }
  }
}

function bindToggle() {
  const button = document.querySelector('[data-reminders-toggle]');
  if (!button) return;

  const render = () => {
    const state = remindersState();
    if (state === 'unsupported') {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    const label = button.querySelector('[data-reminders-toggle-label]');
    const icon = button.querySelector('i');
    button.disabled = state === 'denied';
    if (state === 'on') {
      button.setAttribute('aria-pressed', 'true');
      if (label) label.textContent = 'Avisos de favoritos activados';
      if (icon) icon.className = 'menu-drawer-link-icon fa-solid fa-bell';
    } else if (state === 'denied') {
      button.setAttribute('aria-pressed', 'false');
      if (label) label.textContent = 'Avisos bloqueados en el navegador';
      if (icon) icon.className = 'menu-drawer-link-icon fa-solid fa-bell-slash';
    } else {
      button.setAttribute('aria-pressed', 'false');
      if (label) label.textContent = 'Avisarme 15 min antes de mis favoritos';
      if (icon) icon.className = 'menu-drawer-link-icon fa-regular fa-bell';
    }
  };

  button.addEventListener('click', async () => {
    const state = remindersState();
    if (state === 'denied') return;
    if (state === 'on') disableReminders();
    else await enableReminders();
    render();
  });

  window.addEventListener(CHANGED_EVENT, render);
  render();
}

export function setupReminders() {
  if (typeof window === 'undefined') return;
  bindToggle();
  if (!remindersSupported()) return;

  loadEvents()
    .then((data) => {
      events = Array.isArray(data) ? data : [];
      scheduleAll();
    })
    .catch(() => {});

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleAll();
  });
  window.addEventListener('focus', () => scheduleAll());
  window.addEventListener(CHANGED_EVENT, () => scheduleAll());
  // La señal fiable de que cambian los favoritos es fiestas:engagement.
  window.addEventListener('fiestas:engagement', (event) => {
    const detail = event.detail || {};
    if (detail.category === 'activity' && (detail.action === 'save' || detail.action === 'remove_save')) {
      scheduleAll();
    }
  });
}

setupReminders();
