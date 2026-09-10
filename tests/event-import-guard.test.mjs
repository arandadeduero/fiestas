import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { buildImportGuard } from '../scripts/event-import-guard.mjs';

// El fork de Aranda de Duero no importa desde una fuente remota de Eventos, así
// que `import-event-decisions.json` está vacío. La lógica del guard se prueba
// aquí con un fixture sintético; el catálogo real se comprueba contra el fichero.
const fixture = {
  blockedRemoteIds: {
    2148: { reason: 'Ubicación ambigua; no se fuerza el cruce.' }
  },
  duplicateRemoteToLocal: {
    1999: { localId: 474, reason: 'Registro remoto duplicado de un evento ya importado.' }
  },
  blockedEventFingerprints: [
    {
      date: '2026-09-07',
      startTime: '18:00',
      title: 'Evento retirado',
      location: 'Calle de prueba, Aranda de Duero',
      deletedLocalId: 762,
      reason: 'Evento local eliminado; no reimportar.'
    }
  ]
};

test('bloquea huellas de eventos locales eliminados', () => {
  const guard = buildImportGuard(fixture);
  const blocked = guard.getBlockedEvent({
    date: '2026-09-07',
    startTime: '18:00',
    title: 'Evento retirado',
    location: 'Calle de prueba, Aranda de Duero'
  });

  assert.equal(blocked.deletedLocalId, 762);
  assert.match(blocked.reason, /no reimportar/);
});

test('expone remotos bloqueados y remotos duplicados como decisiones versionadas', () => {
  const guard = buildImportGuard(fixture);

  assert.equal(guard.getBlockedRemote(2148).reason, 'Ubicación ambigua; no se fuerza el cruce.');
  assert.equal(guard.getDuplicateLocal(1999).localId, 474);
});

test('el catalogo actual no contiene eventos con huella bloqueada', async () => {
  const decisions = JSON.parse(await fs.readFile('src/data/fiestas-2026/import-event-decisions.json', 'utf8'));
  const events = JSON.parse(await fs.readFile('src/data/fiestas-2026/events.json', 'utf8'));
  const guard = buildImportGuard(decisions);
  const blockedEvents = events
    .map((event) => ({ event, decision: guard.getBlockedEvent(event) }))
    .filter(({ decision }) => decision);

  assert.deepEqual(blockedEvents, []);
});
