import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import {
  X,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Check,
  Copy,
  Info,
  Smartphone
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { exportData, importData, resetToDefaults } = useApp();
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportDownload = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spintrack-sstz-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCopy = () => {
    const data = exportData();
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    const ok = importData(importText.trim());
    if (ok) {
      setImportStatus('Dáta boli úspešne obnovené!');
      setTimeout(() => {
        setImportStatus(null);
        onClose();
      }, 1500);
    } else {
      setImportStatus('Chyba: Neplatný formát JSON zálohy.');
    }
  };

  const handleReset = () => {
    if (window.confirm('Naozaj chceš vymazať všetky údaje a vrátiť aplikáciu do predvoleného stavu?')) {
      resetToDefaults();
      onClose();
    }
  };

  return (
    <div
      className="mobile-sheet-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '20px'
      }}
    >
      <div
        className="glass-panel mobile-sheet-content"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Nastavenia & Záloha</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* PWA Mobile App Section */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(18, 24, 36, 0.95) 100%)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          border: '1px solid rgba(14, 165, 233, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
            <Smartphone size={16} /> Mobilná webová aplikácia (PWA)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Nainštaluj si SpinTrack priamo na plochu smartfónu. Aplikácia sa otvorí bez líšt prehliadača v samostatnom okne a funguje aj bez internetového pripojenia.
          </p>
          <div>
            <PwaInstallPrompt compact />
          </div>
        </div>

        {/* Export Section */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} color="#10b981" /> Zálohovanie údajov (Export)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Stiahni si kompletnú zálohu svojich rakiet, poťahov, tréningov a SSTZ zápasov do JSON súboru.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={handleExportDownload}
              className="btn-primary"
              style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            >
              <Download size={14} /> Stiahnuť JSON
            </button>
            <button
              onClick={handleExportCopy}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Skopírované!' : 'Kopírovať do schránky'}
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={16} color="#38bdf8" /> Obnovenie údajov (Import)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Vlož text JSON zálohy a obnov svoje predchádzajúce záznamy.
          </p>

          <textarea
            rows={3}
            placeholder="Vlož JSON sem..."
            value={importText}
            onChange={e => setImportText(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(10, 13, 20, 0.6)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)'
            }}
          />

          {importStatus && (
            <div style={{
              fontSize: '0.8rem',
              color: importStatus.includes('Chyba') ? '#f87171' : '#34d399',
              fontWeight: 600
            }}>
              {importStatus}
            </div>
          )}

          <button
            onClick={handleImportSubmit}
            className="btn-secondary"
            style={{ alignSelf: 'flex-start', fontSize: '0.82rem' }}
          >
            Obnoviť dáta
          </button>
        </div>

        {/* Reset Section */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f87171' }}>Vynulovanie aplikácie</h4>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Vymaže lokálne úložisko a nastaví predvolené vzorové dáta.
            </span>
          </div>

          <button
            onClick={handleReset}
            className="btn-danger"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        {/* App Info Footer */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center' }}>
          <strong>SpinTrack SSTZ v1.0.0</strong> • Inšpirované aplikáciou SpinTrack (RubberApp) s priamou integráciou oficiálneho systému SSTZ Slovensko.
        </div>
      </div>
    </div>
  );
};
