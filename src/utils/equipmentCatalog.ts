import archive from '../data/equipmentNames.json' with { type: 'json' };

export interface EquipmentModel { kind: 'rubber' | 'blade'; brand: string; model: string; }
export const equipmentSearchKey = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const equipmentModelKey = (entry: EquipmentModel) => `${entry.kind}:${equipmentSearchKey(entry.brand)}:${equipmentSearchKey(entry.model)}`;
export const equipmentCatalogSource = { sourceUrl: archive.sourceUrl, retrievedAt: archive.retrievedAt };

export function buildEquipmentCatalog(extraModels: EquipmentModel[] = []): EquipmentModel[] {
  const items = new Map<string, EquipmentModel>();
  for (const [kind, brand, model] of archive.entries) {
    const entry = { kind: kind as EquipmentModel['kind'], brand, model };
    items.set(equipmentModelKey(entry), entry);
  }
  for (const entry of extraModels) {
    const key = equipmentModelKey(entry);
    if (!items.has(key)) items.set(key, entry);
  }
  return [...items.values()].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'sk'));
}

export function filterEquipmentCatalog(catalog: EquipmentModel[], query: string, kind: 'all' | EquipmentModel['kind'], brand: string) {
  const key = equipmentSearchKey(query);
  return catalog.filter(item => (kind === 'all' || item.kind === kind) && (brand === 'all' || item.brand === brand) && equipmentSearchKey(`${item.brand}${item.model}`).includes(key));
}
