import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { ActivityRecord, ActivityCategory, MatchRecord } from '../types';
import { AddActivityModal } from '../components/AddActivityModal';
import { SetBreakdown } from '../components/SetBreakdown';
import {
  Activity,
  Plus,
  Trash2,
  Trophy,
  Clock,
  MapPin,
  CheckCircle,
  Flame,
  Tag,
  Filter,
  Lock,
  Globe,
  Users,
  Image as ImageIcon,
  Calendar,
  Layers,
  ChevronRight,
  Shield
} from 'lucide-react';

export const DiaryView: React.FC = () => {
  const {
    activities,
    deleteActivity,
    matches,
    deleteMatch,
    activeRacket
  } = useApp();

  // Category filter: 'all' | 'tréning' | 'priatelsky' | 'turnaj' | 'liga' | 'podujatie'
  const [categoryFilter, setCategoryFilter] = useState<'all' | ActivityCategory>('all');
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  // Filtered activities list
  const filteredActivities = useMemo(() => {
    if (categoryFilter === 'all') return activities;
    return activities.filter(a => a.category === categoryFilter);
  }, [activities, categoryFilter]);

  // SSTZ League matches (visible under 'liga' or 'all')
  const relevantLeagueMatches = useMemo(() => {
    if (categoryFilter === 'all' || categoryFilter === 'liga') {
      return matches.filter(m => m.source === 'SSTZ');
    }
    return [];
  }, [matches, categoryFilter]);

  const getCategoryBadge = (cat: ActivityCategory) => {
    switch (cat) {
      case 'tréning':
        return { label: 'Tréning', icon: '🏓', color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)' };
      case 'priatelsky':
        return { label: 'Priateľský', icon: '🤝', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' };
      case 'turnaj':
        return { label: 'Turnaj', icon: '🏆', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)' };
      case 'liga':
        return { label: 'Liga', icon: '🛡️', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.16)' };
      case 'podujatie':
        return { label: 'Podujatie', icon: '🎪', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.16)' };
      default:
        return { label: cat, icon: '🏓', color: '#10b981', bg: 'rgba(16, 185, 129, 0.16)' };
    }
  };

  const getRubberLabel = (rubber?: string) => {
    switch (rubber) {
      case 'in': return 'In (Soft)';
      case 'long_pips': return 'Tráva (dlhé zúbky)';
      case 'short_pips': return 'Sendvič (krátke zúbky)';
      case 'anti': return 'Anti-spin';
      default: return rubber || 'Soft';
    }
  };

  return (
    <div className="page-view diary-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header: Aktivita */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="badge-pill badge-green" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
              <Activity size={12} /> Prehľad záznamov
            </span>
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px', marginBottom: '0' }}>
            Aktivita
          </h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Evidencia tréningov, zápasov a podujatí
          </span>
        </div>

        {/* Hlavné tlačidlo: Pridať aktivitu */}
        <button
          onClick={() => setShowAddActivityModal(true)}
          className="btn-primary"
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={16} /> Pridať aktivitu
        </button>
      </div>

      {/* Filter kategórií: Tréning, Priateľský, Turnaj, Liga, Podujatie */}
      <div className="glass-panel" style={{ padding: '8px 10px', borderRadius: 'var(--radius-lg)' }}>
        <div className="scroll-tabs" style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}>
          {[
            { id: 'all', label: 'Všetky', count: activities.length + relevantLeagueMatches.length },
            { id: 'tréning' as ActivityCategory, label: 'Tréning', count: activities.filter(a => a.category === 'tréning').length },
            { id: 'priatelsky' as ActivityCategory, label: 'Priateľský', count: activities.filter(a => a.category === 'priatelsky').length },
            { id: 'turnaj' as ActivityCategory, label: 'Turnaj', count: activities.filter(a => a.category === 'turnaj').length },
            { id: 'liga' as ActivityCategory, label: 'Liga', count: activities.filter(a => a.category === 'liga').length + relevantLeagueMatches.length },
            { id: 'podujatie' as ActivityCategory, label: 'Podujatie', count: activities.filter(a => a.category === 'podujatie').length },
          ].map(tab => {
            const isSelected = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id as any)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isSelected ? '#10b981' : 'transparent'}`,
                  background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  color: isSelected ? '#34d399' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '0.65rem',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                  color: isSelected ? '#fff' : 'var(--text-dim)'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoznam aktivít */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Manuálne zadané aktivity */}
        {filteredActivities.map(act => {
          const badge = getCategoryBadge(act.category);

          return (
            <div
              key={act.id}
              className="glass-panel"
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                borderLeft: `4px solid ${badge.color}`
              }}
            >
              {/* Header aktivity */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    className="badge-pill"
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      border: `1px solid ${badge.color}44`
                    }}
                  >
                    {badge.icon} {badge.label}
                  </span>

                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    {act.durationMinutes} min
                  </span>

                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {act.date}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Visibility indicator */}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {act.visibility === 'private' && <><Lock size={11} color="#f59e0b" /> Len ja</>}
                    {act.visibility === 'friends' && <><Users size={11} color="#38bdf8" /> Priatelia</>}
                    {act.visibility === 'community' && <><Globe size={11} color="#34d399" /> Komunita</>}
                  </span>

                  <button
                    onClick={() => {
                      if (window.confirm('Naozaj chceš zmazať túto aktivitu?')) {
                        deleteActivity(act.id);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Zmazať aktivitu"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Súper (ak bol zadaný) */}
              {act.opponentName && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Súper:</span>
                    <strong style={{ fontSize: '0.9rem' }}>{act.opponentName}</strong>
                    {act.opponentGrip && (
                      <span className="badge-pill badge-blue" style={{ fontSize: '0.62rem' }}>
                        {act.opponentGrip === 'left' ? 'Ľavák' : 'Pravák'}
                      </span>
                    )}
                    {act.opponentFhRubber && (
                      <span className="badge-pill badge-gray" style={{ fontSize: '0.62rem' }}>
                        FH: {getRubberLabel(act.opponentFhRubber)}
                      </span>
                    )}
                    {act.opponentBhRubber && (
                      <span className="badge-pill badge-gray" style={{ fontSize: '0.62rem' }}>
                        BH: {getRubberLabel(act.opponentBhRubber)}
                      </span>
                    )}
                  </div>

                  {act.matchScore && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge-pill ${act.matchResult === 'WIN' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                        {act.matchResult === 'WIN' ? 'VÝHRA' : 'PREHRA'} {act.matchScore}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Zameranie tréningu (štítky) */}
              {act.focusDrills && act.focusDrills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {act.focusDrills.map((drill, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-muted)',
                        fontSize: '0.72rem'
                      }}
                    >
                      #{drill}
                    </span>
                  ))}
                </div>
              )}

              {/* Fotky (ak sú priložené) */}
              {act.photos && act.photos.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {act.photos.map((photo, pIdx) => (
                    <img
                      key={pIdx}
                      src={photo}
                      alt={`Foto ${pIdx + 1}`}
                      onClick={() => setSelectedPhotoPreview(photo)}
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        border: '1px solid var(--border-subtle)',
                        transition: 'transform 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  ))}
                </div>
              )}

              {/* Poznámky */}
              {act.publicNote && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {act.publicNote}
                </div>
              )}

              {act.privateNote && (
                <div style={{
                  padding: '6px 10px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  borderLeft: '3px solid #f59e0b',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Lock size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span><strong>Súkromná poznámka:</strong> {act.privateNote}</span>
                </div>
              )}

              {/* Footer s miestom a výbavou */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-dim)', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} /> {act.location || 'Klubová herňa'}
                </div>
                {act.addEquipmentWear && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399' }}>
                    <Layers size={12} /> +{act.durationMinutes} min k rakete
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* SSTZ Ligové zápasy (ak sme pod filtrom 'liga' alebo 'all') */}
        {relevantLeagueMatches.map(m => (
          <div
            key={m.id}
            className="glass-panel"
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              borderLeft: m.result === 'WIN' ? '4px solid #10b981' : '4px solid #ef4444'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span className="badge-pill badge-purple" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                  🛡️ SSTZ Liga
                </span>
                <span className={`badge-pill ${m.result === 'WIN' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                  {m.result === 'WIN' ? 'VÝHRA' : 'PREHRA'} {m.score}
                </span>
                {m.season && (
                  <span className="badge-pill badge-blue" style={{ fontSize: '0.65rem' }}>
                    {m.season}
                  </span>
                )}
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {m.date} {m.round && `(${m.round})`}
                </span>
              </div>

              <span className="badge-pill badge-blue" style={{ fontSize: '0.65rem' }}>
                SSTZ Overené
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Súper v dueli: </span>
                <strong style={{ fontSize: '0.95rem' }}>{m.opponentName}</strong>
              </div>
              {m.leagueName && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {m.leagueName}
                </span>
              )}
            </div>

            {/* Set Breakdown */}
            <SetBreakdown
              sets={m.sets || []}
              setDetails={m.setDetails}
              totalPointsWon={m.totalPointsWon}
              totalPointsLost={m.totalPointsLost}
              result={m.result}
              compact
            />

            {m.notes && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {m.notes}
              </div>
            )}
          </div>
        ))}

        {/* Prázdny stav */}
        {filteredActivities.length === 0 && relevantLeagueMatches.length === 0 && (
          <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
            <Activity size={36} color="var(--text-dim)" style={{ margin: '0 auto 10px auto' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px' }}>
              Žiadne aktivity pre kategóriu „{categoryFilter}“
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 16px auto' }}>
              Klikni na tlačidlo nižšie a zapíš svoj dnešný alebo predošlý tréning, zápas či podujatie.
            </p>
            <button
              onClick={() => setShowAddActivityModal(true)}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.85rem' }}
            >
              <Plus size={15} /> Pridať aktivitu
            </button>
          </div>
        )}

      </div>

      {/* Modal: Pridať aktivitu */}
      <AddActivityModal
        isOpen={showAddActivityModal}
        onClose={() => setShowAddActivityModal(false)}
        defaultCategory={categoryFilter !== 'all' ? categoryFilter : 'tréning'}
      />

      {/* Photo Preview Modal */}
      {selectedPhotoPreview && createPortal(
        <div
          onClick={() => setSelectedPhotoPreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'pointer'
          }}
        >
          <img
            src={selectedPhotoPreview}
            alt="Náhľad"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }}
          />
        </div>,
        document.body
      )}

    </div>
  );
};
