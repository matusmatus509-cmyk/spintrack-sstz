import React, { useMemo, useState } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { CATALOG_BLADES, CATALOG_RUBBERS } from '../data/gearCatalog';
import type { Rubber, Blade } from '../types';
import './EquipmentCatalog.css';
import { buildEquipmentCatalog, filterEquipmentCatalog, equipmentModelKey as modelKey, equipmentCatalogSource as archive, isCurrentIttfApprovedCovering, type EquipmentModel } from '../utils/equipmentCatalog';

export function EquipmentCatalog({ rubbers, blades, onSelect, onCustom }: { rubbers: Rubber[]; blades: Blade[]; onSelect: (entry: EquipmentModel) => void; onCustom: (kind: EquipmentModel['kind']) => void }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | EquipmentModel['kind']>('all');
  const [brand, setBrand] = useState('all');
  const [page, setPage] = useState(1);
  const catalog = useMemo(() => buildEquipmentCatalog([
    ...[...CATALOG_RUBBERS, ...rubbers].map(item => ({ kind: 'rubber' as const, brand: item.brand, model: item.model })),
    ...[...CATALOG_BLADES, ...blades].map(item => ({ kind: 'blade' as const, brand: item.brand, model: item.model }))
  ]), [rubbers, blades]);
  const brands = useMemo(() => [...new Set(catalog.filter(item => kind === 'all' || item.kind === kind).map(item => item.brand))].sort((a, b) => a.localeCompare(b, 'sk')), [catalog, kind]);
  const visible = useMemo(() => filterEquipmentCatalog(catalog, query, kind, brand), [catalog, query, kind, brand]);
  const pages = Math.max(1, Math.ceil(visible.length / 24));
  const currentPage = Math.min(page, pages);
  const changeKind = (value: typeof kind) => { setKind(value); setBrand('all'); setPage(1); };
  const reset = () => { setQuery(''); changeKind('all'); };
  return <section className="gear-catalog">
    <div className="gear-catalog-heading"><div><span className="eyebrow">NÁJDI SVOJU VÝBAVU</span><h2>Katalóg poťahov a driev</h2><p>Vyber model, nastav svoju verziu a pridaj ho do rakety.</p></div><div className="gear-catalog-actions"><button className="btn-secondary" onClick={() => onCustom('rubber')}><Plus size={15} /> Vlastný poťah</button><button className="btn-secondary" onClick={() => onCustom('blade')}><Plus size={15} /> Vlastné drevo</button></div></div>
    <div className="gear-catalog-filters glass-panel">
      <div className="gear-kind-tabs" aria-label="Typ výbavy">{(['all', 'rubber', 'blade'] as const).map(value => <button key={value} aria-pressed={kind === value} onClick={() => changeKind(value)}>{value === 'all' ? 'Všetko' : value === 'rubber' ? 'Poťahy' : 'Drevá'} <span>{catalog.filter(item => value === 'all' || item.kind === value).length.toLocaleString('sk-SK')}</span></button>)}</div>
      <div className="gear-filter-fields"><label className="gear-search"><Search size={18} /><input aria-label="Vyhľadať model alebo značku" placeholder="Názov modelu alebo značka…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label><select aria-label="Značka výbavy" value={brand} onChange={e => { setBrand(e.target.value); setPage(1); }}><option value="all">Všetky značky</option>{brands.map(name => <option key={name} value={name}>{name}</option>)}</select><button className="btn-secondary" onClick={reset}>Vymazať filtre</button></div>
    </div>
    <div className="gear-catalog-summary" aria-live="polite"><strong>{visible.length.toLocaleString('sk-SK')} modelov</strong><span><a href={archive.currentApproval.sourceUrl} target="_blank" rel="noreferrer">{archive.currentApproval.count.toLocaleString('sk-SK')} aktuálne schválených poťahov ITTF</a> · kontrolované {archive.currentApproval.retrievedAt}. Zoznam driev pochádza z <a href={archive.sourceUrl} target="_blank" rel="noreferrer">historického katalógu</a> (načítané {archive.retrievedAt}); ITTF pre drevá nevedie centrálny schvaľovací zoznam.</span></div>
    <div className="gear-model-grid">{visible.slice((currentPage - 1) * 24, currentPage * 24).map(item => <article className="glass-panel gear-model-card" key={modelKey(item)}><div className="gear-model-meta"><span className={`badge-pill ${item.kind === 'rubber' ? 'badge-green' : 'badge-purple'}`}>{item.kind === 'rubber' ? 'POŤAH' : 'DREVO'}</span><span>{item.brand}</span></div><h3>{item.model}</h3>{isCurrentIttfApprovedCovering(item) && <span className="gear-current-status">Aktuálne schválené ITTF</span>}<button className="btn-primary" onClick={() => onSelect(item)}><Plus size={16} /> Vybrať model</button></article>)}</div>
    {!visible.length && <div className="glass-panel gear-empty"><h3>Model sa nenašiel</h3><p>Skús kratší názov, inú značku alebo si model pridaj ručne.</p><button className="btn-secondary" onClick={reset}>Zobraziť celý katalóg</button></div>}
    {pages > 1 && <nav className="gear-pagination" aria-label="Stránkovanie katalógu"><button className="btn-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /> Späť</button><span>{currentPage} / {pages}</span><button className="btn-secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Ďalej <ChevronRight size={16} /></button></nav>}
  </section>;
}
