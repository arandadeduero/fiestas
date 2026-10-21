import assert from 'node:assert/strict';
import test from 'node:test';

import { eventSocialDescription, truncateSocialText } from '../scripts/social-meta.mjs';

test('truncateSocialText keeps short texts intact and collapses whitespace', () => {
  assert.equal(truncateSocialText('  Hola   mundo \n'), 'Hola mundo');
  assert.equal(truncateSocialText('a'.repeat(200)), 'a'.repeat(200));
});

test('truncateSocialText cuts at a word boundary and appends an ellipsis', () => {
  const words = Array.from({ length: 60 }, (_, index) => `palabra${index}`).join(' ');
  const result = truncateSocialText(words);
  assert.ok(result.length <= 200, `expected at most 200 chars, got ${result.length}`);
  assert.ok(result.endsWith('…'));
  assert.ok(!result.includes('…palabra'));
  assert.match(result, /palabra\d+…$/);
});

test('eventSocialDescription leads with date, time and place before the summary', () => {
  const description = eventSocialDescription({
    dateLabel: 'Sábado 12 de septiembre',
    startTime: '22:00',
    endTime: '00:30',
    location: 'Plaza Mayor',
    summary: 'Concierto de la orquesta municipal.'
  });
  assert.equal(description, 'Sábado 12 de septiembre · 22:00 - 00:30 · Plaza Mayor. Concierto de la orquesta municipal.');
});

test('eventSocialDescription skips missing parts and stays within the social limit', () => {
  assert.equal(eventSocialDescription({ dateLabel: 'Martes 1 de septiembre', summary: 'Escaparate.' }), 'Martes 1 de septiembre. Escaparate.');
  assert.equal(eventSocialDescription({ dateLabel: 'Martes 1 de septiembre', startTime: '12:00' }), 'Martes 1 de septiembre · 12:00');
  const long = eventSocialDescription({ dateLabel: 'Martes 1 de septiembre', location: 'Plaza', summary: 'Texto largo. '.repeat(40) });
  assert.ok(long.length <= 200);
  assert.ok(long.startsWith('Martes 1 de septiembre · Plaza. Texto largo.'));
});
