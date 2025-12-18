
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  AlertTriangle, 
  Layers, 
  RefreshCw, 
  Activity, 
  Thermometer, 
  Database, 
  ChevronRight, 
  ChevronDown,
  Terminal,
  Gauge,
  Flame,
  Info
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- Constants & Types ---

const DEFAULT_CONFIG = {
  apiUrl: 'https://pc.bravokilo.cloud',
  refreshInterval: 60, // seconds
  mockMode: true, // For demo purposes if API is unreachable
};

type AppView = 'overview' | 'menu' | 'errors' | 'config';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

interface ApiVariable {
  uri: string;
  name: string;
  value: string;
  unit: string;
  strValue: string;
}

// --- Utilities ---

const parseXml = (xmlString: string) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, "text/xml");
};

const formatTimestamp = () => new Date().toLocaleTimeString();

// --- Main Application ---

export default function ETAtouchApp() {
  const [view, setView] = useState<AppView>('overview');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [db, setDb] = useState<{
    menu: any;
    variables: Record<string, ApiVariable>;
    history: Array<{ time: string; [key: string]: any }>;
    errors: any[];
    lastSync: string | null;
  }>({
    menu: null,
    variables: {},
    history: [],
    errors: [],
    lastSync: null
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef<number | null>(null);

  // Load config from "DB" (localStorage)
  useEffect(() => {
    const savedConfig = localStorage.getItem('eta_config');
    if (savedConfig) setConfig(JSON.parse(savedConfig));
    
    const savedDb = localStorage.getItem('eta_db');
    if (savedDb) setDb(JSON.parse(savedDb));

    addLog('System', 'info', 'Monitor initialized. Ready for sync.');
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('eta_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('eta_db', JSON.stringify(db));
  }, [db]);

  const addLog = (service: string, level: LogEntry['level'], message: string) => {
    setLogs(prev => [{
      timestamp: formatTimestamp(),
      level,
      message: `[${service}] ${message}`
    }, ...prev].slice(0, 50));
  };

  // --- Background "Service" Simulation ---

  const performSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addLog('SyncService', 'info', 'Starting background data fetch...');

    try {
      // In a real environment, we'd fetch from the actual API.
      // Since this is a UI prototype and might hit CORS, we'll simulate the response 
      // based on the provided PDF documentation if mockMode is on.
      
      if (config.mockMode) {
        await new Promise(r => setTimeout(r, 1500));
        
        // Mock Menu
        const mockMenu = {
          name: 'Kessel',
          uri: '/112/10021',
          children: [
            { name: 'Kessel-Temperatur', uri: '/112/10021/0/0/12161', value: '72.5', unit: '°C' },
            { name: 'Abgas-Temperatur', uri: '/112/10021/0/0/12162', value: '145.0', unit: '°C' },
            { name: 'Kessel-Soll', uri: '/112/10021/0/0/12001', value: '75.0', unit: '°C' },
          ]
        };

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newVars = {
          'boiler_temp': { uri: '/112/10021/0/0/12161', name: 'Boiler Temp', value: (70 + Math.random() * 5).toFixed(1), unit: '°C', strValue: '72°C' },
          'outside_temp': { uri: '/120/10021/0/0/12101', name: 'Outside Temp', value: (5 + Math.random() * 2).toFixed(1), unit: '°C', strValue: '5°C' },
          'load': { uri: '/112/10021/0/0/12153', name: 'Full Load Hours', value: '4520', unit: 'h', strValue: '4520h' }
        };

        setDb(prev => ({
          ...prev,
          menu: mockMenu,
          variables: { ...prev.variables, ...newVars },
          history: [...prev.history, { time: timestamp, boiler: parseFloat(newVars.boiler_temp.value), outside: parseFloat(newVars.outside_temp.value) }].slice(-20),
          lastSync: formatTimestamp(),
          errors: Math.random() > 0.9 ? [{ msg: "Sensor link disconnected", time: formatTimestamp() }] : prev.errors
        }));

        addLog('SyncService', 'success', 'Data stored in local database.');
      } else {
        // REAL API CALL CODE (Would be used with PHP proxy to bypass CORS)
        // const res = await fetch(`${config.apiUrl}/user/menu`);
        // const xml = await res.text();
        // ... parse xml ...
        addLog('SyncService', 'error', 'External API blocked by CORS. Please use PHP proxy or Mock Mode.');
      }
    } catch (e: any) {
      addLog('SyncService', 'error', `Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    performSync();
    syncIntervalRef.current = window.setInterval(performSync, config.refreshInterval * 1000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [config.refreshInterval]);

  // --- UI Components ---

  const Sidebar = () => (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full text-slate-300">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <Flame className="text-orange-500 w-8 h-8" />
        <h1 className="text-xl font-bold tracking-tight text-white">ETAtouch</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <NavItem active={view === 'overview'} icon={<LayoutDashboard size={18}/>} label="Overview" onClick={() => setView('overview')} />
        <NavItem active={view === 'menu'} icon={<Layers size={18}/>} label="Menu Tree" onClick={() => setView('menu')} />
        <NavItem active={view === 'errors'} icon={<AlertTriangle size={18}/>} label="Alerts" onClick={() => setView('errors')} count={db.errors.length} />
        <NavItem active={view === 'config'} icon={<Settings size={18}/>} label="Settings" onClick={() => setView('config')} />
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-3 text-xs">
          <div className="flex justify-between mb-1">
            <span>Sync Status:</span>
            <span className={isSyncing ? 'text-blue-400' : 'text-green-400'}>
              {isSyncing ? 'Syncing...' : 'Idle'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Last Update:</span>
            <span className="text-slate-400">{db.lastSync || 'Never'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const NavItem = ({ active, icon, label, onClick, count }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-orange-500/10 text-orange-500 font-medium' 
          : 'hover:bg-slate-800 text-slate-400'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {count > 0 && (
        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
          {count}
        </span>
      )}
    </button>
  );

  const StatCard = ({ title, value, unit, icon, color }: any) => (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-start justify-between">
      <div>
        <p className="text-slate-400 text-sm mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">{value}</span>
          <span className="text-slate-500 font-medium">{unit}</span>
        </div>
      </div>
      <div className={`p-3 rounded-xl bg-slate-800 ${color}`}>
        {icon}
      </div>
    </div>
  );

  const OverviewView = () => {
    const chartData = {
      labels: db.history.map(h => h.time),
      datasets: [
        {
          label: 'Boiler Temperature (°C)',
          data: db.history.map(h => h.boiler),
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Outside Temperature (°C)',
          data: db.history.map(h => h.outside),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        }
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          borderColor: '#334155',
          borderWidth: 1,
        }
      },
      scales: {
        y: { 
          grid: { color: '#1e293b' },
          ticks: { color: '#94a3b8' }
        },
        x: { 
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Boiler Temperature" 
            value={db.variables.boiler_temp?.value || '--'} 
            unit="°C" 
            icon={<Thermometer size={20}/>} 
            color="text-orange-500" 
          />
          <StatCard 
            title="Outside Temp" 
            value={db.variables.outside_temp?.value || '--'} 
            unit="°C" 
            icon={<Activity size={20}/>} 
            color="text-blue-500" 
          />
          <StatCard 
            title="System Load" 
            value="85" 
            unit="%" 
            icon={<Gauge size={20}/>} 
            color="text-emerald-500" 
          />
          <StatCard 
            title="Total Runtime" 
            value={db.variables.load?.value || '--'} 
            unit="h" 
            icon={<Database size={20}/>} 
            color="text-purple-500" 
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Activity size={18} className="text-orange-500" />
              Temperature Trends
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-xs text-slate-400">Boiler</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-xs text-slate-400">Outside</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    );
  };

  const TreeItem = ({ item, depth = 0 }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div className="select-none">
        <div 
          onClick={() => hasChildren && setIsOpen(!isOpen)}
          className={`flex items-center py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-sm ${depth === 0 ? 'bg-slate-800/30' : ''}`}
          style={{ marginLeft: `${depth * 1.5}rem` }}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown size={14} className="mr-2 text-slate-500" /> : <ChevronRight size={14} className="mr-2 text-slate-500" />
          ) : <div className="w-5" />}
          
          <span className="flex-1 text-slate-300">{item.name}</span>
          
          {item.value && (
            <div className="flex items-center gap-1">
              <span className="text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{item.value}</span>
              <span className="text-slate-500 text-xs w-6">{item.unit}</span>
            </div>
          )}
        </div>
        {isOpen && hasChildren && (
          <div className="mt-1">
            {item.children.map((child: any, idx: number) => (
              <TreeItem key={idx} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const MenuView = () => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
        <div>
          <h2 className="text-white font-semibold">CAN-Bus Tree Explorer</h2>
          <p className="text-slate-400 text-sm">Real-time object mapping from /user/menu</p>
        </div>
        <button onClick={performSync} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
          <RefreshCw size={18} className={isSyncing ? 'animate-spin text-orange-500' : ''} />
        </button>
      </div>
      <div className="p-4 overflow-y-auto max-h-[70vh]">
        {db.menu ? (
          <TreeItem item={db.menu} />
        ) : (
          <div className="py-20 text-center text-slate-500 italic">
            No menu data synchronized yet.
          </div>
        )}
      </div>
    </div>
  );

  const ErrorsView = () => (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <AlertTriangle className="text-red-500" />
        System Alerts
      </h2>
      {db.errors.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center">
          <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={32} />
          </div>
          <h3 className="text-white font-medium text-lg">System Healthy</h3>
          <p className="text-slate-500">No active errors or warnings reported by the CAN controller.</p>
        </div>
      ) : (
        db.errors.map((err, i) => (
          <div key={i} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-4">
            <div className="p-2 bg-red-500 text-white rounded-lg">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-medium">{err.msg}</h4>
              <p className="text-red-400/80 text-sm">{err.time}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const SettingsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in zoom-in-95 duration-300">
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Settings size={18} className="text-slate-400" />
            Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Base API URL</label>
              <input 
                type="text" 
                value={config.apiUrl} 
                onChange={(e) => setConfig({...config, apiUrl: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Refresh Interval (seconds)</label>
              <input 
                type="number" 
                value={config.refreshInterval} 
                onChange={(e) => setConfig({...config, refreshInterval: parseInt(e.target.value)})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-3 py-2">
              <input 
                type="checkbox" 
                checked={config.mockMode} 
                onChange={(e) => setConfig({...config, mockMode: e.target.checked})}
                id="mock-mode"
                className="w-4 h-4 accent-orange-500"
              />
              <label htmlFor="mock-mode" className="text-sm text-slate-300 cursor-pointer">
                Enable Mock Mode (Simulate API data)
              </label>
            </div>
            <button 
              onClick={performSync}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
              Manual Database Sync
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2 text-red-400">
            <AlertTriangle size={18} />
            Advanced
          </h3>
          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
            <p className="text-xs text-slate-400 mb-3">Deleting the local database will reset all historical trends and menu mappings.</p>
            <button 
              onClick={() => {
                if(confirm('Wipe local database?')) {
                  localStorage.removeItem('eta_db');
                  window.location.reload();
                }
              }}
              className="text-red-400 text-sm font-medium hover:underline flex items-center gap-2"
            >
              <Database size={14} />
              Clear Local Database Cache
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl flex flex-col h-[500px]">
        <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
            <Terminal size={14} className="text-emerald-400" />
            Background Service Logs
          </div>
          <button onClick={() => setLogs([])} className="text-xs text-slate-500 hover:text-slate-300 uppercase tracking-widest font-bold">Clear</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-600">[{log.timestamp}]</span>
              <span className={
                log.level === 'error' ? 'text-red-400' : 
                log.level === 'success' ? 'text-emerald-400' : 
                log.level === 'warn' ? 'text-orange-400' : 'text-blue-400'
              }>
                {log.message}
              </span>
            </div>
          ))}
          {logs.length === 0 && <div className="text-slate-700 italic">Waiting for process logs...</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-200 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white capitalize">{view}</h2>
            <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
              <Info size={14} className="text-slate-500" />
              Monitoring node: <span className="text-slate-300 font-mono">{config.apiUrl}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-semibold text-emerald-500 tracking-wider uppercase">Live Link Active</span>
             </div>
          </div>
        </header>

        {view === 'overview' && <OverviewView />}
        {view === 'menu' && <MenuView />}
        {view === 'errors' && <ErrorsView />}
        {view === 'config' && <SettingsView />}
      </main>
    </div>
  );
}
