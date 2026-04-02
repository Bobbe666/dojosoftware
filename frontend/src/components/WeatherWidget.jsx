import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Thermometer, Droplets } from 'lucide-react';

// WMO Weather Code → Icons & Labels
const mapWeatherCode = (code) => {
  if (code === 0)  return { condition: 'sunny',  icon: Sun,       color: 'var(--warning)', description: 'Sonnig' };
  if (code <= 2)   return { condition: 'sunny',  icon: Sun,       color: 'var(--warning)', description: 'Leicht bewölkt' };
  if (code === 3)  return { condition: 'cloudy', icon: Cloud,     color: '#6B7280',        description: 'Bedeckt' };
  if (code <= 48)  return { condition: 'cloudy', icon: Cloud,     color: '#6B7280',        description: 'Neblig' };
  if (code <= 57)  return { condition: 'rain',   icon: CloudRain, color: 'var(--info)',    description: 'Nieselregen' };
  if (code <= 67)  return { condition: 'rain',   icon: CloudRain, color: 'var(--info)',    description: 'Regen' };
  if (code <= 77)  return { condition: 'snow',   icon: CloudSnow, color: '#E5E7EB',        description: 'Schnee' };
  if (code <= 82)  return { condition: 'rain',   icon: CloudRain, color: 'var(--info)',    description: 'Regenschauer' };
  if (code <= 86)  return { condition: 'snow',   icon: CloudSnow, color: '#E5E7EB',        description: 'Schneeschauer' };
  return                  { condition: 'windy',  icon: Wind,      color: '#8B5CF6',        description: 'Gewitter' };
};

const getTrainingMotivation = (condition) => {
  const motivations = {
    rain:   ['Regen macht stark! Perfekt für Indoor-Training! 💪', 'Wasser stärkt die Disziplin! Zeit für das Dojo! 💦'],
    sunny:  ['Sonnenschein gibt Energie für Training! ☀️', 'Die Sonne lädt auf — Zeit für Kampfkunst! ☀️'],
    cloudy: ['Gemäßigtes Wetter — ideal zum Trainieren! 🌤️', 'Ruhiges Wetter fördert die Konzentration! 🌥️'],
    snow:   ['Schnee macht hart — Zeit für intensives Training! ❄️', 'Winterzeit = Dojo-Zeit! ⛄'],
    windy:  ['Training gegen jeden Wind! 💪', 'Stürmisches Wetter stärkt die Ausdauer! 🌪️'],
  };
  const list = motivations[condition] || motivations.cloudy;
  return list[Math.floor(Math.random() * list.length)];
};

const WeatherWidget = ({ compact = false }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadWeather = async () => {
    setLoading(true);
    setError(null);

    try {
      // Open-Meteo API — kostenlos, kein API-Key nötig
      // Koordinaten: Vilsbiburg (48.4456°N, 12.3594°E)
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast' +
        '?latitude=48.4456&longitude=12.3594' +
        '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m' +
        '&wind_speed_unit=kmh&timezone=Europe%2FBerlin'
      );
      if (!res.ok) throw new Error('API nicht erreichbar');
      const data = await res.json();
      const c = data.current;
      const mapped = mapWeatherCode(c.weather_code);

      setWeather({
        temperature: Math.round(c.temperature_2m),
        humidity: Math.round(c.relative_humidity_2m),
        windSpeed: Math.round(c.wind_speed_10m),
        ...mapped,
        location: 'Vilsbiburg',
        lastUpdate: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      setError('Wetterdaten nicht verfügbar');
      setWeather({
        temperature: '–',
        humidity: '–',
        windSpeed: '–',
        condition: 'cloudy',
        icon: Cloud,
        color: '#6B7280',
        description: 'Keine Verbindung',
        location: 'Vilsbiburg',
        lastUpdate: '–',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather();
  }, []);

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
          <div className="weather-icon" style={{ '--weather-color': weather.color }}>
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
