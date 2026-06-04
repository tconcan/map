import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  parsePeopleCSV, 
  parsePlacesCSV 
} from '../utils/csvParser';
import type { Person, Place } from '../utils/csvParser';
import { 
  geocodeAddress, 
  getRoute, 
  geocodeCache, 
  routeCache,
  getStats,
  normalizeAddress
} from '../utils/geocoding';
import type { GeocodeStats, Coords } from '../utils/geocoding';

function interpolateHexColor(color1: string, color2: string, factor: number): string {
  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);
  
  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);
  
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  // Make sure hex channels are padded to 2 characters
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface MapContainerProps {
  showPeople: boolean;
  showRoutes: boolean;
  searchQuery: string;
  onDataLoaded: (peopleCount: number, placesCount: number) => void;
  onStatsUpdated: (stats: GeocodeStats) => void;
  clearGeocodeSignal: number;
  clearRouteSignal: number;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  showPeople,
  showRoutes,
  searchQuery,
  onDataLoaded,
  onStatsUpdated,
  clearGeocodeSignal,
  clearRouteSignal,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  
  // Loaded raw datasets
  const [people, setPeople] = useState<Person[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  
  // Geocoded caches
  const [peopleCoords, setPeopleCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [placesCoords, setPlacesCoords] = useState<Place[]>([]);
  
  // Map markers and routes tracking
  const peopleMarkersRef = useRef<maplibregl.Marker[]>([]);
  const placeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const routeLayerIdsRef = useRef<string[]>([]);
  
  // Store grouping and coordinates locally to re-cluster on zoom/pan
  const locationGroupsRef = useRef<Map<string, Person[]>>(new Map());

  // 1. Fetch and Parse Datasets
  useEffect(() => {
    const loadData = async () => {
      try {
        const [peopleRes, placesRes] = await Promise.all([
          fetch('/data/people.csv'),
          fetch('/data/places.csv')
        ]);
        
        const peopleText = await peopleRes.text();
        const placesText = await placesRes.text();
        
        const parsedPeople = parsePeopleCSV(peopleText);
        const parsedPlaces = parsePlacesCSV(placesText);
        
        setPeople(parsedPeople);
        setPlaces(parsedPlaces);
        
        onDataLoaded(parsedPeople.length, parsedPlaces.length);
        
        // Seed cache from static json if available
        const geocodesRes = await fetch('/data/geocodes.json').catch(() => null);
        if (geocodesRes && geocodesRes.ok) {
          try {
            const preseeded = await geocodesRes.json() as Record<string, Coords>;
            for (const [address, coords] of Object.entries(preseeded)) {
              const normalized = normalizeAddress(address);
              const existing = await geocodeCache.get(normalized);
              if (!existing || existing.coords.lat !== coords.lat || existing.coords.lng !== coords.lng) {
                await geocodeCache.set({
                  address: normalized,
                  coords,
                  timestamp: Date.now()
                });
              }
            }
          } catch (e) {
            console.warn('Failed to parse pre-seeded geocodes:', e);
          }
        }
        
        // Trigger initial stats update
        const currentStats = await getStats();
        onStatsUpdated(currentStats);
      } catch (error) {
        console.error('Error loading map datasets:', error);
      }
    };
    
    loadData();
  }, []);

  // 2. Clear Caches when signals trigger
  useEffect(() => {
    if (clearGeocodeSignal > 0) {
      const clearGeocode = async () => {
        await geocodeCache.clear();
        const currentStats = await getStats();
        onStatsUpdated(currentStats);
      };
      clearGeocode();
    }
  }, [clearGeocodeSignal]);

  useEffect(() => {
    if (clearRouteSignal > 0) {
      const clearRoute = async () => {
        await routeCache.clear();
        // Redraw route if map is ready
        if (mapRef.current && placesCoords.length > 0) {
          drawRoutesAndPlaces(mapRef.current, placesCoords);
        }
      };
      clearRoute();
    }
  }, [clearRouteSignal]);

  // 3. Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'openstreetmap': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'openstreetmap',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [-98.35, 39.5], // Center of USA
      zoom: 3.5
    });
    
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false
    });
    
    mapRef.current = map;
    popupRef.current = popup;
    
    // Cleanup on unmount
    return () => {
      map.remove();
    };
  }, []);

  // 4. Geocode Places and draw Routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || places.length === 0) return;
    
    const processPlaces = async () => {
      const coordsList: Place[] = [];
      
      for (const place of places) {
        const coords = await geocodeAddress(place.location);
        if (coords) {
          coordsList.push({
            ...place,
            lat: coords.lat,
            lng: coords.lng
          });
        }
      }
      
      setPlacesCoords(coordsList);
      
      if (map.isStyleLoaded()) {
        drawRoutesAndPlaces(map, coordsList);
      } else {
        map.once('load', () => drawRoutesAndPlaces(map, coordsList));
      }
      
      const currentStats = await getStats();
      onStatsUpdated(currentStats);
    };
    
    processPlaces();
  }, [places]);

  // 5. Geocode People Locations
  useEffect(() => {
    if (people.length === 0) return;
    
    const processPeople = async () => {
      // Gather all unique locations
      const uniqueLocs = new Set<string>();
      people.forEach(p => {
        if (p.homeLocation) uniqueLocs.add(p.homeLocation.trim());
        if (p.locationNow) uniqueLocs.add(p.locationNow.trim());
      });
      
      const coordsMap = new Map<string, { lat: number; lng: number }>();
      for (const loc of Array.from(uniqueLocs)) {
        const coords = await geocodeAddress(loc);
        if (coords) {
          coordsMap.set(loc, { lat: coords.lat, lng: coords.lng });
        }
      }
      
      setPeopleCoords(coordsMap);
      
      const currentStats = await getStats();
      onStatsUpdated(currentStats);
    };
    
    processPeople();
  }, [people]);

  // 6. Cluster and render People Markers when:
  // - map loads
  // - people data changes
  // - coordinates map changes
  // - search query changes (filters people!)
  // - map zooms or pans (updates screen-space coordinates)
  // - map resizes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || people.length === 0 || peopleCoords.size === 0) return;
    
    const handleMapMovement = () => {
      renderPeopleMarkers();
    };
    
    map.on('zoomend', handleMapMovement);
    map.on('moveend', handleMapMovement);
    map.on('resize', handleMapMovement);
    
    const runInitial = () => {
      if (mapRef.current) {
        mapRef.current.resize();
        renderPeopleMarkers();
      }
    };

    // Initial run - slightly delayed to allow container sizing to settle in DOM
    let timerId: number = 0;
    if (map.isStyleLoaded()) {
      timerId = window.setTimeout(runInitial, 100);
    } else {
      map.once('load', () => {
        timerId = window.setTimeout(runInitial, 100);
      });
    }
    
    return () => {
      map.off('zoomend', handleMapMovement);
      map.off('moveend', handleMapMovement);
      map.off('resize', handleMapMovement);
      if (timerId) window.clearTimeout(timerId);
    };
  }, [people, peopleCoords, searchQuery]);

  // 7. Toggle visibility of layers dynamically
  useEffect(() => {
    // Toggle People Markers
    peopleMarkersRef.current.forEach(marker => {
      const el = marker.getElement();
      el.style.display = showPeople ? 'flex' : 'none';
    });
  }, [showPeople]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Toggle Route Layers
    routeLayerIdsRef.current.forEach(layerId => {
      try {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', showRoutes ? 'visible' : 'none');
        }
      } catch (e) {
        // Ignored
      }
    });
    
    // Toggle Place Markers
    placeMarkersRef.current.forEach(marker => {
      const el = marker.getElement();
      el.style.display = showRoutes ? '' : 'none';
    });
  }, [showRoutes]);

  // DRAW ROUTES AND PLACE MARKERS
  const drawRoutesAndPlaces = async (map: maplibregl.Map, coordsList: Place[]) => {
    // 1. Clear previous layers
    routeLayerIdsRef.current.forEach(layerId => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        const sourceId = layerId.replace('route-layer-', 'route-');
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (e) {}
    });
    routeLayerIdsRef.current = [];
    
    // 2. Clear previous place markers
    placeMarkersRef.current.forEach(m => m.remove());
    placeMarkersRef.current = [];

    // 3. Draw routes between consecutive places
    const totalSegments = coordsList.length - 1;
    if (totalSegments <= 0) return;

    // Fetch all routes in parallel to improve load performance
    const routePromises = [];
    for (let i = 0; i < totalSegments; i++) {
      const origin = { lat: coordsList[i].lat!, lng: coordsList[i].lng! };
      const destination = { lat: coordsList[i+1].lat!, lng: coordsList[i+1].lng! };
      routePromises.push(getRoute(origin, destination));
    }

    const allRoutesCoords = await Promise.all(routePromises);

    // Concatenate all segment coordinates into a single continuous LineString
    const combinedCoords: [number, number][] = [];
    allRoutesCoords.forEach((route) => {
      if (route && route.length >= 2) {
        if (combinedCoords.length > 0) {
          const last = combinedCoords[combinedCoords.length - 1];
          const first = route[0];
          // Avoid duplicate coordinates at segment connections
          if (last[0] === first[0] && last[1] === first[1]) {
            combinedCoords.push(...route.slice(1));
          } else {
            combinedCoords.push(...route);
          }
        } else {
          combinedCoords.push(...route);
        }
      }
    });

    if (combinedCoords.length >= 2) {
      const sourceId = `route-${Date.now()}`;
      const layerId = `route-layer-${Date.now()}`;
      
      try {
        map.addSource(sourceId, {
          type: 'geojson',
          lineMetrics: true, // REQUIRED for line-gradient support
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: combinedCoords
            }
          }
        });
        
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3, 6,    // 6px wide at zoom 3 (zoomed out)
              10, 14   // 14px wide at zoom 10 (zoomed in)
            ],
            'line-gradient': [
              'interpolate',
              ['linear'],
              ['line-progress'],
              0, '#3b82f6', // Royal Blue
              1, '#f43f5e'  // Neon Rose
            ],
            'line-opacity': 0.85
          }
        });
        
        routeLayerIdsRef.current.push(layerId);
        
        // Hide if routes toggle is unchecked
        if (!showRoutes) {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      } catch (e) {
        console.error('Error rendering combined route layer:', e);
      }
    }
    
    // 4. Add small dot markers for places
    coordsList.forEach((place, idx) => {
      const markerEl = document.createElement('div');
      
      // Interpolate place marker color to match the route line gradient
      const factor = coordsList.length > 1 ? idx / (coordsList.length - 1) : 0;
      const stopColor = interpolateHexColor('#3b82f6', '#f43f5e', factor);
      
      markerEl.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: ${stopColor};
        border: 2px solid white;
        box-shadow: 0 0 12px ${hexToRgba(stopColor, 0.6)};
        cursor: pointer;
        display: ${showRoutes ? '' : 'none'};
      `;
      
      const popupContent = `
        <div style="padding: 4px; max-width: 220px; font-family: var(--font-primary);">
          <strong style="font-size: 14px; color: #ffffff; display: block; margin-bottom: 4px;">${place.location}</strong>
          ${place.date ? `<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 2px;">Stop Date: ${place.date}</div>` : ''}
          ${place.days ? `<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 2px;">Duration: ${place.days} days</div>` : ''}
          ${place.notes ? `<div style="font-size: 11px; color: var(--text-muted); border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 4px; margin-top: 4px;">${place.notes}</div>` : ''}
        </div>
      `;

      const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat([place.lng!, place.lat!])
        .addTo(map);

      markerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popupRef.current) {
          popupRef.current
            .setLngLat([place.lng!, place.lat!])
            .setHTML(popupContent)
            .addTo(map);
        }
      });
        
      placeMarkersRef.current.push(marker);
    });
  };

  // CLUSTER AND RENDER PEOPLE
  const renderPeopleMarkers = () => {
    const map = mapRef.current;
    if (!map) return;
    
    // Clear previous markers
    peopleMarkersRef.current.forEach(m => m.remove());
    peopleMarkersRef.current = [];
    
    // 1. Filter people by search query
    const filteredPeople = people.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // 2. Group people by location
    const locationGroups = new Map<string, Person[]>();
    
    filteredPeople.forEach(person => {
      const normalizedHome = person.homeLocation ? person.homeLocation.trim() : '';
      const normalizedNow = person.locationNow ? person.locationNow.trim() : '';
      
      if (normalizedHome && normalizedHome === normalizedNow) {
        if (!locationGroups.has(normalizedHome)) locationGroups.set(normalizedHome, []);
        locationGroups.get(normalizedHome)!.push({
          ...person,
          locationType: 'home',
          isHome: true
        });
      } else {
        if (normalizedHome) {
          if (!locationGroups.has(normalizedHome)) locationGroups.set(normalizedHome, []);
          locationGroups.get(normalizedHome)!.push({
            ...person,
            locationType: 'home',
            isHome: true
          });
        }
        if (normalizedNow) {
          if (!locationGroups.has(normalizedNow)) locationGroups.set(normalizedNow, []);
          locationGroups.get(normalizedNow)!.push({
            ...person,
            locationType: 'now',
            isHome: false
          });
        }
      }
    });
    
    locationGroupsRef.current = locationGroups;
    
    // 3. Project geocoded points to screen space coordinates
    const zoom = map.getZoom();
    const clusterDistance = zoom < 5 ? 20 : zoom < 7 ? 10 : 5;
    
    interface ScreenLocation {
      location: string;
      people: Person[];
      coords: { lat: number; lng: number };
      screenX: number;
      screenY: number;
    }
    
    const locationsList: ScreenLocation[] = [];
    let projectFailed = false;
    
    for (const [location, grp] of Array.from(locationGroups.entries())) {
      const coords = peopleCoords.get(location);
      if (!coords) continue;
      
      try {
        const point = map.project([coords.lng, coords.lat]);
        locationsList.push({
          location,
          people: grp,
          coords,
          screenX: point.x,
          screenY: point.y
        });
      } catch (err) {
        projectFailed = true;
      }
    }
    
    // Fallback if projection fails
    if (projectFailed || locationsList.length === 0) {
      for (const [location, grp] of Array.from(locationGroups.entries())) {
        const coords = peopleCoords.get(location);
        if (!coords) continue;
        createSingleLocationMarker(map, location, grp, coords);
      }
      return;
    }
    
    // 4. Cluster nearby screen coordinates
    const clusters: ScreenLocation[][] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < locationsList.length; i++) {
      if (processed.has(i)) continue;
      
      const cluster = [locationsList[i]];
      processed.add(i);
      
      for (let j = i + 1; j < locationsList.length; j++) {
        if (processed.has(j)) continue;
        
        const dx = locationsList[i].screenX - locationsList[j].screenX;
        const dy = locationsList[i].screenY - locationsList[j].screenY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= clusterDistance) {
          cluster.push(locationsList[j]);
          processed.add(j);
        }
      }
      
      clusters.push(cluster);
    }
    
    // 5. Create markers for clusters or single points
    clusters.forEach(cluster => {
      if (cluster.length === 1) {
        const { location, people: grp, coords } = cluster[0];
        createSingleLocationMarker(map, location, grp, coords);
      } else {
        createClusterMarker(map, cluster);
      }
    });
  };

  const createSingleLocationMarker = (
    map: maplibregl.Map,
    location: string,
    grp: Person[],
    coords: { lat: number; lng: number }
  ) => {
    const markerEl = createMarkerElement(grp.length, grp);
    const popupContent = createPopupHTML(location, grp);
    
    const marker = new maplibregl.Marker({ element: markerEl })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    markerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (popupRef.current) {
        popupRef.current
          .setLngLat([coords.lng, coords.lat])
          .setHTML(popupContent)
          .addTo(map);
      }
    });
      
    peopleMarkersRef.current.push(marker);
    
    // Hide if people toggle is unchecked
    if (!showPeople) {
      markerEl.style.display = 'none';
    }
  };

  const createClusterMarker = (map: maplibregl.Map, cluster: any[]) => {
    const allPeople: Person[] = [];
    const clusterLocations: string[] = [];
    let totalLat = 0;
    let totalLng = 0;
    
    cluster.forEach(loc => {
      allPeople.push(...loc.people);
      clusterLocations.push(loc.location);
      totalLat += loc.coords.lat;
      totalLng += loc.coords.lng;
    });
    
    const centerLat = totalLat / cluster.length;
    const centerLng = totalLng / cluster.length;
    
    const markerEl = createMarkerElement(allPeople.length, allPeople);
    const popupContent = createClusterPopupHTML(clusterLocations, allPeople);
    
    const marker = new maplibregl.Marker({ element: markerEl })
      .setLngLat([centerLng, centerLat])
      .addTo(map);

    markerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (popupRef.current) {
        popupRef.current
          .setLngLat([centerLng, centerLat])
          .setHTML(popupContent)
          .addTo(map);
      }
    });
      
    peopleMarkersRef.current.push(marker);
    
    if (!showPeople) {
      markerEl.style.display = 'none';
    }
  };

  // HELPERS FOR MARKER GENERATION & STYLING
  const createMarkerElement = (count: number, peopleList: Person[]): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'custom-marker';
    
    const color = getLocationColor(peopleList);
    const backgroundColor = hexToRgba(color, 0.85);
    
    // Logarithmic size scaling (min 24px, max 54px)
    const minSize = 24;
    const maxSize = 54;
    const minCount = 1;
    const maxCount = 100;
    
    const normalizedCount = Math.min(count, maxCount);
    const logMin = Math.log(minCount);
    const logMax = Math.log(maxCount);
    const logCount = Math.log(normalizedCount);
    const normalized = (logCount - logMin) / (logMax - logMin);
    const size = Math.round(minSize + (maxSize - minSize) * normalized);
    
    const fontSize = Math.max(10, Math.round(size * 0.35));
    const borderWidth = Math.max(2, Math.round(size * 0.07));
    
    // Outer wrapper sized and positioned by MapLibre (no visual transforms)
    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Inner visual element that gets animated on hover
    const inner = document.createElement('div');
    inner.className = 'custom-marker-inner';
    inner.style.cssText = `
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-color: ${backgroundColor};
      border: ${borderWidth}px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 15px ${hexToRgba(color, 0.4)}, 0 4px 10px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: ${fontSize}px;
      font-family: var(--font-display);
      transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    
    inner.textContent = count > 99 ? '99+' : count.toString();
    el.appendChild(inner);
    
    return el;
  };

  const getLocationColor = (peopleList: Person[]): string => {
    let tCount = 0;
    let jCount = 0;
    
    peopleList.forEach(p => {
      const conn = p.connection || '';
      if (conn === 'T') tCount++;
      else if (conn === 'J') jCount++;
      else if (conn === 'TJ') {
        tCount++;
        jCount++;
      }
    });
    
    const total = tCount + jCount;
    if (total === 0) return '#8b5cf6'; // default purple
    
    const ratio = tCount / total; // 0 = J (yellow), 0.5 = equal (green), 1 = T (blue)
    
    let r, g, b;
    if (ratio <= 0.5) {
      const t = ratio * 2; // yellow -> green
      r = Math.round(230 + (0 - 230) * t);
      g = Math.round(227 + (211 - 227) * t);
      b = Math.round(23 + (60 - 23) * t);
    } else {
      const t = (ratio - 0.5) * 2; // green -> blue
      r = 0;
      g = Math.round(211 + (26 - 211) * t);
      b = Math.round(60 + (255 - 60) * t);
    }
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const hexToRgba = (hex: string, opacity: number = 1): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // POPUP CONTENT HTML GENERATOR
  const createPopupHTML = (location: string, peopleList: Person[]): string => {
    const sorted = sortPeople(peopleList);
    const formattedList = formatPeopleHTMLList(sorted);
    
    return `
      <div style="min-width: 220px; font-family: var(--font-primary);">
        <h3 style="margin: 0 24px 6px 0; font-family: var(--font-display); font-size: 16px; font-weight: 700; color: #ffffff;">${location}</h3>
        <div style="margin-bottom: 12px; color: var(--text-secondary); font-size: 12px; font-weight: 500;">
          ${peopleList.length} ${peopleList.length === 1 ? 'person' : 'people'}
        </div>
        <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
          ${formattedList}
        </div>
      </div>
    `;
  };

  const createClusterPopupHTML = (locations: string[], allPeople: Person[]): string => {
    const sorted = sortPeople(allPeople);
    const formattedList = formatPeopleHTMLList(sorted);
    const locationsHTML = locations.map(loc => `
      <li style="margin-bottom: 2px; color: #ffffff;">${loc}</li>
    `).join('');
    
    return `
      <div style="min-width: 240px; font-family: var(--font-primary);">
        <h3 style="margin: 0 24px 4px 0; font-family: var(--font-display); font-size: 16px; font-weight: 700; color: #ffffff;">${locations.length} Locations Clustered</h3>
        <div style="margin-bottom: 10px; color: var(--text-secondary); font-size: 12px; font-weight: 500;">
          ${allPeople.length} people total
        </div>
        <div style="margin-bottom: 14px; font-size: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 8px; padding: 10px;">
          <strong style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase;">Locations:</strong>
          <ul style="margin: 6px 0 0 0; padding-left: 16px; color: var(--text-primary); max-height: 80px; overflow-y: auto;">
            ${locationsHTML}
          </ul>
        </div>
        <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
          ${formattedList}
        </div>
      </div>
    `;
  };

  const sortPeople = (list: Person[]): Person[] => {
    return [...list].sort((a, b) => {
      const isHomeA = a.locationType === 'home';
      const isHomeB = b.locationType === 'home';
      const hasNowA = !!(a.locationNow && a.locationNow.trim());
      const hasNowB = !!(b.locationNow && b.locationNow.trim());
      
      const bottomA = isHomeA && hasNowA;
      const bottomB = isHomeB && hasNowB;
      
      if (!bottomA && bottomB) return -1;
      if (bottomA && !bottomB) return 1;
      
      const closenessA = (a.closeness || '').toUpperCase();
      const closenessB = (b.closeness || '').toUpperCase();
      
      if (closenessA === 'A' && closenessB !== 'A') return -1;
      if (closenessA !== 'A' && closenessB === 'A') return 1;
      
      if (closenessA === 'B' && closenessB !== 'B' && closenessB !== 'A') return -1;
      if (closenessA !== 'B' && closenessA !== 'A' && closenessB === 'B') return 1;
      
      return 0;
    });
  };

  const formatPeopleHTMLList = (list: Person[]): string => {
    return list.map(p => {
      const hasBoth = p.homeLocation && p.locationNow;
      const isHome = p.locationType === 'home';
      const locNow = p.locationNow;
      const closeness = (p.closeness || '').toUpperCase();
      const isSmallAndUnbold = isHome && !!(locNow && locNow.trim());
      
      let fontSize = '13px';
      let fontWeight = '600';
      let fontColor = '#ffffff';
      
      if (isSmallAndUnbold) {
        fontSize = '11px';
        fontWeight = '400';
        fontColor = 'var(--text-secondary)';
      } else {
        if (closeness === 'A') {
          fontSize = '18px';
          fontWeight = '700';
          fontColor = '#a78bfa'; // light purple
        } else if (closeness !== 'B' && closeness !== '') {
          fontSize = '11px';
          fontWeight = '400';
          fontColor = 'var(--text-muted)';
        }
      }
      
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: ${fontSize}; font-weight: ${fontWeight}; color: ${fontColor};">${p.name || 'Unknown'}</span>
          </div>
          ${hasBoth && isHome && locNow ? `
            <span style="color: var(--text-muted); font-size: 11px; font-style: italic;">Now in: ${locNow}</span>
          ` : ''}
        </div>
      `;
    }).join('');
  };

  return (
    <div 
      ref={mapContainerRef} 
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
    />
  );
};
