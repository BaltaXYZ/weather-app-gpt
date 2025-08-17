/* Map integration for the weather app */
let map;
let marker;
let countryBBox = null;
let hoverTimeout;
let hoverAbortController;
let lastHoverFetch = 0;
const hoverCache = {};
const RATE_LIMIT = 800; // milliseconds between hover fetches
const HOVER_DELAY = 500; // delay before triggering hover fetch
let lastHoverLatLng;
let holdTimeout;
let holdStartEvent;

// Mapping weather codes to descriptions and icons for tooltip
const weatherCodeMap = {
  0: { text: "Soligt", icon: "wi-day-sunny" },
  1: { text: "Mest klart", icon: "wi-day-sunny-overcast" },
  2: { text: "Delvis molnigt", icon: "wi-day-cloudy" },
  3: { text: "Mulet", icon: "wi-cloudy" },
  45: { text: "Dimma", icon: "wi-fog" },
  48: { text: "Dimma", icon: "wi-fog" },
  51: { text: "Lätt duggregn", icon: "wi-sprinkle" },
  53: { text: "Duggregn", icon: "wi-sprinkle" },
  55: { text: "Kraftigt duggregn", icon: "wi-sprinkle" },
  56: { text: "Underkylt duggregn", icon: "wi-rain-mix" },
  57: { text: "Underkylt duggregn", icon: "wi-rain-mix" },
  61: { text: "Regn", icon: "wi-rain" },
  63: { text: "Regn", icon: "wi-rain" },
  65: { text: "Kraftigt regn", icon: "wi-rain" },
  66: { text: "Underkylt regn", icon: "wi-rain-mix" },
  67: { text: "Underkylt regn", icon: "wi-rain-mix" },
  71: { text: "Snöfall", icon: "wi-snow" },
  73: { text: "Snöfall", icon: "wi-snow" },
  75: { text: "Kraftigt snöfall", icon: "wi-snow" },
  77: { text: "Snöflingor", icon: "wi-snow" },
  80: { text: "Regnskurar", icon: "wi-showers" },
  81: { text: "Regnskurar", icon: "wi-showers" },
  82: { text: "Kraftiga skurar", icon: "wi-showers" },
  85: { text: "Snöbyar", icon: "wi-snow-wind" },
  86: { text: "Snöbyar", icon: "wi-snow-wind" },
  95: { text: "Åska", icon: "wi-thunderstorm" },
  96: { text: "Åska", icon: "wi-storm-showers" },
  99: { text: "Kraftig åska", icon: "wi-storm-showers" },
};

function initMap() {
  const mapElem = document.getElementById('map');
  if (!mapElem) return;
  map = L.map(mapElem).setView([62, 15], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);

  map.on('click', onMapClick);
  map.on('mousemove', onMapHover);
  map.on('mouseout', hideHoverTooltip);
  map.on('dragstart', hideHoverTooltip);

  // Touch events for mobile: tap and hold shows tooltip; short tap selects location
  map.on('touchstart', (e) => {
    holdStartEvent = e;
    if (holdTimeout) clearTimeout(holdTimeout);
    holdTimeout = setTimeout(() => {
      const latlng = e.latlng;
      lastHoverLatLng = latlng;
      performHoverWeather(latlng.lat, latlng.lng);
    }, HOVER_DELAY);
  });
  map.on('touchmove', () => {
    if (holdTimeout) clearTimeout(holdTimeout);
  });
  map.on('touchend', (e) => {
    if (holdTimeout) {
      clearTimeout(holdTimeout);
      // treat as normal tap
      onMapClick(holdStartEvent);
    }
  });

  const resetBtn = document.getElementById('reset-view');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (countryBBox) {
        map.fitBounds(countryBBox, { padding: [20, 20] });
      }
    });
  }
}

// Exposed function to select a location from search
async function selectLocation(lat, lon, name, country) {
  updateMarker(lat, lon, name);
  if (country) {
    try {
      const bbox = await fetchCountryBBox(country);
      if (bbox) {
        countryBBox = bbox;
        map.fitBounds(bbox, { padding: [20, 20] });
        const btn = document.getElementById('reset-view');
        if (btn) btn.style.display = 'inline-block';
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    map.setView([lat, lon], 7);
  }
  if (typeof fetchWeather === 'function') {
    fetchWeather(lat, lon);
  }
}

// Update marker and optional permanent label
function updateMarker(lat, lon, label) {
  if (!map) return;
  if (marker) marker.remove();
  marker = L.marker([lat, lon]).addTo(map);
  if (label) {
    marker.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10], className: 'weather-marker-label' }).openTooltip();
  }
}

// Fetch country's bounding box via Nominatim
async function fetchCountryBBox(country) {
  const url = `https://nominatim.openstreetmap.org/search?country=${encodeURIComponent(country)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'accept-language': 'sv' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (data && data.length > 0 && data[0].boundingbox) {
    const bb = data[0].boundingbox;
    const south = parseFloat(bb[0]);
    const north = parseFloat(bb[1]);
    const west = parseFloat(bb[2]);
    const east = parseFloat(bb[3]);
    return [[south, west], [north, east]];
  }
  return null;
}

// Map click handler: reverse geocode and select new location
async function onMapClick(e) {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  try {
    const loc = await reverseGeocode(lat, lon);
    const displayName = loc.displayName || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const country = loc.country || null;
    // update search input
    const input = document.getElementById('city-search');
    if (input) input.value = displayName;
    selectLocation(lat, lon, displayName, country);
  } catch (err) {
    console.error(err);
    selectLocation(lat, lon, null, null);
  }
}

// Reverse geocode via Nominatim to get location name and country
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const res = await fetch(url, { headers: { 'accept-language': 'sv' } });
  const data = await res.json();
  let name = null;
  let country = null;
  if (data && data.address) {
    const addr = data.address;
    name = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state || null;
    country = addr.country || null;
  }
  return { displayName: name, country };
}

// Hover handler: debounce and schedule weather fetch for hover
function onMapHover(e) {
  if (!map) return;
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  lastHoverLatLng = e.latlng;
  if (hoverTimeout) clearTimeout(hoverTimeout);
  if (hoverAbortController) hoverAbortController.abort();
  hoverTimeout = setTimeout(() => {
    performHoverWeather(lat, lon);
  }, HOVER_DELAY);
}

// Hide tooltip and abort hover fetch
function hideHoverTooltip() {
  if (hoverTimeout) clearTimeout(hoverTimeout);
  if (hoverAbortController) hoverAbortController.abort();
  if (map) map.closePopup();
}

// Perform hover weather fetch with rate limiting and caching
async function performHoverWeather(lat, lon) {
  const now = Date.now();
  if (now - lastHoverFetch < RATE_LIMIT) {
    return;
  }
  lastHoverFetch = now;
  const latKey = Math.round(lat * 10) / 10;
  const lonKey = Math.round(lon * 10) / 10;
  const dateKey = new Date().toISOString().split('T')[0];
  const cacheKey = `${latKey},${lonKey},${dateKey}`;
  if (hoverCache[cacheKey]) {
    showHoverPopup(L.latLng(lat, lon), hoverCache[cacheKey]);
    return;
  }
  hoverAbortController = new AbortController();
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`, { signal: hoverAbortController.signal });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.current_weather) return;
    const wc = data.current_weather.weathercode;
    const weather = weatherCodeMap[wc] || { text: "Okänt", icon: "wi-na" };
    const temp = data.current_weather.temperature;
    const wind = data.current_weather.windspeed || data.current_weather.wind_speed || data.current_weather.windspeed_10m || data.current_weather.wind_speed_10m || null;
    const weatherData = {
      text: weather.text,
      icon: weather.icon,
      temp,
      wind,
    };
    hoverCache[cacheKey] = weatherData;
    showHoverPopup(L.latLng(lat, lon), weatherData);
  } catch (err) {
    if (err.name !== 'AbortError') console.error(err);
  }
}

// Display hover tooltip using Leaflet popup
function showHoverPopup(latlng, info) {
  if (!map) return;
  const content = `
    <div class="weather-tooltip">
      <div style="display:flex; align-items:center; gap:8px;">
        <i class="weather-icon wi ${info.icon}" style="font-size:24px;"></i>
        <div>
          <div>${info.text}</div>
          <div>${info.temp}°C</div>
          <div>Vind: ${info.wind} m/s</div>
        </div>
      </div>
    </div>`;
  L.popup({ closeButton: false, autoClose: true, className: 'weather-popup' })
    .setLatLng(latlng)
    .setContent(content)
    .openOn(map);
}

// Initialize map when DOM loaded
document.addEventListener('DOMContentLoaded', initMap);

// Expose selectLocation globally so script.js can call it
window.selectLocation = selectLocation;
