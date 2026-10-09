import { useDialog } from '../hooks/useDialog';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { CATALOG_RUBBERS, CATALOG_BLADES } from '../data/gearCatalog';
import { Rubber, Blade, RacketSetup } from '../types';
import {
  Layers,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ArrowRightLeft,
  Heart,
  TrendingUp,
  Info,
  Clock,
  RotateCcw,
  Search
} from 'lucide-react';

const gearInputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '5px',
  padding: '9px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-main)',
  boxSizing: 'border-box'
};

export const EquipmentView: React.FC = () => {
  const {
    rackets,
    activeRacketId,
    setActiveRacket,
    addRacket,
    deleteRacket,
    rubbers,
    addRubber,
    updateRubber,
    deleteRubber,
    blades,
    addBlade,
    deleteBlade,
    getRubberHealth
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'rackets' | 'rubbers' | 'blades' | 'catalog' | 'compare'>('rackets');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogKind, setCatalogKind] = useState<'all' | 'rubber' | 'blade'>('all');
  const [catalogBrand, setCatalogBrand] = useState('all');

  // New Racket Modal
  const [showNewRacketModal, setShowNewRacketModal] = useState(false);
  const [racketName, setRacketName] = useState('');
  const [selectedBladeId, setSelectedBladeId] = useState('');
  const [selectedFhId, setSelectedFhId] = useState('');
  const [selectedBhId, setSelectedBhId] = useState('');

  // New Rubber Modal
  const [showNewRubberModal, setShowNewRubberModal] = useState(false);
  const [showNewBladeModal, setShowNewBladeModal] = useState(false);
  const [bladeForm, setBladeForm] = useState({ brand: '', model: '', plies: '', weightGrams: 85, grip: 'FL' as Blade['grip'], speed: 85, control: 85 });
  const [rubberForm, setRubberForm] = useState({
    brand: 'Butterfly',
    model: '',
    type: 'inverted' as const,
    color: 'black' as const,
    spongeThickness: '2.1mm',
    spongeHardness: 45,
    speed: 90,
    spin: 90,
    control: 85,
    maxRecommendedHours: 80,
    notes: ''
  });

  // Comparison tool state
  const [compareItemA, setCompareItemA] = useState<string>(CATALOG_RUBBERS[0].model);
  const [compareItemB, setCompareItemB] = useState<string>(CATALOG_RUBBERS[1].model);

  const catalogItems = [
    ...CATALOG_RUBBERS.map(item => ({ kind: 'rubber' as const, item })),
    ...rubbers
      .filter(item => !CATALOG_RUBBERS.some(catalog => catalog.brand.toLowerCase() === item.brand.toLowerCase() && catalog.model.toLowerCase() === item.model.toLowerCase()))
      .map(item => ({ kind: 'rubber' as const, item })),
    ...CATALOG_BLADES.map(item => ({ kind: 'blade' as const, item })),
    ...blades
      .filter(item => !CATALOG_BLADES.some(catalog => catalog.brand.toLowerCase() === item.brand.toLowerCase() && catalog.model.toLowerCase() === item.model.toLowerCase()))
      .map(item => ({ kind: 'blade' as const, item }))
  ];
  const catalogBrands = Array.from(new Set(catalogItems.map(({ item }) => item.brand))).sort((a, b) => a.localeCompare(b));
  const visibleCatalogItems = catalogItems.filter(({ kind, item }) => {
    const query = catalogSearch.trim().toLocaleLowerCase('sk');
    return (catalogKind === 'all' || catalogKind === kind)
      && (catalogBrand === 'all' || item.brand === catalogBrand)
      && (!query || `${item.brand} ${item.model}`.toLocaleLowerCase('sk').includes(query));
  });

  // Handle Add Racket Setup
  const handleCreateRacket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!racketName || !selectedBladeId || !selectedFhId || !selectedBhId) return;

    addRacket({
      name: racketName,
      bladeId: selectedBladeId,
      forehandRubberId: selectedFhId,
      backhandRubberId: selectedBhId,
      isActive: rackets.length === 0
    });

    setShowNewRacketModal(false);
    setRacketName('');
  };

  // Handle Add Custom Rubber
  const handleCreateRubber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubberForm.model) return;

    addRubber({
      brand: rubberForm.brand,
      model: rubberForm.model,
      type: rubberForm.type,
      color: rubberForm.color,
      spongeThickness: rubberForm.spongeThickness,
      spongeHardness: Number(rubberForm.spongeHardness),
      speed: Number(rubberForm.speed),
      spin: Number(rubberForm.spin),
      control: Number(rubberForm.control),
      hoursPlayed: 0,
      maxRecommendedHours: Number(rubberForm.maxRecommendedHours),
      dateInstalled: new Date().toISOString().split('T')[0],
      notes: rubberForm.notes
    });

    setShowNewRubberModal(false);
  };

  const handleCreateBlade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bladeForm.brand.trim() || !bladeForm.model.trim()) return;
    addBlade({
      ...bladeForm,
      brand: bladeForm.brand.trim(),
      model: bladeForm.model.trim(),
      plies: bladeForm.plies.trim(),
      weightGrams: Number(bladeForm.weightGrams),
      speed: Number(bladeForm.speed),
      control: Number(bladeForm.control),
      hoursPlayed: 0,
      dateAcquired: new Date().toISOString().split('T')[0]
    });
    setShowNewBladeModal(false);
    setBladeForm({ brand: '', model: '', plies: '', weightGrams: 85, grip: 'FL', speed: 85, control: 85 });
  };

  // Add from catalog helper
  const handleAddFromCatalog = (catRubber: typeof CATALOG_RUBBERS[0]) => {
    addRubber({
      ...catRubber,
      hoursPlayed: 0,
      dateInstalled: new Date().toISOString().split('T')[0]
    });
    alert(`Poťah ${catRubber.brand} ${catRubber.model} bol pridaný do tvojej výbavy!`);
  };

  const handleAddBladeFromCatalog = (catBlade: typeof CATALOG_BLADES[0]) => {
    addBlade({
      ...catBlade,
      hoursPlayed: 0,
      dateAcquired: new Date().toISOString().split('T')[0]
    });
    alert(`Drevo ${catBlade.brand} ${catBlade.model} bolo pridané do tvojej výbavy!`);
  };

  const dialogRef = useDialog(showNewRacketModal || showNewRubberModal || showNewBladeModal, () => { setShowNewRacketModal(false); setShowNewRubberModal(false); setShowNewBladeModal(false); });

  return (
    <div className="page-view equipment-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div className="page-header"><div><span className="eyebrow">VYBAVENIE PRE TVOJU HRU</span><h1>Moja výstroj</h1><p>Rakety, poťahy a ich kondícia pod kontrolou.</p></div></div>

      {/* Sub Tabs Navigation */}
      <div className="scroll-tabs" style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        {[
          { id: 'rackets', label: `Rakety (${rackets.length})` },
          { id: 'rubbers', label: `Poťahy (${rubbers.length})` },
          { id: 'blades', label: `Drevá (${blades.length})` },
          { id: 'catalog', label: 'Katalóg' },
          { id: 'compare', label: 'Porovnanie' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeSubTab === tab.id ? 'var(--bg-card)' : 'transparent',
              color: activeSubTab === tab.id ? '#34d399' : 'var(--text-muted)',
              fontWeight: activeSubTab === tab.id ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              borderBottom: activeSubTab === tab.id ? '2px solid #10b981' : '2px solid transparent'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. RACKETS VIEW */}
      {activeSubTab === 'rackets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="equipment-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Moje rakety</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Skombinuj svoje drevo a poťahy do hernej zostavy. Sleduj celkový čas a úspešnosť.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedBladeId(blades[0]?.id || '');
                setSelectedFhId(rubbers[0]?.id || '');
                setSelectedBhId(rubbers[1]?.id || rubbers[0]?.id || '');
                setShowNewRacketModal(true);
              }}
              className="btn-primary"
            >
              <Plus size={16} /> Nová raketa
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
            gap: '16px'
          }}>
            {rackets.map(racket => {
              const b = blades.find(item => item.id === racket.bladeId);
              const fh = rubbers.find(item => item.id === racket.forehandRubberId);
              const bh = rubbers.find(item => item.id === racket.backhandRubberId);
              const isActive = racket.id === activeRacketId;

              const fhH = fh ? getRubberHealth(fh) : null;
              const bhH = bh ? getRubberHealth(bh) : null;

              return (
                <div
                  key={racket.id}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    border: isActive ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="equipment-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{racket.name}</h3>
                        {isActive && (
                          <span className="badge-pill badge-green" style={{ fontSize: '0.65rem' }}>
                            <CheckCircle size={11} /> Aktívna
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        Vytvorená: {racket.dateCreated} • Odohrané: {racket.totalHours} hod.
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => deleteRacket(racket.id)}
                        title="Zmazať raketu"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Components */}
                  <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Drevo:</span>
                      <strong>{b ? `${b.brand} ${b.model} (${b.plies})` : 'Nezvolené'}</strong>
                    </div>

                    <div className="equipment-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>FH Poťah:</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{fh ? `${fh.brand} ${fh.model}` : 'Nezvolený'}</strong>
                        {fhH && (
                          <div style={{ fontSize: '0.75rem', color: fhH.percent < 40 ? '#f87171' : '#34d399' }}>
                            Zdravie {fhH.percent}% ({fh?.hoursPlayed}h)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="equipment-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>BH Poťah:</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{bh ? `${bh.brand} ${bh.model}` : 'Nezvolený'}</strong>
                        {bhH && (
                          <div style={{ fontSize: '0.75rem', color: bhH.percent < 40 ? '#f87171' : '#34d399' }}>
                            Zdravie {bhH.percent}% ({bh?.hoursPlayed}h)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats & Set Active Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Bilancia: <strong style={{ color: '#34d399' }}>{racket.winCount}V</strong> - <strong style={{ color: '#f87171' }}>{racket.lossCount}P</strong>
                    </div>

                    {!isActive && (
                      <button
                        onClick={() => setActiveRacket(racket.id)}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        Zvoliť ako hlavnú
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. RUBBERS & HEALTH VIEW */}
      {activeSubTab === 'rubbers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="equipment-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Sledovanie Zdravia & Opotrebovania Poťahov</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Poťahy postupne strácajú grip, rotáciu a dynamiku. SpinTrack ti presne ukáže, kedy je čas na výmenu.
              </p>
            </div>
            <button
              onClick={() => setShowNewRubberModal(true)}
              className="btn-primary"
            >
              <Plus size={16} /> Pridať poťah
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: '16px'
          }}>
            {rubbers.map(rubber => {
              const health = getRubberHealth(rubber);
              const isWarning = health.percent < 40;

              return (
                <div
                  key={rubber.id}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    border: isWarning ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: rubber.color === 'red' ? '#ef4444' : '#000000',
                        border: '2px solid rgba(255,255,255,0.3)',
                        flexShrink: 0
                      }} />
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                          {rubber.brand} {rubber.model}
                        </h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Hrúbka: {rubber.spongeThickness} • Tvrdosť: {rubber.spongeHardness || 45}°
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteRubber(rubber.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Health Gauge Meter */}
                  <div style={{
                    background: 'var(--bg-card)',
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div className="equipment-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Stav poťahu (Grip & Odskok)</span>
                      <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: health.percent < 25 ? '#ef4444' : health.percent < 50 ? '#f59e0b' : '#10b981'
                      }}>
                        {health.percent}% ({health.status.toUpperCase()})
                      </span>
                    </div>

                    <div style={{
                      height: '10px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${health.percent}%`,
                        height: '100%',
                        background: health.percent < 25
                          ? '#ef4444'
                          : health.percent < 50
                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            : 'linear-gradient(90deg, #10b981, #34d399)',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>Odohrané: <strong>{rubber.hoursPlayed} hod.</strong></span>
                      <span>Zostáva cca: <strong>{health.remainingHours} hod.</strong></span>
                    </div>

                    {isWarning && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#f87171',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        marginTop: '4px'
                      }}>
                        <AlertTriangle size={13} />
                        Poťah dosiahol hranicu opotrebovania. Rotácia loptičky klesá!
                      </div>
                    )}
                  </div>

                  {/* Specs & Reset Action */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Rýchlosť: <strong>{rubber.speed}</strong></span>
                      <span style={{ color: 'var(--text-dim)' }}>Rotácia: <strong>{rubber.spin}</strong></span>
                      <span style={{ color: 'var(--text-dim)' }}>Kontrola: <strong>{rubber.control}</strong></span>
                    </div>

                    <button
                      onClick={() => {
                        updateRubber(rubber.id, {
                          hoursPlayed: 0,
                          dateInstalled: new Date().toISOString().split('T')[0]
                        });
                        alert(`Poťah ${rubber.model} bol označený ako nový! Hodiny boli vynulované.`);
                      }}
                      title="Nalepiť nový / vynulovať hodiny"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#34d399',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RotateCcw size={12} /> Nový poťah
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. BLADES VIEW */}
      {activeSubTab === 'blades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="equipment-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Inventár Driev</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Zoznam tvojich herných a záložných driev.
              </p>
            </div>
            <button onClick={() => setShowNewBladeModal(true)} className="btn-primary">
              <Plus size={16} /> Pridať drevo
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: '16px'
          }}>
            {blades.map(b => (
              <div
                key={b.id}
                className="glass-panel"
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{b.brand} {b.model}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Rúčka: {b.grip} • Hmotnosť: ~{b.weightGrams}g
                    </span>
                  </div>
                  <button
                    onClick={() => deleteBlade(b.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{
                  background: 'var(--bg-card)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div>Vrstvy: <strong>{b.plies}</strong></div>
                  <div>Rýchlosť: <strong>{b.speed}/100</strong> • Kontrola: <strong>{b.control}/100</strong></div>
                  <div>Odohrané s týmto drevom: <strong>{b.hoursPlayed} hod.</strong></div>
                </div>

                {b.notes && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    "{b.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. CATALOG & WISHLIST */}
      {activeSubTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Katalóg poťahov a driev</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Hľadaj podľa názvu alebo značky. Výbava, ktorú už máš uloženú, sa zobrazí tiež.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setShowNewRubberModal(true)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Plus size={15} /> Pridať vlastný poťah</button>
              <button onClick={() => setShowNewBladeModal(true)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Plus size={15} /> Pridať vlastné drevo</button>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
              <Search size={17} color="var(--text-muted)" />
              <input aria-label="Hľadať výbavu" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} placeholder="Hľadať poťah alebo drevo…" style={{ width: '100%', minWidth: 0, padding: '10px 0', border: 0, outline: 0, color: 'var(--text-main)', background: 'transparent' }} />
            </label>
            <select aria-label="Typ výbavy" value={catalogKind} onChange={e => setCatalogKind(e.target.value as typeof catalogKind)} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}>
              <option value="all">Všetko ({catalogItems.length})</option><option value="rubber">Poťahy</option><option value="blade">Drevá</option>
            </select>
            <select aria-label="Značka" value={catalogBrand} onChange={e => setCatalogBrand(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}>
              <option value="all">Všetky značky</option>{catalogBrands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>Zobrazených {visibleCatalogItems.length} z {catalogItems.length} položiek</p>

          {visibleCatalogItems.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '14px' }}>
            {visibleCatalogItems.map(({ kind, item }) => {
              const isRubber = kind === 'rubber';
              const rubber = isRubber ? item as typeof CATALOG_RUBBERS[number] : null;
              const blade = !isRubber ? item as typeof CATALOG_BLADES[number] : null;
              return <article key={`${kind}-${item.brand}-${item.model}`} className="glass-panel" style={{ padding: '17px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span className="badge-pill badge-green" style={{ fontSize: '0.65rem' }}>{isRubber ? 'POŤAH' : 'DREVO'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.brand}</span>
                </div>
                <div><h3 style={{ fontSize: '1.02rem', fontWeight: 750 }}>{item.model}</h3>
                  {rubber && <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: '5px' }}>{rubber.type.replace('_', ' ')} · {rubber.spongeThickness}{rubber.spongeHardness ? ` · ${rubber.spongeHardness}°` : ''}</p>}
                  {blade && <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: '5px' }}>{blade.plies} · {blade.weightGrams} g · {blade.grip}</p>}
                </div>
                {rubber && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Rýchlosť {rubber.speed} · Rotácia {rubber.spin} · Kontrola {rubber.control}</p>}
                {blade && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Rýchlosť {blade.speed} · Kontrola {blade.control}</p>}
                <button onClick={() => isRubber ? handleAddFromCatalog(rubber!) : handleAddBladeFromCatalog(blade!)} className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.8rem', marginTop: 'auto' }}>
                  <Plus size={14} /> Pridať do výbavy
                </button>
              </article>;
            })}
          </div> : <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenašli sa žiadne položky. Skús iný názov alebo značku.</div>}
        </div>
      )}

      {/* 5. COMPARE TOOL */}
      {activeSubTab === 'compare' && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Porovnávač Vybavenia (Side-by-Side Comparison)</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Porovnaj dva poťahy vedľa seba podľa rýchlosti, rotácie, kontroly a životnosti.
            </p>
          </div>

          <div className="comparison-selectors" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
            {/* Item A */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Poťah 1
              </label>
              <select
                value={compareItemA}
                onChange={e => setCompareItemA(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem'
                }}
              >
                {CATALOG_RUBBERS.map(r => (
                  <option key={r.model} value={r.model}>{r.brand} {r.model}</option>
                ))}
              </select>
            </div>

            {/* Item B */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Poťah 2
              </label>
              <select
                value={compareItemB}
                onChange={e => setCompareItemB(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem'
                }}
              >
                {CATALOG_RUBBERS.map(r => (
                  <option key={r.model} value={r.model}>{r.brand} {r.model}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison table */}
          {(() => {
            const rubA = CATALOG_RUBBERS.find(r => r.model === compareItemA) || CATALOG_RUBBERS[0];
            const rubB = CATALOG_RUBBERS.find(r => r.model === compareItemB) || CATALOG_RUBBERS[1];

            const metrics = [
              { label: 'Rýchlosť (Speed)', a: rubA.speed, b: rubB.speed },
              { label: 'Rotácia (Spin)', a: rubA.spin, b: rubB.spin },
              { label: 'Kontrola (Control)', a: rubA.control, b: rubB.control },
              { label: 'Odhadovaná životnosť (Hod.)', a: rubA.maxRecommendedHours, b: rubB.maxRecommendedHours },
            ];

            return (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)'
              }}>
                <div className="comparison-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  padding: '12px 16px',
                  background: 'rgba(10, 13, 20, 0.6)',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}>
                  <span>Parameter</span>
                  <span style={{ textAlign: 'center', color: '#10b981' }}>{rubA.model}</span>
                  <span style={{ textAlign: 'center', color: '#38bdf8' }}>{rubB.model}</span>
                </div>

                {metrics.map((m, i) => (
                  <div
                    key={i}
                    className="comparison-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr',
                      padding: '14px 16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.9rem'
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                    <span style={{
                      textAlign: 'center',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: m.a > m.b ? '#34d399' : 'var(--text-main)'
                    }}>
                      {m.a} {m.a > m.b && '★'}
                    </span>
                    <span style={{
                      textAlign: 'center',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: m.b > m.a ? '#38bdf8' : 'var(--text-main)'
                    }}>
                      {m.b} {m.b > m.a && '★'}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal: Nová raketa */}
      {showNewRacketModal && createPortal(
        <div
          className="mobile-sheet-container"
          onClick={() => setShowNewRacketModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="glass-panel mobile-sheet-content"
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="Výstroj" tabIndex={-1}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
              margin: 'auto'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Nová raketa</h3>

            <form onSubmit={handleCreateRacket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Názov zostavy
                </label>
                <input
                  type="text"
                  required
                  placeholder="napr. Hlavná ligová pálka"
                  value={racketName}
                  onChange={e => setRacketName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Drevo
                </label>
                <select
                  value={selectedBladeId}
                  onChange={e => setSelectedBladeId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff'
                  }}
                >
                  {blades.map(b => (
                    <option key={b.id} value={b.id}>{b.brand} {b.model}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Forehand Poťah (FH)
                </label>
                <select
                  value={selectedFhId}
                  onChange={e => setSelectedFhId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff'
                  }}
                >
                  {rubbers.map(r => (
                    <option key={r.id} value={r.id}>{r.brand} {r.model} ({r.color.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Backhand Poťah (BH)
                </label>
                <select
                  value={selectedBhId}
                  onChange={e => setSelectedBhId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff'
                  }}
                >
                  {rubbers.map(r => (
                    <option key={r.id} value={r.id}>{r.brand} {r.model} ({r.color.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewRacketModal(false)}
                  className="btn-secondary"
                >
                  Zrušiť
                </button>
                <button type="submit" className="btn-primary">
                  Uložiť raketu
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showNewBladeModal && createPortal(
        <div className="mobile-sheet-container" onClick={() => setShowNewBladeModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px', boxSizing: 'border-box' }}>
          <div className="glass-panel mobile-sheet-content" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Pridať drevo" tabIndex={-1} onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Pridať drevo do výbavy</h3>
            <form onSubmit={handleCreateBlade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Značka<input required value={bladeForm.brand} onChange={e => setBladeForm({ ...bladeForm, brand: e.target.value })} placeholder="napr. Butterfly" style={gearInputStyle} /></label>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Model<input required value={bladeForm.model} onChange={e => setBladeForm({ ...bladeForm, model: e.target.value })} placeholder="napr. Viscaria" style={gearInputStyle} /></label>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Konštrukcia<input value={bladeForm.plies} onChange={e => setBladeForm({ ...bladeForm, plies: e.target.value })} placeholder="5 drevo + 2 ALC" style={gearInputStyle} /></label>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hmotnosť (g)<input type="number" min="1" value={bladeForm.weightGrams} onChange={e => setBladeForm({ ...bladeForm, weightGrams: Number(e.target.value) })} style={gearInputStyle} /></label>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rúčka<select value={bladeForm.grip} onChange={e => setBladeForm({ ...bladeForm, grip: e.target.value as Blade['grip'] })} style={gearInputStyle}><option value="FL">FL</option><option value="ST">ST</option><option value="AN">AN</option><option value="CPEN">CPEN</option></select></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rýchlosť<input type="number" min="0" max="100" value={bladeForm.speed} onChange={e => setBladeForm({ ...bladeForm, speed: Number(e.target.value) })} style={gearInputStyle} /></label><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kontrola<input type="number" min="0" max="100" value={bladeForm.control} onChange={e => setBladeForm({ ...bladeForm, control: Number(e.target.value) })} style={gearInputStyle} /></label></div>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dim)' }}>Údaje si môžeš upraviť podľa svojho modelu; katalógové hodnotenia sa automaticky nevymýšľajú.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}><button type="button" onClick={() => setShowNewBladeModal(false)} className="btn-secondary">Zrušiť</button><button type="submit" className="btn-primary">Uložiť drevo</button></div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* Modal: Pridať poťah */}
      {showNewRubberModal && createPortal(
        <div
          className="mobile-sheet-container"
          onClick={() => setShowNewRubberModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="glass-panel mobile-sheet-content"
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="Výstroj" tabIndex={-1}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
              margin: 'auto'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Pridať poťah do výbavy</h3>

            <form onSubmit={handleCreateRubber} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Značka</label>
                  <input
                    type="text"
                    required
                    value={rubberForm.brand}
                    onChange={e => setRubberForm({ ...rubberForm, brand: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Model</label>
                  <input
                    type="text"
                    required
                    placeholder="napr. Dignics 09C"
                    value={rubberForm.model}
                    onChange={e => setRubberForm({ ...rubberForm, model: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Farba</label>
                  <select
                    value={rubberForm.color}
                    onChange={e => setRubberForm({ ...rubberForm, color: e.target.value as any })}
                    style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  >
                    <option value="black">Čierna</option>
                    <option value="red">Červená</option>
                    <option value="blue">Modrá</option>
                    <option value="green">Zelená</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hrúbka huby</label>
                  <input
                    type="text"
                    value={rubberForm.spongeThickness}
                    onChange={e => setRubberForm({ ...rubberForm, spongeThickness: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewRubberModal(false)}
                  className="btn-secondary"
                >
                  Zrušiť
                </button>
                <button type="submit" className="btn-primary">
                  Pridať poťah
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
