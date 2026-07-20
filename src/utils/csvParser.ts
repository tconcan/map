export interface Person {
  name: string;
  connection: string;
  closeness: string;
  homeLocation: string | null;
  locationNow: string | null;
  rawData?: string[];
  locationType?: 'home' | 'now';
  isHome?: boolean;
}

export interface Place {
  location: string;
  city: string;
  state: string;
  date: string;
  days: string;
  notes: string;
  lat?: number;
  lng?: number;
}

export function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
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

export function parsePeopleCSV(csvText: string): Person[] {
  const lines = csvText.trim().split('\n');
  const data: Person[] = [];
  
  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i];
    if (!line.trim()) continue;
    
    const cells = parseCSVLine(line);
    
    // Map cells to columns based on the CSV format:
    // 0: First Name, 1: Last Name, 3: Connection, 5: Home City, 6: Home State, 7: Location Now City, 8: Location Now State, 9: Closeness
    const firstName = cells[0] || '';
    const lastName = cells[1] || '';
    const name = `${firstName} ${lastName}`.trim();
    const connection = cells[3] || '';
    const closeness = cells[9] || '';
    
    const homeCity = cells[5] || '';
    const homeState = cells[6] || '';
    const locationNowCity = cells[7] || '';
    const locationNowState = cells[8] || '';
    
    let homeLocation: string | null = null;
    if (homeCity && homeState) {
      homeLocation = `${homeCity}, ${homeState}`.trim();
    } else if (homeCity) {
      homeLocation = homeCity.trim();
    }
    
    let locationNow: string | null = null;
    if (locationNowCity && locationNowState) {
      locationNow = `${locationNowCity}, ${locationNowState}`.trim();
    } else if (locationNowCity) {
      locationNow = locationNowCity.trim();
    }
    
    if (name && (homeLocation || locationNow)) {
      data.push({
        name,
        connection: connection.trim(),
        closeness: closeness.trim(),
        homeLocation,
        locationNow,
        rawData: cells
      });
    }
  }
  
  return data;
}

export function parsePlacesCSV(csvText: string): Place[] {
  const lines = csvText.trim().split('\n');
  const places: Place[] = [];
  
  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i];
    if (!line.trim()) continue;
    
    const cells = parseCSVLine(line);
    const location = cells[0] || '';
    const state = cells[1] || '';
    const date = cells[2] || '';
    const days = cells[3] || '';
    const notes = cells[4] || '';
    
    if (location) {
      const fullLocation = state ? `${location}, ${state}` : location;
      places.push({
        location: fullLocation,
        city: location,
        state,
        date,
        days,
        notes
      });
    }
  }
  
  return places;
}

export function parseVisitedCSV(csvText: string): Place[] {
  const lines = csvText.trim().split('\n');
  const places: Place[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    places.push({
      location: line,
      city: line.split(',')[0]?.trim() || line,
      state: line.split(',')[1]?.trim() || '',
      date: '',
      days: '',
      notes: 'Visited Location'
    });
  }
  
  return places;
}

