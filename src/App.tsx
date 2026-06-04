import React, { useState, useEffect } from 'react';
import { PasswordPrompt } from './components/PasswordPrompt';
import { ControlPanel } from './components/ControlPanel';
import { MapContainer } from './components/MapContainer';
import type { GeocodeStats } from './utils/geocoding';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPeople, setShowPeople] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [peopleCount, setPeopleCount] = useState(0);
  const [placesCount, setPlacesCount] = useState(0);
  const [stats, setStats] = useState<GeocodeStats | null>(null);
  
  // Cache clearing signals
  const [clearGeocodeSignal, setClearGeocodeSignal] = useState(0);
  const [clearRouteSignal, setClearRouteSignal] = useState(0);

  // Check initial authentication
  useEffect(() => {
    if (sessionStorage.getItem('mapAuthenticated') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Update statistics helper
  const handleStatsUpdated = (newStats: GeocodeStats) => {
    setStats(newStats);
  };

  const handleClearGeocodeCache = async () => {
    setClearGeocodeSignal(prev => prev + 1);
  };

  const handleClearRouteCache = async () => {
    setClearRouteSignal(prev => prev + 1);
  };

  const handleDataLoaded = (peeps: number, places: number) => {
    setPeopleCount(peeps);
    setPlacesCount(places);
  };

  if (!isAuthenticated) {
    return <PasswordPrompt onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div style={styles.appContainer}>
      <MapContainer
        showPeople={showPeople}
        showRoutes={showRoutes}
        searchQuery={searchQuery}
        onDataLoaded={handleDataLoaded}
        onStatsUpdated={handleStatsUpdated}
        clearGeocodeSignal={clearGeocodeSignal}
        clearRouteSignal={clearRouteSignal}
      />
      
      <ControlPanel
        showPeople={showPeople}
        onTogglePeople={setShowPeople}
        showRoutes={showRoutes}
        onToggleRoutes={setShowRoutes}
        stats={stats}
        onClearGeocodeCache={handleClearGeocodeCache}
        onClearRouteCache={handleClearRouteCache}
        peopleCount={peopleCount}
        placesCount={placesCount}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    width: '100%',
    height: '100vh',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0f0a24',
  }
};

export default App;
