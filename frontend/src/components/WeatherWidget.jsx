import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Thermometer, Droplets } from 'lucide-react';

const WeatherWidget = ({ compact = false }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mock-Wetterdaten für verschiedene Wettertypen
  const mockWeatherData = [
    {
      condition: 'rain',
      temperature: 12,
      description: 'Regen',
      motivation: 'Perfekt für Indoor-Training! 💪',
      icon: CloudRain,
      color: '#3B82F6'
    },
    {
      condition: 'sunny',
      temperature: 25,
      description: 'Sonnig',
      motivation: 'Ideal für Training im Freien! ☀️',
      icon: Sun,
      color: '#F59E0B'
    },
    {
      condition: 'cloudy',
      temperature: 18,
      description: 'Bewölkt',
      motivation: 'Gemäßigtes Wetter - perfekt zum Trainieren! 🌤️',
      icon: Cloud,
      color: '#6B7280'
    },
    {
      condition: 'snow',
      temperature: -2,
      description: 'Schnee',
      motivation: 'Zeit für intensives Dojo-Training! ❄️',
      icon: CloudSnow,
      color: '#E5E7EB'
    },
    {
      condition: 'windy',
      temperature: 15,
      description: 'Windig',
      motivation: 'Training stärkt gegen jeden Wind! 💨',
      icon: Wind,
      color: '#8B5CF6'
    }
  ];

  // Lade Wetterdaten (Mock-Implementation)
  const loadWeather = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Simuliere API-Aufruf
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wähle zufälliges Wetter für Demo
      const randomWeather = mockWeatherData[Math.floor(Math.random() * mockWeatherData.length)];
      
      // Füge zusätzliche Details hinzu
      const weatherData = {
        ...randomWeather,
        humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
        windSpeed: Math.floor(Math.random() * 20) + 5, // 5-25 km/h
        location: 'Dojo Umgebung',
        lastUpdate: new Date().toLocaleTimeString('de-DE', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };
      
      setWeather(weatherData);
    } catch (err) {
      setError('Wetterdaten konnten nicht geladen werden');
      // Fallback-Wetter
      setWeather(mockWeatherData[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather();
  }, []);

  const getTrainingMotivation = (condition) => {
    const motivations = {
      rain: [
        "Regen macht stark! Perfekt für Indoor-Training! 💪",
        "Heute regnet es - perfekt für Training! 🌧️",
        "Wasser stärkt die Disziplin! Zeit für das Dojo! 💦"
      ],
      sunny: [
        "Sonnenschein gibt Energie für Training! ☀️",
        "Perfektes Wetter für alle Trainingsarten! 🌞",
        "Die Sonne lädt auf - Zeit für Kampfkunst! ☀️"
      ],
      cloudy: [
        "Gemäßigtes Wetter - ideal zum Trainieren! 🌤️",
        "Bewölkt aber nicht zu kalt - perfekt! ☁️",
        "Ruhiges Wetter fördert die Konzentration! 🌥️"
      ],
      snow: [
        "Schnee macht hart - Zeit für intensives Training! ❄️",
        "Kaltes Wetter stärkt den Geist! 🥶",
        "Winterzeit = Dojo-Zeit! ⛄"
      ],
      windy: [
        "Wind macht flexibel - perfekt für Training! 💨",
        "Stürmisches Wetter stärkt die Ausdauer! 🌪️",
        "Training gegen jeden Wind! 💪"
      ]
    };
    
    const conditionMotivations = motivations[condition] || motivations.cloudy;
    return conditionMotivations[Math.floor(Math.random() * conditionMotivations.length)];
  };

  if (loading) {
    return (
      <div className={`weather-widget ${compact ? 'compact' : ''}`}>
        <div className="weather-loading">
          <div className="loading-spinner"></div>
          <span>Lade Wetterdaten...</span>
        </div>
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className={`weather-widget ${compact ? 'compact' : ''}`}>
        <div className="weather-error">
          <Cloud size={20} />
          <span>Wetter nicht verfügbar</span>
        </div>
      </div>
    );
  }

  const WeatherIcon = weather.icon;

  return (
    <div className={`weather-widget ${compact ? 'compact' : ''}`}>
      <div className="weather-header">
        <div className="weather-main">
          <div className="weather-icon" style={{ color: weather.color }}>
            <WeatherIcon size={compact ? 20 : 24} />
          </div>
          <div className="weather-temp">
            <span className="temperature">{weather.temperature}°C</span>
            <span className="description">{weather.description}</span>
          </div>
        </div>
        <div className="weather-location">
          <span>{weather.location}</span>
        </div>
      </div>

      <div className="weather-motivation">
        <div className="motivation-text">
          {getTrainingMotivation(weather.condition)}
        </div>
      </div>

      {!compact && (
        <div className="weather-details">
          <div className="weather-detail">
            <Droplets size={14} />
            <span>{weather.humidity}%</span>
          </div>
          <div className="weather-detail">
            <Wind size={14} />
            <span>{weather.windSpeed} km/h</span>
          </div>
          <div className="weather-detail">
            <Thermometer size={14} />
            <span>{weather.lastUpdate}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;
