// version 7

const cityInput = document.getElementById("city-search");
const suggestionsList = document.getElementById("suggestions");

let debounceTimeout;

// Autocomplete med Open-Meteo geokoding (oförändrad logik)
cityInput.addEventListener("input", () => {
  const query = cityInput.value.trim();
  clearTimeout(debounceTimeout);

  if (query.length < 3) {
    suggestionsList.innerHTML = "";
    suggestionsList.style.display = "none";
    return;
  }

  debounceTimeout = setTimeout(() => {
    searchCities(query);
  }, 300);
});

async function searchCities(query) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=sv&format=json`
    );
    if (!res.ok) throw new Error("Kunde inte hämta städer");
    const data = await res.json();

    suggestionsList.innerHTML = "";
    if (!data.results || data.results.length === 0) {
      suggestionsList.style.display = "none";
      return;
    }

    data.results.forEach(city => {
      const li = document.createElement("li");
      li.textContent = `${city.name}, ${city.country}`;
      li.addEventListener("click", () => {
        cityInput.value = city.name;
        suggestionsList.innerHTML = "";
        suggestionsList.style.display = "none";
        // Om kartan är initierad använd selectLocation, annars hämta bara väder
        if (typeof window.selectLocation === 'function') {
          window.selectLocation(city.latitude, city.longitude, city.name, city.country);
        } else {
          fetchWeather(city.latitude, city.longitude);
        }
      });
      suggestionsList.appendChild(li);
    });

    suggestionsList.style.display = "block";
  } catch (err) {
    console.error(err);
  }
}

async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max&current_weather=true&timezone=auto`
    );
    if (!res.ok) throw new Error("Kunde inte hämta väderdata");
    const data = await res.json();

    renderWeather(data);
  } catch (err) {
    console.error(err);
  }
}

function renderWeather(data) {
  const todayTemp = document.getElementById("today-temp");
  const todayWeather = document.getElementById("today-weather");
  const todayWind = document.getElementById("today-wind");
  const todayIcon = document.getElementById("today-icon");

  const tomorrowTemp = document.getElementById("tomorrow-temp");
  const tomorrowWeather = document.getElementById("tomorrow-weather");
  const tomorrowWind = document.getElementById("tomorrow-wind");
  const tomorrowIcon = document.getElementById("tomorrow-icon");

  const weatherCodeMap = {
    0: { text: "Soligt", icon: "wi-day-sunny", bg: "--bg-sunny" },
    1: { text: "Mest klart", icon: "wi-day-sunny-overcast", bg: "--bg-partly" },
    2: { text: "Delvis molnigt", icon: "wi-day-cloudy", bg: "--bg-partly" },
    3: { text: "Mulet", icon: "wi-cloudy", bg: "--bg-overcast" },
    45: { text: "Dimma", icon: "wi-fog", bg: "--bg-mostly-cloudy" },
    48: { text: "Dimma", icon: "wi-fog", bg: "--bg-mostly-cloudy" },
    51: { text: "Lätt duggregn", icon: "wi-sprinkle", bg: "--bg-mostly-cloudy" },
    53: { text: "Duggregn", icon: "wi-sprinkle", bg: "--bg-mostly-cloudy" },
    55: { text: "Kraftigt duggregn", icon: "wi-sprinkle", bg: "--bg-mostly-cloudy" },
    56: { text: "Underkylt duggregn", icon: "wi-rain-mix", bg: "--bg-mostly-cloudy" },
    57: { text: "Underkylt duggregn", icon: "wi-rain-mix", bg: "--bg-mostly-cloudy" },
    61: { text: "Regn", icon: "wi-rain", bg: "--bg-mostly-cloudy" },
    63: { text: "Regn", icon: "wi-rain", bg: "--bg-mostly-cloudy" },
    65: { text: "Kraftigt regn", icon: "wi-rain", bg: "--bg-mostly-cloudy" },
    66: { text: "Underkylt regn", icon: "wi-rain-mix", bg: "--bg-mostly-cloudy" },
    67: { text: "Underkylt regn", icon: "wi-rain-mix", bg: "--bg-mostly-cloudy" },
    71: { text: "Snöfall", icon: "wi-snow", bg: "--bg-mostly-cloudy" },
    73: { text: "Snöfall", icon: "wi-snow", bg: "--bg-mostly-cloudy" },
    75: { text: "Kraftigt snöfall", icon: "wi-snow", bg: "--bg-mostly-cloudy" },
    77: { text: "Snöflingor", icon: "wi-snow", bg: "--bg-mostly-cloudy" },
    80: { text: "Regnskurar", icon: "wi-showers", bg: "--bg-mostly-cloudy" },
    81: { text: "Regnskurar", icon: "wi-showers", bg: "--bg-mostly-cloudy" },
    82: { text: "Kraftiga skurar", icon: "wi-showers", bg: "--bg-mostly-cloudy" },
    85: { text: "Snöbyar", icon: "wi-snow-wind", bg: "--bg-mostly-cloudy" },
    86: { text: "Snöbyar", icon: "wi-snow-wind", bg: "--bg-mostly-cloudy" },
    95: { text: "Åska", icon: "wi-thunderstorm", bg: "--bg-mostly-cloudy" },
    96: { text: "Åska", icon: "wi-storm-showers", bg: "--bg-mostly-cloudy" },
    99: { text: "Kraftig åska", icon: "wi-storm-showers", bg: "--bg-mostly-cloudy" }
  };

  // Idag
  const todayCode = data.daily.weathercode[0];
  const tW = weatherCodeMap[todayCode] || { text: "Okänt", icon: "wi-na", bg: "--bg-overcast" };
  todayIcon.className = `weather-icon wi ${tW.icon}`;
  todayTemp.textContent = `${data.daily.temperature_2m_max[0]}° / ${data.daily.temperature_2m_min[0]}°`;
  todayWeather.textContent = tW.text;
  todayWind.textContent = `Vind: ${data.daily.windspeed_10m_max[0]} m/s`;

  // Imorgon
  const tomorrowCode = data.daily.weathercode[1];
  const tmW = weatherCodeMap[tomorrowCode] || { text: "Okänt", icon: "wi-na", bg: "--bg-overcast" };
  tomorrowIcon.className = `weather-icon wi ${tmW.icon}`;
  tomorrowTemp.textContent = `${data.daily.temperature_2m_max[1]}° / ${data.daily.temperature_2m_min[1]}°`;
  tomorrowWeather.textContent = tmW.text;
  tomorrowWind.textContent = `Vind: ${data.daily.windspeed_10m_max[1]} m/s`;

  // Uppdatera gradientens bottenfärg
  document.documentElement.style.setProperty("--grad-bottom", `var(${tW.bg})`);
}

// Initiera autolokalisering vid sidladdning
function initAutoLocate() {
  // Kontrollera om vi nyligen cache: om vald plats finns i localStorage (<24h)
  try {
    const cached = JSON.parse(localStorage.getItem('autoLocateCache') || 'null');
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      // använd cache
      const { lat, lon, displayName, country } = cached;
      // uppdatera sökfält
      const input = document.getElementById('city-search');
      if (input && displayName) input.value = displayName;
      if (typeof window.selectLocation === 'function') {
        window.selectLocation(lat, lon, displayName, country);
      } else {
        fetchWeather(lat, lon);
      }
      return;
    }
  } catch (e) {
    console.error(e);
  }

  // Försök med geolocation
  const geoTimeout = 6000;
  const options = { enableHighAccuracy: false, timeout: geoTimeout, maximumAge: 600000 };

  function handlePosition(lat, lon) {
    // Reverse-geokoda för att få platsnamn (använd global reverseGeocode om finns)
    (async () => {
      let displayName = null;
      let country = null;
      try {
        if (typeof window.reverseGeocode === 'function') {
          const loc = await window.reverseGeocode(lat, lon);
          displayName = loc.displayName;
          country = loc.country;
        }
      } catch (e) {
        console.error(e);
      }
      // Om inget namn: hämta via Nominatim direkt
      if (!displayName) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, { headers: { 'accept-language': 'sv' } });
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            displayName = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state || null;
            country = addr.country || null;
          }
        } catch (err) {
          console.error(err);
        }
      }
      // Uppdatera sökfält
      const input = document.getElementById('city-search');
      if (input && displayName) input.value = displayName;
      // Spara cache
      try {
        localStorage.setItem('autoLocateCache', JSON.stringify({ lat, lon, displayName, country, timestamp: Date.now() }));
      } catch (err) {
        console.error(err);
      }
      // Välj plats
      if (typeof window.selectLocation === 'function') {
        window.selectLocation(lat, lon, displayName, country);
      } else {
        fetchWeather(lat, lon);
      }
    })();
  }

  function fallbackToIP() {
    fetch('https://ipapi.co/json/')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && data.latitude && data.longitude) {
          const lat = data.latitude;
          const lon = data.longitude;
          let displayName = data.city || null;
          let country = data.country_name || null;
          if (displayName) {
            const input = document.getElementById('city-search');
            if (input) input.value = displayName;
          }
          // Spara cache
          try {
            localStorage.setItem('autoLocateCache', JSON.stringify({ lat, lon, displayName, country, timestamp: Date.now() }));
          } catch (err) {}
          if (typeof window.selectLocation === 'function') {
            window.selectLocation(lat, lon, displayName, country);
          } else {
            fetchWeather(lat, lon);
          }
        } else {
          // fallback Stockholm
          const lat = 59.3293;
          const lon = 18.0686;
          const displayName = 'Stockholm';
          const country = 'Sverige';
          const input = document.getElementById('city-search');
          if (input) input.value = displayName;
          if (typeof window.selectLocation === 'function') {
            window.selectLocation(lat, lon, displayName, country);
          } else {
            fetchWeather(lat, lon);
          }
        }
      })
      .catch(() => {
        // fallback Stockholm
        const lat = 59.3293;
        const lon = 18.0686;
        const displayName = 'Stockholm';
        const country = 'Sverige';
        const input = document.getElementById('city-search');
        if (input) input.value = displayName;
        if (typeof window.selectLocation === 'function') {
          window.selectLocation(lat, lon, displayName, country);
        } else {
          fetchWeather(lat, lon);
        }
      });
  }

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              handlePosition(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
              fallbackToIP();
            },
            options
          );
        } else if (result.state === 'prompt') {
          // Be om geolocation
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              handlePosition(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
              fallbackToIP();
            },
            options
          );
        } else {
          // denied
          fallbackToIP();
        }
      })
      .catch(() => {
        // permissions API misslyckas
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            handlePosition(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            fallbackToIP();
          },
          options
        );
      });
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        fallbackToIP();
      },
      options
    );
  } else {
    fallbackToIP();
  }
}

// Kör init vid DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAutoLocate);
} else {
  initAutoLocate();
}

