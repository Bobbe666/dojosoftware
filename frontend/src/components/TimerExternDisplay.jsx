import { useEffect, useState, useRef } from 'react';

const STORAGE_KEY = 'dojo_timer_extern';

const formatSek = (sek) => {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function TimerExternDisplay() {
  const [state, setState] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Auto-Vollbild versuchen (klappt wenn als Popup geöffnet via user gesture)
    const tryFullscreen = () => {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    };
    tryFullscreen();

    // Vollbild-Statusänderung verfolgen
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);

    // Initialer Ladeversuch
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { try { setState(JSON.parse(raw)); } catch {} }

    // Auf Änderungen aus anderem Tab reagieren
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setState(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    // Fallback-Polling für gleichen Tab (falls nötig)
    intervalRef.current = setInterval(() => {
      const r = localStorage.getItem(STORAGE_KEY);
      if (r) { try { setState(prev => {
        const next = JSON.parse(r);
        if (!prev || next.ts !== prev.ts) return next;
        return prev;
      }); } catch {} }
    }, 500);

    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('fullscreenchange', onFsChange);
      clearInterval(intervalRef.current);
    };
  }, []);

  const isArbeiten = state?.phase === 'runde';
  const isPause = state?.phase === 'pause' || state?.phase === 'blockpause';
  const isFertig = state?.phase === 'fertig';
  const isBereit = !state || state.phase === 'bereit';

  const color = isFertig ? '#ffd700' : isArbeiten ? '#4ade80' : isPause ? '#f87171' : '#888';
  const glowColor = isFertig ? 'rgba(255,215,0,0.3)' : isArbeiten ? 'rgba(74,222,128,0.3)' : isPause ? 'rgba(248,113,113,0.3)' : 'transparent';
  const bgColor = isFertig ? 'rgba(255,215,0,0.04)' : isArbeiten ? 'rgba(74,222,128,0.04)' : isPause ? 'rgba(248,113,113,0.04)' : 'transparent';

  const progress = state && state.phase !== 'bereit' && state.phase !== 'fertig'
    ? Math.max(0, Math.min(1, state.sekundenLeft / (
        state.phase === 'runde' ? (state.rundenzeit || 1)
        : state.phase === 'blockpause' ? 60
        : (state.pausezeit || 1)
      )))
    : 0;

  const phaseLabel = isBereit ? 'Bereit'
    : isFertig ? 'Fertig'
    : isArbeiten ? 'ARBEITEN'
    : 'PAUSE';

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: 'none', overflow: 'hidden',
      transition: 'background 0.5s',
      backgroundColor: bgColor,
    }}>

      {/* Phase-Label */}
      <div style={{
        fontSize: 'clamp(2rem, 6vw, 4rem)',
        fontWeight: 900,
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color,
        textShadow: `0 0 40px ${glowColor}`,
        marginBottom: '1rem',
        transition: 'color 0.5s, text-shadow 0.5s',
      }}>
        {phaseLabel}
      </div>

      {/* Block-Name + Runde */}
      {state && !isBereit && !isFertig && (
        <div style={{
          fontSize: 'clamp(1.2rem, 3vw, 2rem)',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '2rem',
          letterSpacing: '0.1em',
          fontWeight: 500,
        }}>
          {state.blockName && `${state.blockName} · `}
          Runde {state.aktuelleRunde} / {state.totalRunden}
        </div>
      )}

      {/* Countdown */}
      <div style={{
        fontSize: 'clamp(8rem, 28vw, 22rem)',
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
        color,
        textShadow: `0 0 80px ${glowColor}, 0 0 160px ${glowColor}`,
        transition: 'color 0.5s, text-shadow 0.5s',
        letterSpacing: '-0.02em',
      }}>
        {isBereit ? '–:––' : isFertig ? '00:00' : formatSek(state.sekundenLeft)}
      </div>

      {/* Fortschrittsbalken */}
      {!isBereit && !isFertig && (
        <div style={{
          width: '80vw', maxWidth: '1200px',
          height: '12px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '999px',
          marginTop: '4rem',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: color,
            borderRadius: '999px',
            boxShadow: `0 0 20px ${glowColor}`,
            transition: 'width 0.9s linear, background 0.5s',
          }} />
        </div>
      )}

      {isFertig && (
        <div style={{
          marginTop: '3rem',
          fontSize: 'clamp(1.5rem, 4vw, 3rem)',
          color: '#ffd700',
          fontWeight: 700,
          letterSpacing: '0.1em',
        }}>
          ✓ TRAINING ABGESCHLOSSEN
        </div>
      )}

      {isBereit && (
        <div style={{
          marginTop: '3rem',
          fontSize: 'clamp(1rem, 2.5vw, 1.8rem)',
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.15em',
        }}>
          Warte auf Timer-Start…
        </div>
      )}

      {/* Nächstes */}
      {state?.next && !isFertig && !isBereit && (
        <div style={{
          position: 'fixed',
          bottom: '3.5rem',
          left: 0, right: 0,
          textAlign: 'center',
          fontSize: 'clamp(1rem, 2.5vw, 1.8rem)',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.08em',
          fontWeight: 500,
        }}>
          Nächstes:&nbsp;
          <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
            {state.next.label}
            {state.next.dauer != null && ` · ${formatSek(state.next.dauer)}`}
          </span>
        </div>
      )}

      {/* Uhrzeit klein unten */}
      <Clock />

      {/* Vollbild-Button (nur sichtbar wenn nicht im Vollbild) */}
      {!isFullscreen && (
        <button
          onClick={() => document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})}
          style={{
            position: 'fixed', bottom: '1.5rem', left: '2rem',
            padding: '0.4rem 1rem', borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem',
            cursor: 'pointer', fontWeight: 600,
          }}>
          ⛶ Vollbild
        </button>
      )}
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '2rem',
      fontSize: '1.5rem', color: 'rgba(255,255,255,0.2)',
      fontWeight: 600, letterSpacing: '0.1em',
    }}>
      {time}
    </div>
  );
}
