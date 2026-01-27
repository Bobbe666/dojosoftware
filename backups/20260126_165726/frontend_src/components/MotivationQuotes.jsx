import React, { useState, useEffect } from 'react';
import { Quote, RefreshCw } from 'lucide-react';

const MotivationQuotes = ({ showRefresh = true, compact = false }) => {
  const [currentQuote, setCurrentQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  // Motivationssprüche für Kampfkünste
  const quotes = [
    {
      text: "Der Weg ist das Ziel. Jeder Schritt bringt dich näher zu dir selbst.",
      author: "Bruce Lee",
      category: "Philosophie"
    },
    {
      text: "Disziplin ist die Brücke zwischen Zielen und Erfolg.",
      author: "Jim Rohn",
      category: "Disziplin"
    },
    {
      text: "Der beste Kampf ist der, der vermieden wird.",
      author: "Morihei Ueshiba",
      category: "Weisheit"
    },
    {
      text: "Nicht die Stärke, sondern die Ausdauer macht den Unterschied.",
      author: "Miyamoto Musashi",
      category: "Ausdauer"
    },
    {
      text: "Ein Meister ist jemand, der nie aufhört zu lernen.",
      author: "Gichin Funakoshi",
      category: "Lernen"
    },
    {
      text: "Die größte Stärke liegt in der Ruhe des Geistes.",
      author: "Lao Tzu",
      category: "Mentalität"
    },
    {
      text: "Jeder Tag ist eine neue Chance, besser zu werden.",
      author: "Anonym",
      category: "Motivation"
    },
    {
      text: "Der Körper folgt dem Geist. Trainiere beides.",
      author: "O-Sensei",
      category: "Training"
    },
    {
      text: "Respekt ist das Fundament aller Kampfkünste.",
      author: "Traditionell",
      category: "Werte"
    },
    {
      text: "Fall siebenmal auf, steh achtmal auf.",
      author: "Japanisches Sprichwort",
      category: "Durchhaltevermögen"
    },
    {
      text: "Heute ist perfekt für Training - egal wie das Wetter ist!",
      author: "Dojo Weisheit",
      category: "Motivation"
    },
    {
      text: "Jede Stunde Training bringt dich näher zu deinem Ziel.",
      author: "Sensei",
      category: "Fortschritt"
    },
    {
      text: "Die Kunst liegt nicht im Perfektsein, sondern im Besserwerden.",
      author: "Kampfkunst Weisheit",
      category: "Verbesserung"
    },
    {
      text: "Stille Wasser sind tief. Trainiere mit Geduld.",
      author: "Zen Weisheit",
      category: "Geduld"
    },
    {
      text: "Ein Gürtel ist nur ein Stoff. Der wahre Meister ist in dir.",
      author: "Moderne Weisheit",
      category: "Selbstverwirklichung"
    }
  ];

  // Lade aktuelles Zitat basierend auf dem Datum
  const loadDailyQuote = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const quoteIndex = dayOfYear % quotes.length;
    setCurrentQuote(quotes[quoteIndex]);
  };

  // Lade zufälliges Zitat
  const loadRandomQuote = () => {
    setLoading(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * quotes.length);
      setCurrentQuote(quotes[randomIndex]);
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    loadDailyQuote();
  }, []);

  if (!currentQuote) {
    return (
      <div className={`motivation-quotes ${compact ? 'compact' : ''}`}>
        <div className="quote-loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`motivation-quotes ${compact ? 'compact' : ''}`}>
      <div className="quote-header">
        <div className="quote-icon">
          <Quote size={compact ? 16 : 20} />
        </div>
        <h3>Motivation des Tages</h3>
        {showRefresh && (
          <button 
            className="refresh-button"
            onClick={loadRandomQuote}
            disabled={loading}
            title="Neues Zitat laden"
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          </button>
        )}
      </div>
      
      <div className="quote-content">
        <blockquote className="quote-text">
          "{currentQuote.text}"
        </blockquote>
        <div className="quote-meta">
          <cite className="quote-author">— {currentQuote.author}</cite>
          <span className="quote-category">{currentQuote.category}</span>
        </div>
      </div>
    </div>
  );
};

export default MotivationQuotes;
