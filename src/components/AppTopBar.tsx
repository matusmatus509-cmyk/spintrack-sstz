import React from 'react';
import { useApp } from '../context/AppContext';
import { Settings, ShieldCheck } from 'lucide-react';

interface AppTopBarProps {
  onOpenSettings: () => void;
}

export const AppTopBar: React.FC<AppTopBarProps> = ({ onOpenSettings }) => {
  const { sstzProfile } = useApp();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: 'rgba(10, 13, 20, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      height: '48px'
    }}>
      {/* Brand icon & name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '0.85rem'
        }}>
          ST
        </div>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
          SpinTrack <span style={{ color: '#10b981' }}>SSTZ</span>
        </span>
        {sstzProfile && (
          <span className="badge-pill badge-green d-none-xs" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
            <ShieldCheck size={10} /> {sstzProfile.name.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Right: Settings gear */}
      <button
        onClick={onOpenSettings}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'color 0.15s'
        }}
        title="Nastavenia"
      >
        <Settings size={18} />
      </button>
    </div>
  );
};
