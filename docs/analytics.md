# Analítica con Google Analytics 4

La web usa Google Analytics 4 con el ID de medición `G-BXMC22W46S` (configurable con
`FIESTAS_GA_MEASUREMENT_ID`). Toda la lógica está en `src/scripts/analytics.js`.

## Consentimiento (GDPR)

- Al entrar, si la analítica está activada y no hay una decisión previa, se muestra un
  aviso fijo en la parte inferior con dos botones: **Aceptar** y **Denegar**, y un enlace
  a la [política de privacidad del Ayuntamiento](https://www.arandadeduero.es/politica-privacidad/).
- **El script `gtag.js` no se descarga ni se envía ningún dato hasta pulsar «Aceptar».**
  Antes de eso no se crea `window.gtag`, ni `dataLayer` de GA, ni cookies de GA.
- La decisión se guarda en `localStorage` con la clave `fiestasAranda:analytics-consent`
  (`granted` / `denied`) y el aviso no vuelve a aparecer.
- Se respeta `navigator.doNotTrack`: con DNT activado no se carga GA aunque haya
  consentimiento guardado, y no se muestra el aviso.
- En `localhost` / `127.0.0.1` la analítica está desactivada por defecto (y por tanto no
  hay aviso). `FIESTAS_ANALYTICS_ENABLED=true|false` fuerza el comportamiento.

## Eventos

Las funciones `track*` de `analytics.js` mantienen su API. Internamente llaman a
`gtag('event', <acción>, { event_category, event_label, value?/event_detail? })`:

| Categoría | Acciones |
| --- | --- |
| `activity` | `view_detail`, `save`, `remove_save`, `share`, `open_directions`, `open_external_link`, `open_tickets` |
| `agenda` | `select_date`, `select_all_dates`, `apply_filter`, `search`, `open_activity` |
| `map` | `open`, `select_marker`, `select_date`, `select_all_dates`, `apply_filter` |
| `plan` | `create`, `add_activity`, `remove_activity`, `add_to_calendar`, `add_community`, `export`, `import`, `share`, `import_error` |
| `pwa` | `install_clicked`, `install_accepted`, `install_cancelled`, `installed`, `ios_help_opened`, `sw_registration_error` |
| `community_prompt` | `view`, `click`, `dismiss` |
| `caseta`, `caseta_dish` | solo si se reactivan las casetas (`FIESTAS_CASETAS_ENABLED`) |

Los guardados/likes/planes se cuentan una sola vez por navegador mediante claves
`fiestasAranda:analytics:*` en `localStorage`, para no inflar el conteo al repetir la acción.

Un fallo de GA nunca impide usar la agenda, guardar actividades, compartir ni el mapa.
