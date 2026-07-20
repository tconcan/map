import React, { useState } from 'react';
import { Layers, Database, BarChart3, Trash2, Search, Users, MapPin, Check, ChevronLeft, ChevronRight, Lock, CheckCircle2 } from 'lucide-react';
import type { GeocodeStats } from '../utils/geocoding';

interface ControlPanelProps {
  showPeople: boolean;
  onTogglePeople: (val: boolean) => void;
  showRoutes: boolean;
  onToggleRoutes: (val: boolean) => void;
  showVisited: boolean;
  onToggleVisited: (val: boolean) => void;
  stats: GeocodeStats | null;
  onClearGeocodeCache: () => Promise<void>;
  onClearRouteCache: () => Promise<void>;
  peopleCount: number;
  placesCount: number;
  visitedCount: number;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  isAuthenticated: boolean;
  onPromptPassword: () => void;
}

type TabType = 'layers' | 'stats' | 'cache';

export const ControlPanel: React.FC<ControlPanelProps> = ({
  showPeople,
  onTogglePeople,
  showRoutes,
  onToggleRoutes,
  showVisited,
  onToggleVisited,
  stats,
  onClearGeocodeCache,
  onClearRouteCache,
  peopleCount,
  placesCount,
  visitedCount,
  searchQuery,
  onSearchQueryChange,
  isAuthenticated,
  onPromptPassword,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('layers');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [clearingGeocode, setClearingGeocode] = useState(false);
  const [clearingRoute, setClearingRoute] = useState(false);
  const [geocodeClearedSuccess, setGeocodeClearedSuccess] = useState(false);
  const [routeClearedSuccess, setRouteClearedSuccess] = useState(false);

  const handleClearGeocode = async () => {
    setClearingGeocode(true);
    await onClearGeocodeCache();
    setClearingGeocode(false);
    setGeocodeClearedSuccess(true);
    setTimeout(() => setGeocodeClearedSuccess(false), 3000);
  };

  const handleClearRoute = async () => {
    setClearingRoute(true);
    await onClearRouteCache();
    setClearingRoute(false);
    setRouteClearedSuccess(true);
    setTimeout(() => setRouteClearedSuccess(false), 3000);
  };

  if (isCollapsed) {
    return (
      <button
        className="glass-panel collapse-btn"
        onClick={() => setIsCollapsed(false)}
        style={styles.collapsedButton}
        title="Expand Controls"
      >
        <ChevronRight size={20} color="#ffffff" />
      </button>
    );
  }

  return (
    <div className="glass-panel" style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerTitleRow}>
          <h3 style={styles.title}>Map Controls</h3>
          <button 
            onClick={() => setIsCollapsed(true)} 
            className="collapse-btn"
            title="Collapse Controls"
          >
            <ChevronLeft size={18} color="var(--text-secondary)" />
          </button>
        </div>
        <p style={styles.subtitle}>Tucka Visualization System</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('layers')}
          style={{
            ...styles.tabButton,
            borderBottomColor: activeTab === 'layers' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'layers' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <Layers size={16} />
          <span>Layers</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          style={{
            ...styles.tabButton,
            borderBottomColor: activeTab === 'stats' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'stats' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <BarChart3 size={16} />
          <span>Stats</span>
        </button>
        <button
          onClick={() => setActiveTab('cache')}
          style={{
            ...styles.tabButton,
            borderBottomColor: activeTab === 'cache' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'cache' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <Database size={16} />
          <span>Cache</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div style={styles.content}>
        {activeTab === 'layers' && (
          <div style={styles.tabPanel}>
            {/* Layer Checkboxes */}
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Toggle Visibility</h4>
              <div style={styles.checkboxGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showVisited}
                    onChange={(e) => onToggleVisited(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <div style={styles.checkboxTextContainer}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={styles.checkboxTitle}>Show Visited Route</span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'linear-gradient(90deg, #facc15 0%, #84cc16 100%)',
                        color: '#0f0a24',
                        letterSpacing: '0.02em'
                      }}>Yellow➔Lime</span>
                    </div>
                    <span style={styles.checkboxDesc}>{visitedCount} visited locations</span>
                  </div>
                </label>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showRoutes}
                    onChange={(e) => onToggleRoutes(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <div style={styles.checkboxTextContainer}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={styles.checkboxTitle}>Show Planned Route</span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'linear-gradient(90deg, #3b82f6 0%, #f43f5e 100%)',
                        color: '#ffffff',
                        letterSpacing: '0.02em'
                      }}>Blue➔Rose</span>
                    </div>
                    <span style={styles.checkboxDesc}>{placesCount} planned stops</span>
                  </div>
                </label>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showPeople}
                    onChange={(e) => {
                      if (!isAuthenticated) {
                        onPromptPassword();
                      } else {
                        onTogglePeople(e.target.checked);
                      }
                    }}
                    style={styles.checkbox}
                  />
                  <div style={styles.checkboxTextContainer}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={styles.checkboxTitle}>Show People</span>
                      {!isAuthenticated && <Lock size={13} color="#a78bfa" style={{ flexShrink: 0 }} />}
                    </div>
                    <span style={styles.checkboxDesc}>
                      {isAuthenticated 
                        ? `${peopleCount} people loaded` 
                        : 'Password protected (click to unlock)'}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* People Search */}
            {showPeople && isAuthenticated && (
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Filter People</h4>
                <div style={styles.searchContainer}>
                  <Search size={16} style={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div style={styles.tabPanel}>
            <h4 style={styles.sectionTitle}>Nominatim Geocoding API</h4>
            {stats ? (
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Cache Hit Rate</span>
                  <span style={styles.statVal}>{stats.cacheHitRate.toFixed(1)}%</span>
                  <div style={styles.progressBarBg}>
                    <div 
                      style={{
                        ...styles.progressBarFill,
                        width: `${stats.cacheHitRate}%`
                      }} 
                    />
                  </div>
                </div>
                <div style={styles.statSubGrid}>
                  <div style={styles.statSubCard}>
                    <span style={styles.statSubLabel}>Cache Hits</span>
                    <span style={styles.statSubVal}>{stats.cacheHits}</span>
                  </div>
                  <div style={styles.statSubCard}>
                    <span style={styles.statSubLabel}>API Calls</span>
                    <span style={styles.statSubVal}>{stats.apiCalls}</span>
                  </div>
                  <div style={styles.statSubCard}>
                    <span style={styles.statSubLabel}>Total Requests</span>
                    <span style={styles.statSubVal}>{stats.totalRequests}</span>
                  </div>
                  <div style={styles.statSubCard}>
                    <span style={styles.statSubLabel}>API Failures</span>
                    <span style={{...styles.statSubVal, color: stats.apiFailures > 0 ? '#ef4444' : 'var(--text-secondary)'}}>
                      {stats.apiFailures}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={styles.emptyText}>Loading statistics...</p>
            )}
          </div>
        )}

        {activeTab === 'cache' && (
          <div style={styles.tabPanel}>
            <h4 style={styles.sectionTitle}>Database Cache Actions</h4>
            <p style={styles.description}>
              Geocodes and OSRM routes are cached in IndexedDB locally to minimize API requests and load instantly.
            </p>
            
            <div style={styles.cacheActions}>
              <div style={styles.cacheRow}>
                <div style={styles.cacheInfo}>
                  <span style={styles.cacheTitle}>Geocoding Database</span>
                  <span style={styles.cacheDesc}>
                    {stats ? `${stats.cachedAddresses} addresses cached` : 'Counting...'}
                  </span>
                </div>
                <button
                  onClick={handleClearGeocode}
                  disabled={clearingGeocode}
                  style={{
                    ...styles.actionButton,
                    backgroundColor: geocodeClearedSuccess ? 'var(--success)' : 'rgba(239, 68, 68, 0.1)',
                    borderColor: geocodeClearedSuccess ? 'var(--success)' : 'rgba(239, 68, 68, 0.25)',
                    color: geocodeClearedSuccess ? '#ffffff' : '#f87171'
                  }}
                >
                  {clearingGeocode ? (
                    'Clearing...'
                  ) : geocodeClearedSuccess ? (
                    <Check size={16} />
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Clear</span>
                    </>
                  )}
                </button>
              </div>

              <div style={styles.cacheRow}>
                <div style={styles.cacheInfo}>
                  <span style={styles.cacheTitle}>OSRM Route Cache</span>
                  <span style={styles.cacheDesc}>Cached driving path coordinates</span>
                </div>
                <button
                  onClick={handleClearRoute}
                  disabled={clearingRoute}
                  style={{
                    ...styles.actionButton,
                    backgroundColor: routeClearedSuccess ? 'var(--success)' : 'rgba(239, 68, 68, 0.1)',
                    borderColor: routeClearedSuccess ? 'var(--success)' : 'rgba(239, 68, 68, 0.25)',
                    color: routeClearedSuccess ? '#ffffff' : '#f87171'
                  }}
                >
                  {clearingRoute ? (
                    'Clearing...'
                  ) : routeClearedSuccess ? (
                    <Check size={16} />
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Clear</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Summary Footer */}
      <div style={styles.footer}>
        <div 
          style={{
            ...styles.footerItem,
            cursor: !isAuthenticated ? 'pointer' : 'default'
          }}
          onClick={() => {
            if (!isAuthenticated) onPromptPassword();
          }}
          title={!isAuthenticated ? 'Click to unlock People layer' : undefined}
        >
          {isAuthenticated ? (
            <>
              <Users size={13} color="var(--primary)" />
              <span>{peopleCount} People</span>
            </>
          ) : (
            <>
              <Lock size={13} color="#a78bfa" />
              <span style={{ color: '#a78bfa' }}>People (Locked)</span>
            </>
          )}
        </div>
        <div style={styles.footerItem}>
          <CheckCircle2 size={13} color="#84cc16" />
          <span>{visitedCount} Visited</span>
        </div>
        <div style={styles.footerItem}>
          <MapPin size={13} color="var(--accent)" />
          <span>{placesCount} Planned</span>
        </div>
      </div>
    </div>
  );
};


const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    width: '320px',
    maxHeight: 'calc(100vh - 40px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    overflow: 'hidden',
    animation: 'slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    padding: '20px 20px 16px 20px',
    borderBottom: '1px solid var(--border-glass)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '18px',
    fontWeight: 700,
    color: '#ffffff',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid var(--border-glass)',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  tabButton: {
    flex: 1,
    padding: '12px 0',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  content: {
    padding: '20px',
    flex: 1,
    overflowY: 'auto',
  },
  tabPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkbox: {
    marginTop: '4px',
    accentColor: 'var(--primary)',
    cursor: 'pointer',
  },
  checkboxTextContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  checkboxTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
  },
  checkboxDesc: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '10px 10px 10px 36px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#ffffff',
    outline: 'none',
    transition: 'all 0.2s',
  },
  description: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  statsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-glass)',
    borderRadius: '10px',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  statVal: {
    fontSize: '24px',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    color: '#ffffff',
  },
  progressBarBg: {
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'var(--primary)',
    borderRadius: '2px',
    transition: 'width 0.5s ease-out',
  },
  statSubGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  statSubCard: {
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
  },
  statSubLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  statSubVal: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    marginTop: '2px',
  },
  cacheActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cacheRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-glass)',
    borderRadius: '10px',
    gap: '12px',
  },
  cacheInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  cacheTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#ffffff',
  },
  cacheDesc: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  actionButton: {
    padding: '8px 12px',
    border: '1px solid',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  emptyText: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  footer: {
    padding: '14px 20px',
    borderTop: '1px solid var(--border-glass)',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  footerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  collapsedButton: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 1000,
    outline: 'none',
  },
  headerTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  }
};
