import React, { useState, useEffect } from 'react';
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
  RotateCcw
} from 'lucide-react';

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

  // New Racket Modal
  const [showNewRacketModal, setShowNewRacketModal] = useState(false);
  const [racketName, setRacketName] = useState('');
  const [selectedBladeId, setSelectedBladeId] = useState('');
  const [selectedFhId, setSelectedFhId] = useState('');
  const [selectedBhId, setSelectedBhId] = useState('');

  // New Rubber Modal
  const [showNewRubberModal, setShowNewRubberModal] = useState(false);
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

  useEffect(() => {
    if (showNewRacketModal || showNewRubberModal) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [showNewRacketModal, showNewRubberModal]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        {[
          { id: 'rackets', label: `Moje Rakety (${rackets.length})` },
          { id: 'rubbers', label: `Poťahy & Zdravie (${rubbers.length})` },
          { id: 'blades', label: `Drevá (${blades.length})` },
          { id: 'catalog', label: 'Katalóg & Wishlist' },
          { id: 'compare', label: 'Porovnávač výbavy' },
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Zostavy Rakiet (Racket Setups)</h2>
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
              <Plus size={16} /> Poskladať novú raketu
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Inventár Driev</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Zoznam tvojich herných a záložných driev.
              </p>
            </div>
            <button
              onClick={() => {
                const b = CATALOG_BLADES[0];
                addBlade({
                  ...b,
                  hoursPlayed: 0,
                  dateAcquired: new Date().toISOString().split('T')[0]
                });
              }}
              className="btn-primary"
            >
              <Plus size={16} /> Pridať drevo
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
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
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Katalóg Poťahov & Driev</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Populárne profesionálne a klubové vybavenie. Pridaj si ich priamo do svojho inventára jedným klikom.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {CATALOG_RUBBERS.map((cr, idx) => (
              <div
                key={idx}
                className="glass-panel"
                style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge-pill badge-green" style={{ fontSize: '0.65rem' }}>POŤAH</span>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>SPD: <strong>{cr.speed}</strong></span>
                    <span>SPN: <strong>{cr.spin}</strong></span>
                    <span>CTRL: <strong>{cr.control}</strong></span>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{cr.brand} {cr.model}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    {cr.notes}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Životnosť: ~{cr.maxRecommendedHours}h
                  </span>
                  <button
                    onClick={() => handleAddFromCatalog(cr)}
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  >
                    + Pridať do výbavy
                  </button>
                </div>
              </div>
            ))}
          </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                <div style={{
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

      {/* Modal: Poskladať novú raketu */}
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
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Poskladať novú raketu</h3>

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
