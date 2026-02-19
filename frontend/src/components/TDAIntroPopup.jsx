/**
 * TDA Systems Intro Popup - Cinematic Edition
 * Elegante, filmreife Animation
 */

import React, { useState, useEffect, useMemo } from 'react';
import './TDAIntroPopup.css';

const TDAIntroPopup = ({ onComplete }) => {
  const [phase, setPhase] = useState('entering');

  // Weniger Partikel für eleganteres, dezenteres Erscheinungsbild
  const particles = useMemo(() => {
    return [...Array(15)].map((_, i) => ({
      id: i,
      x: `${20 + Math.random() * 60}%`,
      y: `${30 + Math.random() * 40}%`,
      dx: (Math.random() - 0.5) * 150,
      dy: (Math.random() - 0.5) * 150,
      delay: `${Math.random() * 3}s`,
      duration: `${3 + Math.random() * 3}s`
    }));
  }, []);

  useEffect(() => {
    // Einflug: 1.5s
    const enterTimer = setTimeout(() => {
      setPhase('visible');
    }, 1500);

    // Sichtbar: 1s (total: 2.5s)
    const visibleTimer = setTimeout(() => {
      setPhase('exiting');
    }, 2500);

    // Exit: 1s (total: 3.5s)
    const exitTimer = setTimeout(() => {
      setPhase('done');
      if (onComplete) onComplete();
    }, 3500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(visibleTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div className={`tda-intro-overlay ${phase}`}>
      <div className="tda-intro-backdrop" />
      <div className="tda-intro-content">
        <div className="tda-intro-glow" />
        <img
          src="/tda-systems-logo.png"
          alt="by TDA Systems"
          className="tda-intro-logo"
        />
        <div className="tda-intro-particles">
          {particles.map((p) => (
            <div
              key={p.id}
              className="particle"
              style={{
                '--x': p.x,
                '--y': p.y,
                '--dx': p.dx,
                '--dy': p.dy,
                '--delay': p.delay,
                '--duration': p.duration
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TDAIntroPopup;
