const CONFIG_KEY = '__FIESTAS_ANALYTICS_CONFIG__';
const INITIALIZED_KEY = '__FIESTAS_ANALYTICS_INITIALIZED__';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const DEFAULT_MEASUREMENT_ID = 'G-BXMC22W46S';
const CONSENT_STORAGE_KEY = 'fiestasAranda:analytics-consent';
const CONSENT_GRANTED = 'granted';
const CONSENT_DENIED = 'denied';
const TRACKED_FAVORITES_STORAGE_KEY = 'fiestasAranda:analytics:saved-activities';
const TRACKED_CASETA_FAVORITES_STORAGE_KEY = 'fiestasAranda:analytics:saved-casetas';
const TRACKED_CASETA_DISH_LIKES_STORAGE_KEY = 'fiestasAranda:analytics:liked-caseta-dishes';
const TRACKED_COMMUNITY_PLANS_STORAGE_KEY = 'fiestasAranda:analytics:added-community-plans';

const categoryActions = {
  activity: new Set(['view_detail', 'save', 'remove_save', 'share', 'open_directions', 'open_external_link', 'open_tickets']),
  caseta: new Set(['save', 'remove_save', 'open_qr', 'download_qr']),
  caseta_dish: new Set(['like', 'remove_like']),
  agenda: new Set(['select_date', 'select_all_dates', 'apply_filter', 'search', 'open_activity']),
  map: new Set(['open', 'select_marker', 'select_date', 'select_all_dates', 'apply_filter']),
  plan: new Set(['create', 'add_activity', 'remove_activity', 'add_to_calendar', 'add_community', 'export', 'import', 'share', 'import_error']),
  pwa: new Set(['install_clicked', 'install_accepted', 'install_cancelled', 'installed', 'ios_help_opened', 'sw_registration_error']),
  community_prompt: new Set(['view', 'click', 'dismiss'])
};

const COMMUNITY_PROMPT_CHANNELS = new Set(['chat', 'whatsapp', 'newsletter', 'instagram', 'facebook']);
const COMMUNITY_PROMPT_DISMISS_REASONS = new Set(['snooze_5d', 'never_again']);

const filterNames = new Set(['type', 'area', 'ticket']);
let gaLoaded = false;
let measurementId = '';
let analyticsEnabled = false;
const trackedFavoriteIds = new Set();
const trackedCasetaFavoriteIds = new Set();
const trackedCasetaDishLikeIds = new Set();
const trackedCommunityPlanIds = new Set();

// Google Analytics con consentimiento explícito (GDPR): el script de GA no se
// descarga ni envía nada hasta que la persona pulsa "Aceptar" en el aviso.
export function initAnalytics() {
  if (typeof window === 'undefined' || window[INITIALIZED_KEY]) return;
  window[INITIALIZED_KEY] = true;

  const config = getConfig();
  measurementId = config.measurementId;
  analyticsEnabled = config.enabled && Boolean(measurementId) && !isDoNotTrackEnabled();

  if (analyticsEnabled && getAnalyticsConsent() === CONSENT_GRANTED) {
    loadGa();
  }
  setupConsentBanner();
}

// Estado guardado: 'granted' | 'denied' | '' (sin decidir).
export function getAnalyticsConsent() {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === CONSENT_GRANTED || value === CONSENT_DENIED ? value : '';
  } catch (_) {
    return '';
  }
}

export function grantAnalyticsConsent() {
  persistConsent(CONSENT_GRANTED);
  if (analyticsEnabled) loadGa();
  hideConsentBanner();
}

export function denyAnalyticsConsent() {
  persistConsent(CONSENT_DENIED);
  hideConsentBanner();
}

function persistConsent(value) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch (_) {
    // Sin localStorage el aviso se volverá a mostrar; nunca cargamos GA sin "Aceptar".
  }
}

function loadGa() {
  if (gaLoaded || !measurementId || typeof document === 'undefined') return;
  gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { anonymize_ip: true });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.fiestasGaLoader = 'true';
  script.addEventListener('error', () => { gaLoaded = false; }, { once: true });
  document.head.append(script);
}

function setupConsentBanner() {
  if (typeof document === 'undefined') return;
  const banner = document.querySelector('[data-analytics-consent]');
  if (!banner) return;

  const shouldAsk = analyticsEnabled && !getAnalyticsConsent();
  banner.hidden = !shouldAsk;
  if (!shouldAsk) return;

  banner.querySelector('[data-analytics-consent-accept]')?.addEventListener('click', () => {
    grantAnalyticsConsent();
  }, { once: true });
  banner.querySelector('[data-analytics-consent-deny]')?.addEventListener('click', () => {
    denyAnalyticsConsent();
  }, { once: true });
}

function hideConsentBanner() {
  document.querySelector('[data-analytics-consent]')?.setAttribute('hidden', '');
}

export function trackActivityViewed(activityId) {
  return pushEvent('activity', 'view_detail', activityId);
}

export function trackActivityOpened(activityId) {
  return pushEvent('agenda', 'open_activity', activityId);
}

export function trackFavoriteChanged(activityId, saved) {
  try {
    const normalizedActivityId = normalizeToken(activityId);
    if (saved && (!normalizedActivityId || hasTrackedFavorite(normalizedActivityId))) return false;

    const tracked = pushEvent('activity', saved ? 'save' : 'remove_save', normalizedActivityId);
    if (saved && tracked) rememberTrackedFavorite(normalizedActivityId);
    return tracked;
  } catch (_) {
    // Analytics must never prevent the local favorite from being saved.
    return false;
  }
}

export function trackCasetaFavoriteChanged(casetaId, saved) {
  try {
    const normalizedCasetaId = normalizeCasetaId(casetaId);
    if (!normalizedCasetaId || (saved && hasTrackedCasetaFavorite(normalizedCasetaId))) return false;

    const tracked = pushEvent('caseta', saved ? 'save' : 'remove_save', normalizedCasetaId);
    if (saved && tracked) rememberTrackedCasetaFavorite(normalizedCasetaId);
    return tracked;
  } catch (_) {
    // Analytics must never prevent the local caseta favorite from being saved.
    return false;
  }
}

export function trackCasetaQrOpened(casetaId) {
  return pushEvent('caseta', 'open_qr', normalizeCasetaId(casetaId));
}

export function trackCasetaQrDownloaded(casetaId) {
  return pushEvent('caseta', 'download_qr', normalizeCasetaId(casetaId));
}

export function trackCasetaDishLiked(casetaId, dishId) {
  try {
    const eventName = normalizeCasetaDishEventName(casetaId, dishId);
    if (!eventName || hasTrackedCasetaDishLike(eventName)) return false;

    const tracked = pushEvent('caseta_dish', 'like', eventName);
    if (tracked) rememberTrackedCasetaDishLike(eventName);
    return tracked;
  } catch (_) {
    // Analytics must never prevent the local dish reaction from being saved.
    return false;
  }
}

export function trackCasetaDishUnliked(casetaId, dishId) {
  try {
    const eventName = normalizeCasetaDishEventName(casetaId, dishId);
    if (!eventName) return false;
    return pushEvent('caseta_dish', 'remove_like', eventName);
  } catch (_) {
    // Analytics must never prevent the local dish reaction from being removed.
    return false;
  }
}

export function trackActivityShared(activityId) {
  return pushEvent('activity', 'share', activityId);
}

export function trackDateSelected(date, view = 'agenda') {
  const category = view === 'map' ? 'map' : 'agenda';
  return pushEvent(category, date === 'all' ? 'select_all_dates' : 'select_date', date);
}

export function trackFilterApplied(filterName, filterValue, view = 'agenda') {
  if (!filterNames.has(filterName)) return false;
  const category = view === 'map' ? 'map' : 'agenda';
  return pushEvent(category, 'apply_filter', filterName, normalizeToken(filterValue));
}

export function trackSearchResults(resultCount) {
  const count = Number.isFinite(resultCount) && resultCount >= 0 ? Math.round(resultCount) : 0;
  return pushEvent('agenda', 'search', count > 0 ? 'with_results' : 'without_results', count);
}

export function trackMapOpened() {
  return pushEvent('map', 'open', 'map');
}

export function trackMapMarkerSelected(activityId) {
  return pushEvent('map', 'select_marker', activityId);
}

export function trackDirectionsOpened(activityId) {
  return pushEvent('activity', 'open_directions', activityId);
}

export function trackTicketsOpened(activityId) {
  return pushEvent('activity', 'open_tickets', activityId);
}

export function trackExternalLinkOpened(linkType) {
  return pushEvent('activity', 'open_external_link', linkType);
}

export function trackPlanCreated(planType = 'manual') {
  return pushEvent('plan', 'create', planType);
}

export function trackCommunityPlanAdded(planId) {
  try {
    const normalizedPlanId = normalizeToken(planId);
    if (!normalizedPlanId || hasTrackedCommunityPlan(normalizedPlanId)) return false;

    const tracked = pushEvent('plan', 'add_community', normalizedPlanId);
    if (tracked) rememberTrackedCommunityPlan(normalizedPlanId);
    return tracked;
  } catch (_) {
    // Analytics must never prevent the local plan from being saved.
    return false;
  }
}

export function trackPlanActivityAdded(activityId) {
  return pushEvent('plan', 'add_activity', activityId);
}

export function trackPlanActivityRemoved(activityId) {
  return pushEvent('plan', 'remove_activity', activityId);
}

export function trackPlanCalendarExported(activityId = 'plan') {
  return pushEvent('plan', 'add_to_calendar', activityId);
}

export function trackPlanExported(planType = 'file') {
  return pushEvent('plan', 'export', planType);
}

export function trackPlanImported(planType = 'file') {
  return pushEvent('plan', 'import', planType);
}

export function trackPlanShared(planType = 'file') {
  return pushEvent('plan', 'share', planType);
}

export function trackPlanImportError(errorType = 'invalid') {
  return pushEvent('plan', 'import_error', errorType);
}

export function trackCommunityPromptViewed(iteration) {
  const normalizedIteration = normalizeCommunityPromptIteration(iteration);
  if (!normalizedIteration) return false;
  return pushEvent('community_prompt', 'view', 'shown', normalizedIteration);
}

export function trackCommunityPromptClicked(channel, iteration) {
  const normalizedChannel = normalizeToken(channel);
  const normalizedIteration = normalizeCommunityPromptIteration(iteration);
  if (!COMMUNITY_PROMPT_CHANNELS.has(normalizedChannel) || !normalizedIteration) return false;
  return pushEvent('community_prompt', 'click', normalizedChannel, normalizedIteration);
}

export function trackCommunityPromptDismissed(reason, iteration) {
  const normalizedReason = normalizeToken(reason);
  const normalizedIteration = normalizeCommunityPromptIteration(iteration);
  if (!COMMUNITY_PROMPT_DISMISS_REASONS.has(normalizedReason) || !normalizedIteration) return false;
  return pushEvent('community_prompt', 'dismiss', normalizedReason, normalizedIteration);
}

export function trackPwaInstallClicked(source = 'install') {
  return pushEvent('pwa', 'install_clicked', 'install', source);
}

export function trackPwaInstallAccepted(source = 'install') {
  return pushEvent('pwa', 'install_accepted', 'install', source);
}

export function trackPwaInstallCancelled(source = 'install') {
  return pushEvent('pwa', 'install_cancelled', 'install', source);
}

export function trackPwaInstalled(source = 'install') {
  return pushEvent('pwa', 'installed', 'install', source);
}

export function trackPwaIosHelpOpened() {
  return pushEvent('pwa', 'ios_help_opened', 'ios');
}

export function trackPwaServiceWorkerError() {
  return pushEvent('pwa', 'sw_registration_error', 'register');
}

function getConfig() {
  const configured = window[CONFIG_KEY] && typeof window[CONFIG_KEY] === 'object'
    ? window[CONFIG_KEY]
    : {};
  const hostname = window.location?.hostname || '';
  const configuredEnabled = configured.enabled;
  const enabled = typeof configuredEnabled === 'boolean'
    ? configuredEnabled
    : !LOCAL_HOSTS.has(hostname);
  const rawMeasurementId = String(configured.measurementId || DEFAULT_MEASUREMENT_ID).trim();
  const measurementId = /^G-[A-Z0-9]+$/.test(rawMeasurementId) ? rawMeasurementId : '';
  return { enabled, measurementId };
}

function isDoNotTrackEnabled() {
  return window.navigator?.doNotTrack === '1' || window.doNotTrack === '1';
}

function pushEvent(category, action, name, value) {
  if (!categoryActions[category]?.has(action)) return false;
  const normalizedName = normalizeToken(name);
  if (!normalizedName) return false;
  publishEngagement({ category, action, name: normalizedName, value });
  if (!gaLoaded || typeof window.gtag !== 'function') return false;
  const params = { event_category: category, event_label: normalizedName };
  if (typeof value === 'number' && Number.isFinite(value)) params.value = value;
  else if (value !== undefined) params.event_detail = String(value);
  window.gtag('event', action, params);
  return true;
}

function publishEngagement(detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof window.CustomEvent !== 'function') return;
  try {
    window.dispatchEvent(new window.CustomEvent('fiestas:engagement', { detail }));
  } catch (_) {
    // Engagement signals must never interfere with the tracked action.
  }
}

function hasTrackedFavorite(activityId) {
  if (trackedFavoriteIds.has(activityId)) return true;
  const storedIds = readTrackedFavoriteIds();
  const alreadyTracked = storedIds.includes(activityId);
  if (alreadyTracked) trackedFavoriteIds.add(activityId);
  return alreadyTracked;
}

function rememberTrackedFavorite(activityId) {
  trackedFavoriteIds.add(activityId);
  const storedIds = new Set(readTrackedFavoriteIds());
  storedIds.add(activityId);
  try {
    window.localStorage.setItem(TRACKED_FAVORITES_STORAGE_KEY, JSON.stringify([...storedIds]));
  } catch (_) {
    // An unavailable localStorage still deduplicates saves for this page load.
  }
}

function hasTrackedCasetaFavorite(casetaId) {
  if (trackedCasetaFavoriteIds.has(casetaId)) return true;
  const storedIds = readTrackedCasetaFavoriteIds();
  const alreadyTracked = storedIds.includes(casetaId);
  if (alreadyTracked) trackedCasetaFavoriteIds.add(casetaId);
  return alreadyTracked;
}

function rememberTrackedCasetaFavorite(casetaId) {
  trackedCasetaFavoriteIds.add(casetaId);
  const storedIds = new Set(readTrackedCasetaFavoriteIds());
  storedIds.add(casetaId);
  try {
    window.localStorage.setItem(TRACKED_CASETA_FAVORITES_STORAGE_KEY, JSON.stringify([...storedIds]));
  } catch (_) {
    // An unavailable localStorage still deduplicates saves for this page load.
  }
}

function hasTrackedCasetaDishLike(eventName) {
  if (trackedCasetaDishLikeIds.has(eventName)) return true;
  const storedIds = readTrackedCasetaDishLikes();
  const alreadyTracked = storedIds.includes(eventName);
  if (alreadyTracked) trackedCasetaDishLikeIds.add(eventName);
  return alreadyTracked;
}

function rememberTrackedCasetaDishLike(eventName) {
  trackedCasetaDishLikeIds.add(eventName);
  const storedIds = new Set(readTrackedCasetaDishLikes());
  storedIds.add(eventName);
  try {
    window.localStorage.setItem(TRACKED_CASETA_DISH_LIKES_STORAGE_KEY, JSON.stringify([...storedIds]));
  } catch (_) {
    // An unavailable localStorage still deduplicates likes for this page load.
  }
}

function readTrackedFavoriteIds() {
  try {
    const value = JSON.parse(window.localStorage.getItem(TRACKED_FAVORITES_STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(normalizeToken).filter(Boolean))];
  } catch (_) {
    return [];
  }
}

function readTrackedCasetaFavoriteIds() {
  try {
    const value = JSON.parse(window.localStorage.getItem(TRACKED_CASETA_FAVORITES_STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(normalizeCasetaId).filter(Boolean))];
  } catch (_) {
    return [];
  }
}

function readTrackedCasetaDishLikes() {
  try {
    const value = JSON.parse(window.localStorage.getItem(TRACKED_CASETA_DISH_LIKES_STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((id) => String(id || '').trim()).filter(isCasetaDishEventName))];
  } catch (_) {
    return [];
  }
}

function hasTrackedCommunityPlan(planId) {
  if (trackedCommunityPlanIds.has(planId)) return true;
  const storedIds = readTrackedCommunityPlanIds();
  const alreadyTracked = storedIds.includes(planId);
  if (alreadyTracked) trackedCommunityPlanIds.add(planId);
  return alreadyTracked;
}

function rememberTrackedCommunityPlan(planId) {
  trackedCommunityPlanIds.add(planId);
  const storedIds = new Set(readTrackedCommunityPlanIds());
  storedIds.add(planId);
  try {
    window.localStorage.setItem(TRACKED_COMMUNITY_PLANS_STORAGE_KEY, JSON.stringify([...storedIds]));
  } catch (_) {
    // An unavailable localStorage still deduplicates additions for this page load.
  }
}

function readTrackedCommunityPlanIds() {
  try {
    const value = JSON.parse(window.localStorage.getItem(TRACKED_COMMUNITY_PLANS_STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(normalizeToken).filter(Boolean))];
  } catch (_) {
    return [];
  }
}

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function normalizeCommunityPromptIteration(value) {
  const iteration = Number(value);
  return Number.isInteger(iteration) && iteration >= 1 && iteration <= 2 ? iteration : 0;
}

function normalizeCasetaId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^z[1-7]-[0-9]+$/.test(normalized) ? normalized : '';
}

function normalizeCasetaDishEventName(casetaId, dishId) {
  const normalizedCasetaId = normalizeCasetaId(casetaId);
  const normalizedDishId = String(dishId || '').trim().toLowerCase();
  if (!normalizedCasetaId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedDishId)) return '';
  const eventName = normalizeToken(`${normalizedCasetaId}_${normalizedDishId}`);
  return isCasetaDishEventName(eventName) ? eventName : '';
}

function isCasetaDishEventName(value) {
  return /^z[1-7]_[0-9]+_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(String(value || ''));
}

initAnalytics();
