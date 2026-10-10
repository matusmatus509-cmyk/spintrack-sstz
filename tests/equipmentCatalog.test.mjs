import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEquipmentCatalog, filterEquipmentCatalog, equipmentModelKey, isCurrentIttfApprovedCovering } from '../src/utils/equipmentCatalog.ts';

test('bundled catalog combines historical products with current ITTF-approved rubbers, without duplicates or made-up ratings', () => {
  const catalog = buildEquipmentCatalog();
  assert.equal(catalog.filter(item => item.kind === 'rubber').length, 2896);
  assert.equal(catalog.filter(item => item.kind === 'blade').length, 2521);
  assert.equal(new Set(catalog.map(equipmentModelKey)).size, catalog.length);
  for (const item of catalog) {
    assert.ok(item.brand && item.model);
    assert.ok(!item.model.includes('\uFFFD'));
    assert.equal('speed' in item, false);
  }
  assert.ok(catalog.some(item => item.brand === 'Butterfly' && item.model === 'Viscaria' && item.kind === 'blade'));
  assert.ok(catalog.some(item => item.brand === 'Butterfly' && item.model === 'Tenergy 05' && item.kind === 'rubber'));
  const current = catalog.find(item => item.brand === 'Butterfly' && item.model === 'Zyre 03');
  assert.ok(current);
  assert.equal(isCurrentIttfApprovedCovering(current), true);
  assert.equal(isCurrentIttfApprovedCovering({ kind: 'rubber', brand: 'Butterfly', model: 'Tenergy 05' }), true);
  assert.equal(isCurrentIttfApprovedCovering({ kind: 'blade', brand: 'Butterfly', model: 'Viscaria' }), false);
});

test('combines brand, type and accent-insensitive search and covers every result with pagination', () => {
  const catalog = buildEquipmentCatalog();
  const found = filterEquipmentCatalog(catalog, 'TENERGY-05', 'rubber', 'Butterfly');
  assert.ok(found.length > 0);
  assert.ok(found.every(item => item.kind === 'rubber' && item.brand === 'Butterfly'));
  assert.equal(filterEquipmentCatalog(catalog, 'Tenergy 05', 'blade', 'Butterfly').length, 0);
  assert.ok(filterEquipmentCatalog(catalog, 'Sauer Troger', 'all', 'all').length > 0);
  const pages = [];
  for (let offset = 0; offset < catalog.length; offset += 24) pages.push(...catalog.slice(offset, offset + 24));
  assert.deepEqual(pages, catalog);
});

test('keeps custom inventory models and deduplicates equivalent spellings across sources', () => {
  const catalog = buildEquipmentCatalog();
  const extra = buildEquipmentCatalog([
    { kind: 'rubber', brand: 'butterfly', model: 'Tenergy-05' },
    { kind: 'rubber', brand: 'My brand', model: 'Custom rubber' },
    { kind: 'blade', brand: 'My brand', model: 'Custom blade' },
  ]);
  assert.equal(extra.length, catalog.length + 2);
  assert.equal(extra.find(item => equipmentModelKey(item) === 'rubber:butterfly:tenergy05').brand, 'Butterfly');
  assert.equal(filterEquipmentCatalog(extra, 'custom', 'all', 'My brand').length, 2);
});
