const fs = require('fs');
const path = require('path');
const http = require('https');

const PEOPLE_CSV = path.join(__dirname, '../public/data/people.csv');
const PLACES_CSV = path.join(__dirname, '../public/data/places.csv');
const OUT_JSON = path.join(__dirname, '../public/data/geocodes.json');

function parseCSVLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeAddress(address) {
  if (!address) return '';
  return address.trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .toLowerCase();
}

// 1. Gather all unique locations
const uniqueLocations = new Set();

// Parse People
if (fs.existsSync(PEOPLE_CSV)) {
  const lines = fs.readFileSync(PEOPLE_CSV, 'utf8').split('\n').slice(1);
  lines.forEach(line => {
    if (!line.trim()) return;
    const cells = parseCSVLine(line);
    const homeCity = cells[5] || '';
    const homeState = cells[6] || '';
    const nowCity = cells[7] || '';
    const nowState = cells[8] || '';
    
    if (homeCity && homeState) {
      uniqueLocations.add(`${homeCity.trim()}, ${homeState.trim()}`);
    } else if (homeCity) {
      uniqueLocations.add(homeCity.trim());
    }
    
    if (nowCity && nowState) {
      uniqueLocations.add(`${nowCity.trim()}, ${nowState.trim()}`);
    } else if (nowCity) {
      uniqueLocations.add(nowCity.trim());
    }
  });
}

// Parse Places
if (fs.existsSync(PLACES_CSV)) {
  const lines = fs.readFileSync(PLACES_CSV, 'utf8').split('\n').slice(1);
  lines.forEach(line => {
    if (!line.trim()) return;
    const cells = parseCSVLine(line);
    const location = cells[0] || '';
    const state = cells[1] || '';
    if (location) {
      const fullLocation = state ? `${location.trim()}, ${state.trim()}` : location.trim();
      uniqueLocations.add(fullLocation);
    }
  });
}

const locations = Array.from(uniqueLocations).filter(l => l && l.trim() !== '');
console.log(`Found ${locations.length} unique locations in CSV datasets.`);

// 2. Load existing geocodes if they exist
let geocodes = {};
if (fs.existsSync(OUT_JSON)) {
  try {
    geocodes = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
    console.log(`Loaded ${Object.keys(geocodes).length} existing geocodes from ${OUT_JSON}`);
  } catch (e) {
    console.warn(`Failed to parse existing ${OUT_JSON}, starting fresh.`);
  }
}

// Ensure public/data directory exists
const dir = path.dirname(OUT_JSON);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// 3. Sequential geocoding helper
async function geocode(address) {
  const normalized = normalizeAddress(address);
  // Check if already geocoded in json
  if (geocodes[normalized]) {
    return;
  }

  return new Promise((resolve) => {
    const url = `https://photon.komoot.io/api?q=${encodeURIComponent(address)}&limit=1`;
    
    const req = http.get(url, {
      headers: {
        'User-Agent': 'Tucka-Geocode-Seeder-Node-Script'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`Failed to geocode "${address}": HTTP status ${res.statusCode}`);
            resolve(null);
            return;
          }
          const parsed = JSON.parse(data);
          if (parsed && parsed.features && parsed.features.length > 0) {
            const feat = parsed.features[0];
            const coords = {
              lat: feat.geometry.coordinates[1],
              lng: feat.geometry.coordinates[0],
              address: feat.properties.name + (feat.properties.state ? `, ${feat.properties.state}` : '')
            };
            geocodes[normalized] = coords;
            console.log(`Successfully geocoded: "${address}" -> [${coords.lat}, ${coords.lng}]`);
            // Save incrementally
            fs.writeFileSync(OUT_JSON, JSON.stringify(geocodes, null, 2), 'utf8');
            resolve(coords);
          } else {
            console.warn(`No geocoding results for: "${address}"`);
            resolve(null);
          }
        } catch (e) {
          console.error(`Error parsing geocoding response for "${address}":`, e);
          resolve(null);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`Network error geocoding "${address}":`, err);
      resolve(null);
    });
  });
}

// 4. Main geocoding loop
async function run() {
  let count = 0;
  for (const loc of locations) {
    const normalized = normalizeAddress(loc);
    if (geocodes[normalized]) {
      continue;
    }
    
    count++;
    // Add rate-limiting delay of 200ms between requests (Photon is high capacity)
    await new Promise(r => setTimeout(r, 200));
    await geocode(loc);
  }
  console.log(`Finished geocoding seeder. Geocoded ${count} new locations. Total cached: ${Object.keys(geocodes).length}`);
}

run();
