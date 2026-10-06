import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, CheckCircle2, Sparkles } from 'lucide-react';

interface PwaInstallPromptProps {
  compact?: boolean;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ compact = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(standaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Check if dismissed in session
    const dismissed = sessionStorage.getItem('spintrack_pwa_dismissed') === 'true';
    setIsDismissed(dismissed);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('spintrack_pwa_dismissed', 'true');
  };

  // If already running as installed standalone app, show subtle status badge if compact
  if (isStandalone) {
    if (compact) {
      return (
        <span
          className="badge-pill badge-green"
          style={{ fontSize: '0.68rem', padding: '2px 8px' }}
          title="Aplikácia beží ako nainštalovaná mobilná aplikácia"
        >
          <CheckCircle2 size={12} /> Aplikácia na ploche
        </span>
      );
    }
    return null;
  }

  // If compact button (for Header or Settings)
  if (compact) {
    if (!isInstallable && !isIos) return null;

    return (
      <button
        onClick={handleInstallClick}
        className="btn-primary"
        style={{
          padding: '6px 12px',
          fontSize: '0.75rem',
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
          boxShadow: '0 2px 10px rgba(14, 165, 233, 0.35)',
          whiteSpace: 'nowrap'
        }}
        title="Stiahnuť aplikáciu do telefónu"
      >
        <Download size={14} />
        <span>Stiahnuť aplikáciu</span>
      </button>
    );
  }

  // If banner was dismissed and not explicitly requested
  if (isDismissed || (!isInstallable && !isIos)) {
    return null;
  }

  return (
    <>
      <div
        className="animate-fade-in"
        style={{
          margin: '10px 16px 0 16px',
          padding: '14px 18px',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(18, 24, 36, 0.98) 100%)',
          border: '1px solid rgba(14, 165, 233, 0.35)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 45
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
          }}>
            <Smartphone size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                Nainštalovať SpinTrack SSTZ do mobilu
              </strong>
              <span className="badge-pill badge-blue" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                <Sparkles size={10} /> Mobilná Appka
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Pridaj si aplikáciu na plochu telefónu pre bleskový prístup, prácu offline a plný mobilný zážitok.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleInstallClick}
            className="btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
            }}
          >
            <Download size={14} />
            <span>Nainštalovať na plochu</span>
          </button>

          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-full)'
            }}
            title="Zavrieť"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosGuide && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 150,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <Share size={28} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
              Inštalácia na iPhone / iPad
            </h3>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '18px', textAlign: 'left', lineHeight: 1.6 }}>
              V prehliadači Safari na tvojom iPhone:
              <br /><br />
              1. Ťukni dole na ikonu <strong>Zdieľať</strong> (štvorec so šípkou hore <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />).
              <br />
              2. Prejdi v ponuke nižšie a vyber <strong>Pridať na plochu</strong> (Add to Home Screen 📲).
              <br />
              3. Vpravo hore ťukni na <strong>Pridať</strong>.
            </p>

            <button
              onClick={() => setShowIosGuide(false)}
              className="btn-primary"
              style={{ width: '100%', padding: '10px' }}
            >
              Rozumiem, mám to
            </button>
          </div>
        </div>
      )}
    </>
  );
};
