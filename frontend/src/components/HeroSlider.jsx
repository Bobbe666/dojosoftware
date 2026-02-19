import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './HeroSlider.css';

const SLIDES = [
  {
    webp: '/banners/hero-1.webp',
    fallback: '/banners/hero-1.png',
    alt: 'Endlich Ordnung im Verein - DojoSoftware Dashboard'
  },
  {
    webp: '/banners/hero-2.webp',
    fallback: '/banners/hero-2.png',
    alt: 'Die Dojo-Software die mit dir wächst'
  },
  {
    webp: '/banners/hero-3.webp',
    fallback: '/banners/hero-3.png',
    alt: 'Turniere, Mitglieder - Alles in einem System'
  },
  {
    webp: '/banners/hero-4.webp',
    fallback: '/banners/hero-4.png',
    alt: 'Teste 14 Tage kostenlos'
  }
];

const HeroSlider = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const trackRef = useRef(null);

  // Für unendliches Scrollen: Slides am Ende wiederholen
  const extendedSlides = [...SLIDES, ...SLIDES.slice(0, 3)];

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      // Wenn wir am Ende sind (nach dem 4. Original-Slide), reset
      if (next >= SLIDES.length) {
        setTimeout(() => {
          setIsTransitioning(false);
          setCurrentIndex(0);
          setTimeout(() => setIsTransitioning(true), 50);
        }, 600);
      }
      return next;
    });
  }, []);

  // Autoplay
  useEffect(() => {
    const interval = setInterval(nextSlide, 3500);
    return () => clearInterval(interval);
  }, [nextSlide]);

  // Berechne die Verschiebung (jedes Slide ist 33.333% breit)
  const slideWidth = 100 / 3;
  const translateX = currentIndex * slideWidth;

  return (
    <section className="hero-carousel">
      <div className="carousel-viewport">
        <div
          ref={trackRef}
          className={`carousel-track ${isTransitioning ? 'smooth' : ''}`}
          style={{ transform: `translateX(-${translateX}%)` }}
        >
          {extendedSlides.map((slide, index) => (
            <div
              key={index}
              className="carousel-item"
              onClick={() => navigate('/register')}
            >
              <picture>
                <source srcSet={slide.webp} type="image/webp" />
                <img
                  src={slide.fallback}
                  alt={slide.alt}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  draggable={false}
                />
              </picture>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSlider;
