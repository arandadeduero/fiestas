// Textos para las previsualizaciones sociales (Open Graph / Twitter cards).
// Funciones puras, sin acceso a disco, para poder probarlas con `node --test`.

export const SOCIAL_DESCRIPTION_MAX_LENGTH = 200;

// Recorta un texto a `maxLength` caracteres sin partir palabras, añadiendo «…».
// WhatsApp y Telegram enseñan dos o tres líneas; Facebook corta sobre los 300.
export function truncateSocialText(text, maxLength = SOCIAL_DESCRIPTION_MAX_LENGTH) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.·-]+$/, '') + '…';
}

// Descripción social de una actividad: fecha · hora · lugar, y después el resumen.
// Así el enlace compartido en WhatsApp ya responde a «cuándo y dónde» sin abrirlo.
export function eventSocialDescription(event) {
  const time = [event.startTime, event.endTime].filter(Boolean).join(' - ');
  const when = [event.dateLabel, time].filter(Boolean).join(' · ');
  const where = String(event.location || '').trim();
  const lead = [when, where].filter(Boolean).join(' · ');
  const summary = String(event.summary || event.description || '').trim();
  return truncateSocialText(lead && summary ? `${lead}. ${summary}` : lead || summary);
}
