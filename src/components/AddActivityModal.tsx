import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  X,
  Plus,
  Minus,
  Clock,
  Calendar,
  MapPin,
  Lock,
  Globe,
  Users,
  Image,
  ChevronDown,
  ChevronUp,
  Tag,
  Check,
  Shield,
  Layers,
  Save,
  Trophy,
  Camera,
  Trash2
} from 'lucide-react';
import {
  ActivityCategory,
  ActivityVisibility,
  ActivityOpponentRubber,
  ActivityRecord
} from '../types';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: ActivityCategory;
}

const PREDEFINED_DRILLS = [
  'Rozcvička',
  'Cvičenie FH',
  'Cvičenie BH',
  'Práca nôh',
  'Topspin',
  'Blok / kontra',
  'Krátka hra',
  'Podanie',
  'Príjem',
  'Tretia loptička',
  'Piata loptička',
  'Multiball',
  'Robot',
  'Hra na body',
  'Zápasový tréning',
  'Kondícia'
];

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'tréning'
}) => {
  const {
    addActivity,
    rackets,
    activeRacket,
    opponents
  } = useApp();

  // 1. Kategória
  const [category, setCategory] = useState<ActivityCategory>(defaultCategory);

  // 2. Trvanie (po 10 min)
  const [durationMinutes, setDurationMinutes] = useState(60);

  // 3. Zameranie tréningu (štítky)
  const [isDrillsOpen, setIsDrillsOpen] = useState(true);
  const [selectedDrills, setSelectedDrills] = useState<string[]>(['Rozcvička', 'Topspin']);
  const [customTagInput, setCustomTagInput] = useState('');

  // 4. Hráči a Súper (voliteľné)
  const [isOpponentSectionOpen, setIsOpponentSectionOpen] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [opponentGrip, setOpponentGrip] = useState<'right' | 'left'>('right');
  const [opponentFhRubber, setOpponentFhRubber] = useState<ActivityOpponentRubber>('in');
  const [opponentBhRubber, setOpponentBhRubber] = useState<ActivityOpponentRubber>('in');
  const [matchResult, setMatchResult] = useState<'WIN' | 'LOSS'>('WIN');
  const [matchScore, setMatchScore] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // 5. Detaily a Viditeľnosť
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('Klubová herňa');
  const [publicNote, setPublicNote] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [visibility, setVisibility] = useState<ActivityVisibility>('community');
  const [addEquipmentWear, setAddEquipmentWear] = useState(true);
  const [selectedRacketId, setSelectedRacketId] = useState(activeRacket?.id || '');

  if (!isOpen) return null;

  // Toggle drill tag
  const handleToggleDrill = (drill: string) => {
    if (selectedDrills.includes(drill)) {
      setSelectedDrills(selectedDrills.filter(d => d !== drill));
    } else {
      setSelectedDrills([...selectedDrills, drill]);
    }
  };

  // Add custom drill tag
  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed && !selectedDrills.includes(trimmed)) {
      setSelectedDrills([...selectedDrills, trimmed]);
      setCustomTagInput('');
    }
  };

  // Adjust duration by 10 minutes
  const handleAdjustDuration = (delta: number) => {
    setDurationMinutes(prev => Math.max(10, Math.min(600, prev + delta)));
  };

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotos(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, idx) => idx !== index));
  };

  // Auto-fill opponent details if chosen from existing opponents
  const handleSelectExistingOpponent = (name: string) => {
    setOpponentName(name);
    const existing = opponents.find(o => o.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.handedness === 'left') setOpponentGrip('left');
      if (existing.handedness === 'right') setOpponentGrip('right');
      if (existing.forehandRubber === 'long_pips') setOpponentFhRubber('long_pips');
      else if (existing.forehandRubber === 'short_pips') setOpponentFhRubber('short_pips');
      else if (existing.forehandRubber === 'antispin') setOpponentFhRubber('anti');
      else setOpponentFhRubber('in');

      if (existing.backhandRubber === 'long_pips') setOpponentBhRubber('long_pips');
      else if (existing.backhandRubber === 'short_pips') setOpponentBhRubber('short_pips');
      else if (existing.backhandRubber === 'antispin') setOpponentBhRubber('anti');
      else setOpponentBhRubber('in');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addActivity({
      category,
      date,
      durationMinutes,
      focusDrills: selectedDrills,
      opponentName: opponentName.trim() || undefined,
      opponentGrip: opponentName.trim() ? opponentGrip : undefined,
      opponentFhRubber: opponentName.trim() ? opponentFhRubber : undefined,
      opponentBhRubber: opponentName.trim() ? opponentBhRubber : undefined,
      matchResult: (opponentName.trim() && matchScore.trim()) ? matchResult : undefined,
      matchScore: matchScore.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
      location: location.trim() || 'Klubová herňa',
      publicNote: publicNote.trim() || undefined,
      privateNote: privateNote.trim() || undefined,
      visibility,
      addEquipmentWear,
      racketId: selectedRacketId || activeRacket?.id,
      intensity: 4
    });

    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  const formatHoursDisplay = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hod`;
    return `${h} hod ${m} min`;
  };

  return createPortal(
    <div
      className="mobile-sheet-container"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="glass-panel mobile-sheet-content"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          boxSizing: 'border-box',
          margin: 'auto'
        }}
      >
        {/* Modal Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0 }}>
              Pridať aktivitu
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Manuálne zadanie tréningu, zápasu alebo podujatia spätne
            </span>
          </div>

          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '7px', borderRadius: 'var(--radius-full)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* 1. KATEGÓRIE (Prepínače pre rýchly výber) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
              Typ aktivity *
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '6px'
            }}>
              {[
                { id: 'tréning' as ActivityCategory, label: 'Tréning', icon: '🏓' },
                { id: 'priatelsky' as ActivityCategory, label: 'Priateľský', icon: '🤝' },
                { id: 'turnaj' as ActivityCategory, label: 'Turnaj', icon: '🏆' },
                { id: 'liga' as ActivityCategory, label: 'Liga', icon: '🛡️' },
                { id: 'podujatie' as ActivityCategory, label: 'Podujatie', icon: '🎪' },
              ].map(cat => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      if (cat.id !== 'tréning' && cat.id !== 'podujatie') {
                        setIsOpponentSectionOpen(true);
                      }
                    }}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isSelected ? '#10b981' : 'var(--border-subtle)'}`,
                      background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)',
                      color: isSelected ? '#34d399' : 'var(--text-muted)',
                      fontWeight: isSelected ? 800 : 500,
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. TRVANIE (Manuálne po 10 minútach) */}
          <div style={{
            background: 'var(--bg-card)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Trvanie aktivity *
              </label>
              <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700 }}>
                {formatHoursDisplay(durationMinutes)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', margin: '8px 0' }}>
              <button
                type="button"
                onClick={() => handleAdjustDuration(-10)}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  fontWeight: 700
                }}
              >
                <Minus size={20} />
              </button>

              <div style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: '#fff',
                minWidth: '130px',
                textAlign: 'center'
              }}>
                {durationMinutes} <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>min</span>
              </div>

              <button
                type="button"
                onClick={() => handleAdjustDuration(10)}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  border: '1px solid #10b981',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  fontWeight: 700
                }}
              >
                <Plus size={20} />
              </button>
            </div>

            {/* Quick preset chips */}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
              {[30, 45, 60, 90, 120].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-subtle)',
                    background: durationMinutes === mins ? 'var(--accent-tt-green)' : 'transparent',
                    color: durationMinutes === mins ? '#fff' : 'var(--text-dim)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* 3. ZAMERANIE TRÉNINGU (Rozbaľovacia sekcia so štítkami) */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden'
          }}>
            <button
              type="button"
              onClick={() => setIsDrillsOpen(!isDrillsOpen)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                color: 'var(--text-main)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={16} color="#38bdf8" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  Zameranie tréningu ({selectedDrills.length} vybraných)
                </span>
              </div>
              {isDrillsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isDrillsOpen && (
              <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Predefined Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PREDEFINED_DRILLS.map(drill => {
                    const isSelected = selectedDrills.includes(drill);
                    return (
                      <button
                        key={drill}
                        type="button"
                        onClick={() => handleToggleDrill(drill)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-full)',
                          border: `1px solid ${isSelected ? '#34d399' : 'rgba(255, 255, 255, 0.1)'}`,
                          background: isSelected ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                          color: isSelected ? '#34d399' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.12s'
                        }}
                      >
                        {isSelected && <Check size={12} />}
                        {drill}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Tag Input */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="text"
                    placeholder="Pridať vlastný štítok..."
                    value={customTagInput}
                    onChange={e => setCustomTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                  >
                    + Pridať
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. HRÁČI A SÚPER (Voliteľné) */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden'
          }}>
            <button
              type="button"
              onClick={() => setIsOpponentSectionOpen(!isOpponentSectionOpen)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                color: 'var(--text-main)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="#f59e0b" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  Hráči, Súper & Fotky (Voliteľné)
                </span>
                {opponentName && (
                  <span className="badge-pill badge-green" style={{ fontSize: '0.65rem' }}>
                    {opponentName}
                  </span>
                )}
              </div>
              {isOpponentSectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isOpponentSectionOpen && (
              <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Opponent Selection & Autocomplete */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                    Meno súpera
                  </label>
                  <input
                    type="text"
                    placeholder="Meno a priezvisko súpera"
                    value={opponentName}
                    onChange={e => setOpponentName(e.target.value)}
                    list="opponents-list"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <datalist id="opponents-list">
                    {opponents.map(o => (
                      <option key={o.id} value={o.name} />
                    ))}
                  </datalist>
                </div>

                {/* Opponent Grip & Rubbers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {/* Grip */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                      Úchop súpera
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setOpponentGrip('right')}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${opponentGrip === 'right' ? '#3b82f6' : 'var(--border-subtle)'}`,
                          background: opponentGrip === 'right' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                          color: opponentGrip === 'right' ? '#60a5fa' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Pravoruký
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpponentGrip('left')}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${opponentGrip === 'left' ? '#a855f7' : 'var(--border-subtle)'}`,
                          background: opponentGrip === 'left' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                          color: opponentGrip === 'left' ? '#c084fc' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Ľavoruký
                      </button>
                    </div>
                  </div>

                  {/* FH Rubber */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                      FH Poťah
                    </label>
                    <select
                      value={opponentFhRubber}
                      onChange={e => setOpponentFhRubber(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem'
                      }}
                    >
                      <option value="in">In (Hladký soft)</option>
                      <option value="long_pips">Dlhé pipsy (Tráva)</option>
                      <option value="short_pips">Krátke pipsy (Sendvič)</option>
                      <option value="anti">Anti (Anti-spin)</option>
                    </select>
                  </div>

                  {/* BH Rubber */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                      BH Poťah
                    </label>
                    <select
                      value={opponentBhRubber}
                      onChange={e => setOpponentBhRubber(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem'
                      }}
                    >
                      <option value="in">In (Hladký soft)</option>
                      <option value="long_pips">Dlhé pipsy (Tráva)</option>
                      <option value="short_pips">Krátke pipsy (Sendvič)</option>
                      <option value="anti">Anti (Anti-spin)</option>
                    </select>
                  </div>
                </div>

                {/* Match Score (Optional if match was played) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                      Výsledok zápasu
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setMatchResult('WIN')}
                        style={{
                          flex: 1,
                          padding: '7px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${matchResult === 'WIN' ? '#10b981' : 'var(--border-subtle)'}`,
                          background: matchResult === 'WIN' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                          color: matchResult === 'WIN' ? '#34d399' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Výhra
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatchResult('LOSS')}
                        style={{
                          flex: 1,
                          padding: '7px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${matchResult === 'LOSS' ? '#ef4444' : 'var(--border-subtle)'}`,
                          background: matchResult === 'LOSS' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                          color: matchResult === 'LOSS' ? '#f87171' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Prehra
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
                      Skóre zápasu
                    </label>
                    <input
                      type="text"
                      placeholder="Napr. 3:1 alebo 3:2"
                      value={matchScore}
                      onChange={e => setMatchScore(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>
                </div>

                {/* Pridanie fotiek */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                    Fotky z tréningu / zápasu ({photos.length})
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {photos.map((photo, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden' }}>
                        <img src={photo} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: '#f87171',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    <label style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '8px',
                      border: '2px dashed var(--border-subtle)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-dim)',
                      fontSize: '0.68rem',
                      gap: '2px'
                    }}>
                      <Camera size={18} />
                      <span>+ Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. DETAILY A VIDITEĽNOSŤ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Dátum a Miesto */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                  Dátum *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                  Miesto konania
                </label>
                <input
                  type="text"
                  placeholder="Napr. Klubová herňa STK"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            {/* Verejná a Súkromná poznámka */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700 }}>
                Verejná poznámka
              </label>
              <textarea
                rows={2}
                placeholder="Popis tréningu, celkový dojem..."
                value={publicNote}
                onChange={e => setPublicNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <Lock size={12} color="#f59e0b" />
                <label style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                  Súkromná poznámka (Viditeľná len pre teba)
                </label>
              </div>
              <textarea
                rows={2}
                placeholder="Taktika, postrehy k vlastným chybám, na čom popracovať..."
                value={privateNote}
                onChange={e => setPrivateNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Viditeľnosť (Len ja, Priatelia, Komunita) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                Viditeľnosť záznamu
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'private' as ActivityVisibility, label: 'Len ja', icon: Lock },
                  { id: 'friends' as ActivityVisibility, label: 'Priatelia', icon: Users },
                  { id: 'community' as ActivityVisibility, label: 'Komunita', icon: Globe }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = visibility === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVisibility(item.id)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${isSelected ? '#38bdf8' : 'var(--border-subtle)'}`,
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                        color: isSelected ? '#38bdf8' : 'var(--text-muted)',
                        fontSize: '0.8rem',
                        fontWeight: isSelected ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon size={14} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opotrebovanie výbavy (Raketa) */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={addEquipmentWear}
                  onChange={e => setAddEquipmentWear(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600 }}>
                  Automaticky pripočítať {durationMinutes} min k opotrebovaniu výbavy
                </span>
              </label>

              {addEquipmentWear && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    Použitá raketa:
                  </label>
                  <select
                    value={selectedRacketId}
                    onChange={e => setSelectedRacketId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem'
                    }}
                  >
                    {rackets.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.isActive ? '(Aktívna)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Uložiť tlačidlo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '10px 18px', fontSize: '0.88rem' }}
            >
              Zrušiť
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.88rem' }}
            >
              <Save size={16} /> Uložiť aktivitu
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
};
