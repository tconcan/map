import React, { useState, useEffect } from 'react';
import { PasswordPrompt } from './components/PasswordPrompt';
import { ControlPanel } from './components/ControlPanel';
import { MapContainer } from './components/MapContainer';
import type { GeocodeStats } from './utils/geocoding';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showVisited, setShowVisited] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [peopleCount, setPeopleCount] = useState(0);
  const [placesCount, setPlacesCount] = useState(0);
  const [visitedCount, setVisitedCount] = useState(0);
  const [stats, setStats] = useState<GeocodeStats | null>(null);
  
  // Cache clearing signals
  const [clearGeocodeSignal, setClearGeocodeSignal] = useState(0);
  const [clearRouteSignal, setClearRouteSignal] = useState(0);

  // Check initial authentication
  useEffect(() => {
    const isAuth = sessionStorage.getItem('mapAuthenticated') === 'true';
    if (isAuth) {
      setIsAuthenticated(true);
    }
    // Note: showPeople remains false by default on webpage reload!
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

  const handleDataLoaded = (peeps: number, places: number, visited: number) => {
    setPeopleCount(peeps);
    setPlacesCount(places);
    setVisitedCount(visited);
  };

  const handleTogglePeople = (val: boolean) => {
    if (val) {
      if (isAuthenticated) {
        setShowPeople(true);
      } else {
        setShowPasswordModal(true);
      }
    } else {
      setShowPeople(false);
    }
  };

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setShowPeople(true);
    setShowPasswordModal(false);
  };

  return (
    <div style={styles.appContainer}>
      <MapContainer
        showPeople={showPeople && isAuthenticated}
        showRoutes={showRoutes}
        showVisited={showVisited}
        searchQuery={searchQuery}
        onDataLoaded={handleDataLoaded}
        onStatsUpdated={handleStatsUpdated}
        clearGeocodeSignal={clearGeocodeSignal}
        clearRouteSignal={clearRouteSignal}
      />
      
      <ControlPanel
        showPeople={showPeople && isAuthenticated}
        onTogglePeople={handleTogglePeople}
        showRoutes={showRoutes}
        onToggleRoutes={setShowRoutes}
        showVisited={showVisited}
        onToggleVisited={setShowVisited}
        stats={stats}
        onClearGeocodeCache={handleClearGeocodeCache}
        onClearRouteCache={handleClearRouteCache}
        peopleCount={peopleCount}
        placesCount={placesCount}
        visitedCount={visitedCount}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        isAuthenticated={isAuthenticated}
        onPromptPassword={() => setShowPasswordModal(true)}
      />

      {showPasswordModal && (
        <PasswordPrompt 
          onAuthenticated={handleAuthenticated} 
          onClose={() => setShowPasswordModal(false)}
        />
      )}
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

