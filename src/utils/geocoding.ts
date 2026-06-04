export interface Coords {
  lat: number;
  lng: number;
  address: string;
}

export interface GeocodeStats {
  cacheHits: number;
  apiCalls: number;
  apiFailures: number;
  totalRequests: number;
  cacheHitRate: number;
  cachedAddresses: number;
}

const stateAbbreviations: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia',
  'AS': 'American Samoa', 'GU': 'Guam', 'MP': 'Northern Mariana Islands',
  'PR': 'Puerto Rico', 'VI': 'U.S. Virgin Islands'
};

export function expandStateAbbreviation(state: string | null | undefined): string {
  if (!state) return '';
  const trimmed = state.trim().toUpperCase();
  return stateAbbreviations[trimmed] || state;
}

export function expandStateInAddress(address: string | null | undefined): string {
  if (!address) return '';
  
  const statePattern = /,\s*([A-Z]{2})\s*$/i;
  const match = address.match(statePattern);
  
  if (match) {
    const abbrev = match[1].toUpperCase();
    const fullState = stateAbbreviations[abbrev];
    if (fullState) {
      return address.replace(statePattern, `, ${fullState}`);
    }
  }
  
  return address;
}

export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address.trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .toLowerCase();
}

// IndexedDB Helper
class IndexedDBStore<T> {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private storeName: string;
  private version: number;

  constructor(dbName: string, storeName: string, version: number = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
  }

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { 
            keyPath: this.storeName === 'geocodes' ? 'address' : 'routeKey' 
          });
        }
      };
    });
  }
  
  async get(key: string): Promise<T | null> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => {
          resolve(null);
        };
      });
    } catch (e) {
      console.warn(`IndexedDB get failed for store ${this.storeName}:`, e);
      return null;
    }
  }
  
  async set(value: any): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(value);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`IndexedDB set failed for store ${this.storeName}:`, e);
    }
  }
  
  async clear(): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async count(): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Cache Instances
export const geocodeCache = new IndexedDBStore<{
  address: string;
  coords: Coords;
  timestamp: number;
}>('GeocodeCacheDB', 'geocodes');

export const routeCache = new IndexedDBStore<{
  routeKey: string;
  coordinates: [number, number][];
  timestamp: number;
}>('RouteCacheDB', 'routes');

// In-Memory stats tracking
export const geocodeStats = {
  cacheHits: 0,
  apiCalls: 0,
  apiFailures: 0
};

let lastGeocodeTime = 0;

export async function geocodeAddress(address: string): Promise<Coords | null> {
  if (!address || address.trim() === '') {
    return null;
  }
  
  const normalized = normalizeAddress(address);
  
  // 1. Check IndexedDB cache
  const cached = await geocodeCache.get(normalized);
  if (cached && cached.coords) {
    geocodeStats.cacheHits++;
    return cached.coords;
  }
  
  // 2. Cache Miss - Make API Call
  geocodeStats.apiCalls++;
  
  // Rate limit Photon (max 5 req/sec to be polite)
  const now = Date.now();
  const timeSinceLast = now - lastGeocodeTime;
  if (timeSinceLast < 200) {
    await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLast));
  }
  lastGeocodeTime = Date.now();
  
  try {
    const url = `https://photon.komoot.io/api?q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Tucka Map React Application'
      }
    });
    
    if (!response.ok) {
      geocodeStats.apiFailures++;
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.features && data.features.length > 0) {
      const feat = data.features[0];
      const coords: Coords = {
        lat: feat.geometry.coordinates[1],
        lng: feat.geometry.coordinates[0],
        address: feat.properties.name + (feat.properties.state ? `, ${feat.properties.state}` : '')
      };
      
      // Store in Cache
      await geocodeCache.set({
        address: normalized,
        coords,
        timestamp: Date.now()
      });
      
      return coords;
    } else {
      geocodeStats.apiFailures++;
      
      // Retry fallbacks for specific locations
      const alternatives: string[] = [];
      if (address.includes('Little Bighorn')) {
        alternatives.push('Little Bighorn Battlefield National Monument, MT');
        alternatives.push('Little Bighorn Battlefield, MT');
      }
      if (address.includes('Sequoia and Kings Canyon') || address.includes('Sequoia & Kings Canyon')) {
        alternatives.push('Kings Canyon National Park, CA');
        alternatives.push('Sequoia National Park, CA');
        alternatives.push('Sequoia and Kings Canyon National Parks, CA');
      }
      
      for (const alt of alternatives) {
        const altResult = await geocodeAddress(alt);
        if (altResult) {
          // Cache the original address with the alternative's result
          await geocodeCache.set({
            address: normalized,
            coords: altResult,
            timestamp: Date.now()
          });
          return altResult;
        }
      }
      
      console.warn(`Geocode API returned no results for: ${address}`);
      return null;
    }
  } catch (error) {
    geocodeStats.apiFailures++;
    console.error(`Error geocoding ${address}:`, error);
    return null;
  }
}

export function getRouteCacheKey(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): string {
  return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}_${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
}

export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<[number, number][]> {
  const routeKey = getRouteCacheKey(origin, destination);
  
  // 1. Check Route Cache
  const cached = await routeCache.get(routeKey);
  if (cached && cached.coordinates) {
    return cached.coordinates;
  }
  
  // 2. Fetch OSRM Route
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const routeCoords = data.routes[0].geometry.coordinates as [number, number][];
      
      // Cache it
      await routeCache.set({
        routeKey,
        coordinates: routeCoords,
        timestamp: Date.now()
      });
      
      return routeCoords;
    } else {
      // Fallback: straight line
      return [[origin.lng, origin.lat], [destination.lng, destination.lat]];
    }
  } catch (error) {
    console.error('Error fetching route from OSRM:', error);
    return [[origin.lng, origin.lat], [destination.lng, destination.lat]];
  }
}

export async function getStats(): Promise<GeocodeStats> {
  const total = geocodeStats.cacheHits + geocodeStats.apiCalls;
  const hitRate = total > 0 ? (geocodeStats.cacheHits / total) * 100 : 0;
  const cachedCount = await geocodeCache.count();
  
  return {
    cacheHits: geocodeStats.cacheHits,
    apiCalls: geocodeStats.apiCalls,
    apiFailures: geocodeStats.apiFailures,
    totalRequests: total,
    cacheHitRate: hitRate,
    cachedAddresses: cachedCount
  };
}
