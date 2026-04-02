import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './HeroSlider.css';

const SLIDES = [
  {
    image: '/banners/hero-1.png',
    alt: 'Endlich Ordnung im Verein - DojoSoftware Dashboard'
  },
  {
    image: '/banners/hero-2.png',
    alt: 'Die Dojo-Software die mit dir wächst'
  },
  {
    image: '/banners/hero-3.png',
    alt: 'Turniere, Mitglieder - Alles in einem System'
  },
  {
    image: '/banners/hero-4.png',
    alt: 'Teste 14 Tage kostenlos'
  }
];

const HeroSlider = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  }, []);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // Resume autoplay after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  // Autoplay
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide]);

  return (
    <section className="hero-slider">
      <div className="slider-container">
        {/* Slides */}
        <div
          className="slides-wrapper"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {SLIDES.map((slide, index) => (
            <div
              key={index}
              className={`slide ${index === currentSlide ? 'active' : ''}`}
              onClick={() => navigate('/register')}
            >
              <img
                src={slide.image}
                alt={slide.alt}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        {/* Dots Navigation */}
        <div className="slider-dots">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              className={`dot ${index === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Gehe zu Bild ${index + 1}`}
            />
          ))}
        </div>

        {/* CTA Overlay */}
        <div className="slider-cta">
          <button
            className="cta-button primary"
            onClick={() => navigate('/register')}
          >
            Jetzt kostenlos testen
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSlider;
