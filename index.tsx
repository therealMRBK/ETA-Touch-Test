import React, { useState, useEffect, useCallback } from 'react';
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
  Clock,
  Server,
  Wifi,
  WifiOff,
  Zap,
  Globe,
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
import { format } from 'date-fns';

// Chart Registration
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// --- Types ---
type AppMode = 'mock' | 'live';
type View = 'dashboard' | 'tree' | 'config' | 'logs';

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

interface HeaterNode {
  name: string;
  uri?: string;
  value?: string | number;
  unit?: string;
  children?: HeaterNode[];
}

// --- Default Configuration ---
const DEFAULT_API_URL = "https://pc.bravokilo.cloud";
const MOCK_DELAY = 800;

// --- Helper Components ---

const StatusBadge = ({ active, label }: { active: boolean; label: string }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
    active 
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
  }`}>
    <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </div>
);

const MetricCard = ({ label, value, unit, icon: Icon, color = "orange" }: any) => {
  const colors: Record<string, string> = {
    orange: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    red: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    green: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };

  return (
    <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colors[color]} group-hover:scale-110 transition-transform`}>
          <Icon size={20} />
        </div>
        {unit && <span className="text-xs font-bold text-zinc-600 uppercase">{unit}</span>}
      </div>
      <div>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
        <div className="text-3xl font-bold text-white tracking-tight tabular-nums">
          {value}
        </div>
      </div>
    </div>
  );
};

// Recursive Tree Component for CAN-Bus Structure
const TreeNode = ({ node, depth = 0 }: { node: HeaterNode; depth?: number }) => {
  const [isOpen, setIsOpen] = useState(depth < 2); // Auto-open first levels
  const hasChildren = node.children && node.children.length > 0;
  const hasValue = node.value !== undefined && node.value !== null;

  return (
    <div className="select-none">
      <div 
        className={`
          flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors
          ${depth === 0 ? 'bg-zinc-900/50 mb-2 border border-zinc-800' : 'hover:bg-zinc-800/50'}
        `}
        style={{ marginLeft: depth > 0 ? `${depth * 12}px` : 0 }}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) setIsOpen(!isOpen);
        }}
      >
        <div className="w-4 flex justify-center text-zinc-600">
          {hasChildren && (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </div>
        
        <div className="flex-1 flex justify-between items-center">
          <span className={`text-sm ${depth === 0 ? 'font-bold text-white' : 'font-medium text-zinc-400'}`}>
            {node.name}
          </span>
          
          {hasValue && (
            <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-zinc-800">
              <span className="text-orange-500 font-mono text-xs font-bold">{node.value}</span>
              {node.unit && <span className="text-[10px] text-zinc-600 font-bold uppercase">{node.unit}</span>}
            </div>
          )}
        </div>
      </div>
      
      {isOpen && hasChildren && (
        <div className="border-l border-zinc-800 ml-[15px]">
          {node.children!.map((child, idx) => (
            <TreeNode key={`${child.name}-${idx}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main App ---

export default function ETAtouchApp() {
  const [view, setView] = useState<View>('dashboard');
  const [mode, setMode] = useState<AppMode>('mock');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [refreshInterval, setRefreshInterval] = useState(10); // Seconds
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Data State
  const [data, setData] = useState<any>({
    metrics: { boiler: 0, outside: 0, exhaust: 0, bufferTop: 0, bufferBottom: 0, pellets: 0 },
    history: [],
    tree: []
  });

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: format(new Date(), 'HH:mm:ss'),
      message,
      type
    };
    setLogs(prev => [entry, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  // --- Data Fetching Logic (The "PHP Proxy" Consumer) ---
  const fetchData = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    try {
      if (mode === 'live') {
        addLog(`Fetching data from ${apiUrl}/data.json`, 'info');
        // This expects the PHP script to have dumped data here
        const response = await fetch(`${apiUrl}/data.json`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const jsonData = await response.json();
        
        // Transform the data for our UI
        // Assuming PHP gives us a clean JSON structure
        setData((prev: any) => ({
            ...jsonData,
            history: [...prev.history, { 
                time: format(new Date(), 'HH:mm'), 
                boiler: jsonData.metrics.boiler,
                outside: jsonData.metrics.outside 
            }].slice(-20)
        }));
        
        addLog('Data synced successfully from Server', 'success');

      } else {
        // MOCK MODE: Simulate the PHP backend response
        await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
        
        const now = new Date();
        const mockMetrics = {
          boiler: 60 + Math.random() * 15, // 60-75
          outside: 5 + Math.random() * 5,  // 5-10
          exhaust: 140 + Math.random() * 20,
          bufferTop: 65 + Math.random() * 5,
          bufferBottom: 40 + Math.random() * 5,
          pellets: 2450 // kg
        };

        const mockTree: HeaterNode[] = [
            {
                name: "ETA PE-K 15kW",
                children: [
                    {
                        name: "Kessel",
                        children: [
                            { name: "Kessel", value: mockMetrics.boiler.toFixed(1), unit: "°C" },
                            { name: "Kessel Soll", value: "70.0", unit: "°C" },
                            { name: "Rücklauf", value: "58.2", unit: "°C" },
                            { name: "Abgas", value: mockMetrics.exhaust.toFixed(0), unit: "°C" },
                            { name: "Gebläse", value: "1850", unit: "U/min" },
                        ]
                    },
                    {
                        name: "Puffer",
                        children: [
                            { name: "Puffer Oben", value: mockMetrics.bufferTop.toFixed(1), unit: "°C" },
                            { name: "Puffer Unten", value: mockMetrics.bufferBottom.toFixed(1), unit: "°C" },
                            { name: "Ladezustand", value: "68", unit: "%" }
                        ]
                    },
                    {
                        name: "Heizkreis",
                        children: [
                            { name: "Vorlauf", value: "42.5", unit: "°C" },
                            { name: "Außentemperatur", value: mockMetrics.outside.toFixed(1), unit: "°C" },
                            { name: "Pumpe", value: "Ein", unit: "" }
                        ]
                    },
                    {
                        name: "Lager",
                        children: [
                            { name: "Vorrat", value: mockMetrics.pellets, unit: "kg" },
                            { name: "Verbrauch Gesamt", value: "12500", unit: "kg" }
                        ]
                    }
                ]
            }
        ];

        setData((prev: any) => ({
            metrics: mockMetrics,
            tree: mockTree,
            history: [...prev.history, { 
                time: format(now, 'HH:mm:ss'), 
                boiler: mockMetrics.boiler,
                outside: mockMetrics.outside 
            }].slice(-30) // Keep last 30 points
        }));
        
        addLog('Mock data generated successfully', 'success');
      }
      setLastSync(new Date());
    } catch (e: any) {
      addLog(`Sync Failed: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, mode, apiUrl]);

  // Polling Effect
  useEffect(() => {
    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [refreshInterval, mode, apiUrl]); // Re-run if config changes

  // --- Views ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Kessel Temp" value={data.metrics.boiler.toFixed(1)} unit="°C" icon={Thermometer} color="orange" />
        <MetricCard label="Außen Temp" value={data.metrics.outside.toFixed(1)} unit="°C" icon={Activity} color="blue" />
        <MetricCard label="Abgas" value={data.metrics.exhaust.toFixed(0)} unit="°C" icon={Gauge} color="red" />
        <MetricCard label="Puffer Oben" value={data.metrics.bufferTop.toFixed(1)} unit="°C" icon={Database} color="green" />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
            <Activity size={100} className="text-orange-500" />
        </div>
        <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap size={20} className="text-orange-500" />
                Live Temperatur Verlauf
            </h3>
            <div className="flex gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                    <span className="w-3 h-3 bg-orange-500 rounded-full"></span> Kessel
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span> Außen
                </div>
            </div>
        </div>
        <div className="h-[300px] w-full relative z-10">
            <Line 
                data={{
                    labels: data.history.map((h: any) => h.time),
                    datasets: [
                        {
                            label: 'Kessel',
                            data: data.history.map((h: any) => h.boiler),
                            borderColor: '#f97316',
                            backgroundColor: 'rgba(249, 115, 22, 0.05)',
                            borderWidth: 3,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 0
                        },
                        {
                            label: 'Außen',
                            data: data.history.map((h: any) => h.outside),
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            tension: 0.4,
                            pointRadius: 0
                        }
                    ]
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#52525b', font: { family: 'JetBrains Mono' } } },
                        y: { grid: { color: '#27272a' }, ticks: { color: '#52525b', font: { family: 'JetBrains Mono' } } }
                    }
                }}
            />
        </div>
      </div>
    </div>
  );

  const renderTree = () => (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 min-h-[500px] animate-fade-in">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800">
            <Layers className="text-orange-500" />
            <h2 className="text-xl font-bold text-white">CAN-Bus Explorer</h2>
        </div>
        <div className="space-y-1">
            {data.tree.length === 0 ? (
                <div className="text-center py-20 text-zinc-600">
                    <RefreshCw className="mx-auto mb-4 animate-spin" />
                    Lade Struktur...
                </div>
            ) : (
                data.tree.map((node: HeaterNode, i: number) => <TreeNode key={i} node={node} />)
            )}
        </div>
    </div>
  );

  const renderLogs = () => (
    <div className="bg-black border border-zinc-800 rounded-3xl overflow-hidden flex flex-col h-[600px] animate-fade-in">
        <div className="bg-zinc-900/80 p-4 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs font-bold uppercase">
                <Terminal size={14} /> System Protokoll
            </div>
            <button onClick={() => setLogs([])} className="text-xs text-orange-500 hover:text-orange-400 font-bold">CLEAR</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
            {logs.map(log => (
                <div key={log.id} className="flex gap-3 hover:bg-zinc-900/50 p-1 rounded">
                    <span className="text-zinc-600 select-none">[{log.timestamp}]</span>
                    <span className={
                        log.type === 'error' ? 'text-rose-500' : 
                        log.type === 'success' ? 'text-emerald-500' : 
                        log.type === 'warning' ? 'text-amber-500' : 'text-zinc-300'
                    }>
                        {log.type === 'info' && <span className="text-blue-500 font-bold mr-2">INFO</span>}
                        {log.type === 'error' && <span className="text-rose-500 font-bold mr-2">ERR </span>}
                        {log.type === 'success' && <span className="text-emerald-500 font-bold mr-2">OK  </span>}
                        {log.message}
                    </span>
                </div>
            ))}
            {logs.length === 0 && <div className="text-zinc-700 text-center mt-20">Keine Einträge</div>}
        </div>
    </div>
  );

  const renderConfig = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-8">
                <Settings className="text-orange-500" size={24} />
                <h2 className="text-2xl font-bold text-white">Konfiguration</h2>
            </div>
            
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">API Base URL</label>
                    <div className="relative">
                        <Globe className="absolute left-4 top-3.5 text-zinc-600" size={16} />
                        <input 
                            type="text" 
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white font-mono text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-600">Ziel für den PHP-Dienst (Proxy). Muss CORS Header erlauben oder lokal liegen.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Poll Intervall (Sek)</label>
                        <div className="relative">
                            <Clock className="absolute left-4 top-3.5 text-zinc-600" size={16} />
                            <input 
                                type="number" 
                                value={refreshInterval}
                                min={1}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white font-mono text-sm focus:border-orange-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                     <div>
                        <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Daten Modus</label>
                        <div className="flex bg-black rounded-xl p-1 border border-zinc-800">
                            <button 
                                onClick={() => setMode('mock')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'mock' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                MOCK (Demo)
                            </button>
                            <button 
                                onClick={() => setMode('live')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'live' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                LIVE (PHP)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-6">
            <h4 className="text-orange-500 font-bold mb-2 flex items-center gap-2">
                <Info size={16} /> PHP Backend Anleitung
            </h4>
            <p className="text-xs text-orange-200/70 leading-relaxed">
                Damit der "Live" Modus funktioniert, muss auf <code>{apiUrl}</code> ein Skript laufen, 
                welches die Daten von der Heizung abruft und als <code>data.json</code> bereitstellt.
                Dies umgeht CORS-Probleme im Browser.
            </p>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-black text-zinc-300 font-sans selection:bg-orange-500/30">
      
      {/* Sidebar Navigation */}
      <nav className="w-80 border-r border-zinc-900 bg-zinc-950/50 flex flex-col p-6 backdrop-blur-xl z-50">
        <div className="mb-12 px-2">
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-orange-600 p-2.5 rounded-xl shadow-lg shadow-orange-900/20">
                    <Flame size={24} className="text-white" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tighter">
                    ETA<span className="text-orange-500">touch</span>
                </h1>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 pl-1">
                Advanced Heating Control
            </div>
        </div>

        <div className="space-y-2 flex-1">
            <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={LayoutDashboard} label="Übersicht" />
            <NavButton active={view === 'tree'} onClick={() => setView('tree')} icon={Layers} label="Daten Explorer" />
            <NavButton active={view === 'logs'} onClick={() => setView('logs')} icon={Terminal} label="System Logs" />
            <NavButton active={view === 'config'} onClick={() => setView('config')} icon={Settings} label="Einstellungen" />
        </div>

        {/* Connection Status Footer */}
        <div className="mt-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase">Verbindung</span>
                {isSyncing ? (
                    <RefreshCw size={14} className="text-orange-500 animate-spin" />
                ) : mode === 'live' ? (
                    <Wifi size={14} className="text-emerald-500" />
                ) : (
                    <WifiOff size={14} className="text-zinc-600" />
                )}
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-400">Modus</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${mode === 'live' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                        {mode.toUpperCase()}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-400">Letzter Sync</span>
                    <span className="text-xs font-mono text-zinc-500">
                        {lastSync ? format(lastSync, 'HH:mm:ss') : '--:--:--'}
                    </span>
                </div>
            </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-zinc-900 to-black pointer-events-none" />
        
        <div className="h-full overflow-y-auto p-10 relative z-10">
            <header className="flex justify-between items-end mb-10">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tight mb-2">
                        {view === 'dashboard' && 'Dashboard'}
                        {view === 'tree' && 'Daten Explorer'}
                        {view === 'config' && 'System Setup'}
                        {view === 'logs' && 'Ereignis Protokoll'}
                    </h2>
                    <p className="text-zinc-500 font-medium">
                        {view === 'dashboard' && 'Echtzeit-Überwachung der Kesselparameter'}
                        {view === 'tree' && 'Detaillierte Ansicht der CAN-Bus Hierarchie'}
                        {view === 'config' && 'Verbindungseinstellungen und Backend-Konfiguration'}
                        {view === 'logs' && 'Technische Diagnosedaten des Sync-Dienstes'}
                    </p>
                </div>
                <div className="flex gap-4">
                    <StatusBadge active={!isSyncing} label={isSyncing ? "Syncing..." : "Bereit"} />
                </div>
            </header>

            {view === 'dashboard' && renderDashboard()}
            {view === 'tree' && renderTree()}
            {view === 'logs' && renderLogs()}
            {view === 'config' && renderConfig()}
        </div>
      </main>
    </div>
  );
}

// Sub-component for Nav
const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button 
        onClick={onClick}
        className={`
            w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 group
            ${active 
                ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/20 translate-x-1' 
                : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'}
        `}
    >
        <Icon size={20} className={active ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-300'} />
        <span className="font-bold text-sm tracking-wide">{label}</span>
        {active && <ChevronRight size={16} className="ml-auto opacity-50" />}
    </button>
);