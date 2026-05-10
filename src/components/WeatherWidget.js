import React, { useEffect, useState, useCallback } from 'react';
import { fetchWeather, reverseGeocode, decodeWMO, assessRisk, riskMeta, windDirectionLabel, FALLBACK_COORDS } from '../services/weatherService';
import '../styles/shared/WeatherWidget.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt(num, decimals = 0) {
  if (num == null) return '—';
  return Number(num).toFixed(decimals);
}

function getDay(dateStr, idx) {
  if (idx === 0) return 'Today';
  if (idx === 1) return 'Tomorrow';
  return DAY_LABELS[new Date(dateStr).getDay()];
}

// ── Preparedness tip strip based on risk ────────────────────────────────────
function PreparednessTips({ risk }) {
  const tips = {
    none: [],
    low: [
      'Monitor official PAGASA weather bulletins.',
      'Check that drainage around your home is clear.',
    ],
    medium: [
      'Secure loose items and outdoor furniture.',
      'Refill household water containers as a precaution.',
      'Know your nearest evacuation center.',
      'Keep phones charged and power banks ready.',
    ],
    high: [
      'Prepare a 72-hour go-bag for every family member.',
      'Relocate valuables to higher floors if near a flood zone.',
      'Identify and confirm your nearest evacuation center.',
      'Check on elderly and mobility-impaired neighbours.',
      'Avoid crossing flooded roads — turn back, don\'t drown.',
    ],
    critical: [
      '⚠️ Consider pre-emptive evacuation if in a flood-prone barangay.',
      'Report hazards and block roads to barangay officials immediately.',
      'Avoid all unnecessary travel.',
      'Monitor the eLikas alert feed for real-time updates.',
      'Keep a battery-powered or wind-up radio for updates if power cuts.',
    ],
  };
  const list = tips[risk] || [];
  if (list.length === 0) return null;
  return (
    <ul className="ww-tips-list">
      {list.map((tip) => <li key={tip}>{tip}</li>)}
    </ul>
  );
}

// ── Main widget ──────────────────────────────────────────────────────────────
function WeatherWidget({ compact = false }) {
  const [weather, setWeather]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [gpsState, setGpsState]   = useState('pending'); // pending | granted | denied | unsupported
  const [coords, setCoords]       = useState(null);      // { lat, lon }
  const [locationLabel, setLocationLabel] = useState(FALLBACK_COORDS.label);
  const [error, setError]         = useState('');
  const [lastFetch, setLastFetch] = useState(null);

  const loadWeather = useCallback(async (coordsToUse) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWeather(coordsToUse || {});
      setWeather(data);
      setLastFetch(new Date());
    } catch (err) {
      setError('Could not load weather data. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState('unsupported');
      setLocationLabel(FALLBACK_COORDS.label);
      loadWeather(null);
      return;
    }

    setLoading(true);
    setGpsState('pending');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        setGpsState('granted');
        // Reverse-geocode in parallel with weather fetch
        const [label] = await Promise.all([
          reverseGeocode(lat, lon),
          loadWeather({ lat, lon }),
        ]);
        if (label) setLocationLabel(label);
        else setLocationLabel(`${lat.toFixed(4)}° N, ${Math.abs(lon).toFixed(4)}° E`);
      },
      () => {
        // Permission denied or unavailable — fall back silently
        setGpsState('denied');
        setLocationLabel(FALLBACK_COORDS.label);
        loadWeather(null);
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [loadWeather]);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  if (loading) {
    return (
      <div className="ww-card ww-loading">
        <div className="ww-spinner" aria-label="Loading weather" />
        <span>{gpsState === 'pending' ? 'Detecting your location…' : 'Fetching weather data…'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ww-card ww-error-state">
        <span className="ww-error-icon">⚠️</span>
        <p>{error}</p>
        <button type="button" className="ww-retry" onClick={requestLocation}>Retry</button>
      </div>
    );
  }

  const cur  = weather.current;
  const daily = weather.daily;

  const code = cur.weathercode;
  const wmo  = decodeWMO(code);
  const risk = assessRisk({
    weathercode:   code,
    rain:          cur.rain,
    windspeed:     cur.windspeed_10m,
    precipitation: cur.precipitation,
  });
  const rm = riskMeta(risk);

  return (
    <div className={`ww-card risk-${risk}`}>
      {/* Header */}
      <div className="ww-header">
        <div className="ww-location">
          <span className="material-symbols-outlined ww-loc-icon" aria-hidden="true">location_on</span>
          <span>{locationLabel}</span>
          {gpsState === 'granted' && <span className="ww-gps-badge" title="Using your GPS location">GPS</span>}
          {(gpsState === 'denied' || gpsState === 'unsupported') && (
            <span className="ww-gps-badge" style={{ background: 'var(--sent-warning-soft, #fef3c7)', color: 'var(--sent-warning, #92400e)', border: '1px solid var(--sent-warning, #fbbf24)', marginLeft: '0.25rem' }} title="Showing default location weather — GPS not available">Default</span>
          )}
          {gpsState === 'denied' && (
            <button type="button" className="ww-gps-request" onClick={requestLocation} title="Enable GPS for local forecast">
              Enable GPS
            </button>
          )}
        </div>
        <div className="ww-header-right">
          {lastFetch && <span className="ww-updated">Updated {lastFetch.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button type="button" className="ww-refresh" onClick={requestLocation} aria-label="Refresh weather">↻</button>
        </div>
      </div>

      {/* Current conditions */}
      <div className="ww-current">
        <div className="ww-main-temp">
          <span className="ww-icon" aria-hidden="true">{wmo.icon}</span>
          <div>
            <span className="ww-temp">{fmt(cur.temperature_2m)}°C</span>
            <span className="ww-condition">{wmo.label}</span>
          </div>
        </div>

        <div className="ww-stats-grid">
          <div className="ww-stat">
            <span className="ww-stat-label">Feels Like</span>
            <span className="ww-stat-val">{fmt(cur.apparent_temperature)}°C</span>
          </div>
          <div className="ww-stat">
            <span className="ww-stat-label">Humidity</span>
            <span className="ww-stat-val">{fmt(cur.relative_humidity_2m)}%</span>
          </div>
          <div className="ww-stat">
            <span className="ww-stat-label">Rain (1h)</span>
            <span className="ww-stat-val">{fmt(cur.rain, 1)} mm</span>
          </div>
          <div className="ww-stat">
            <span className="ww-stat-label">Wind</span>
            <span className="ww-stat-val">{fmt(cur.windspeed_10m)} km/h {windDirectionLabel(cur.winddirection_10m)}</span>
          </div>
        </div>
      </div>

      {/* Risk banner */}
      <div className={`ww-risk-banner risk-bg-${risk}`}>
        <div className="ww-risk-left">
          <span className="ww-risk-label">Preparedness Risk</span>
          <span className={`ww-risk-pill risk-pill-${risk}`}>{rm.label}</span>
        </div>
        <p className="ww-risk-advice">{rm.advice}</p>
      </div>

      {/* Preparedness tips — hidden in compact mode */}
      {!compact && risk !== 'none' && (
        <div className="ww-tips">
          <h4 className="ww-tips-title">
            <span className="material-symbols-outlined" aria-hidden="true">checklist</span>
            Action Checklist
          </h4>
          <PreparednessTips risk={risk} />
        </div>
      )}

      {/* 7-day forecast */}
      {!compact && (
        <div className="ww-forecast">
          <h4 className="ww-forecast-title">7-Day Outlook</h4>
          <div className="ww-forecast-strip">
            {daily.time.map((date, i) => {
              const dayWmo  = decodeWMO(daily.weathercode[i]);
              const dayRisk = assessRisk({
                weathercode:   daily.weathercode[i],
                precipitation: daily.precipitation_sum[i],
                windspeed:     daily.windspeed_10m_max[i],
              });
              return (
                <div key={date} className={`ww-day-card risk-day-${dayRisk}`}>
                  <span className="ww-day-name">{getDay(date, i)}</span>
                  <span className="ww-day-icon" aria-label={dayWmo.label}>{dayWmo.icon}</span>
                  <div className="ww-day-temps">
                    <span className="ww-day-hi">{fmt(daily.temperature_2m_max[i])}°</span>
                    <span className="ww-day-lo">{fmt(daily.temperature_2m_min[i])}°</span>
                  </div>
                  <div className="ww-day-precip">
                    <span>💧 {fmt(daily.precipitation_probability_max[i])}%</span>
                    <span className="ww-day-mm">{fmt(daily.precipitation_sum[i], 1)}mm</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact mode: show forecast inline */}
      {compact && (
        <div className="ww-forecast-compact">
          {daily.time.slice(0, 5).map((date, i) => {
            const dayWmo = decodeWMO(daily.weathercode[i]);
            return (
              <div key={date} className="ww-compact-day">
                <span className="ww-compact-name">{getDay(date, i)}</span>
                <span className="ww-compact-icon">{dayWmo.icon}</span>
                <span className="ww-compact-temp">{fmt(daily.temperature_2m_max[i])}°</span>
                <span className="ww-compact-rain">💧{fmt(daily.precipitation_probability_max[i])}%</span>
              </div>
            );
          })}
        </div>
      )}

      <p className="ww-source">Source: Open-Meteo · Nominatim{coords ? ` · ${coords.lat.toFixed(4)}°N ${coords.lon.toFixed(4)}°E` : ' · Fallback location'}</p>
    </div>
  );
}

export default WeatherWidget;
