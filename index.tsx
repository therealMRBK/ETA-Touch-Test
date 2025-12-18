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
  Info,
  Clock,
  Globe,
  HardDrive
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

// ChartJS Registrierung
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

// --- Typen & Konfiguration ---

type View = 'overview' | 'menu' | 'alerts' | 'config';

const DEFAULT_CONFIG = {
  apiUrl: 'https://pc.bravokilo.cloud',
  refreshInterval: 10, // Sekunden
  mockMode: true,
};

// --- Hauptkomponente ---

export default function ETAtouchApp() {
  const [view, setView] = useState<View>('overview');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [logs, setLogs] = useState<{time: string, msg: string, type: string}[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Daten-State (Repräsentiert die "Datenbank" des PHP-Dienstes)
  const [data, setData] = useState({
    boilerTemp: 68.4,
    outsideTemp: 7.2,
    exhaustTemp: 135.0,
    runtime: 12450,
    history: [] as any[],
    menuTree: null as any,
    alerts: [] as any[]
  });

  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{
      time: new Date().toLocaleTimeString(),
      msg,
      type
    }, ...prev].slice(0, 50));
  }, []);

  // --- Daten-Abgleich (HTTP Polling) ---
  const performSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addLog(`GET ${config.apiUrl}/user/menu - Starte HTTP-Abruf...`, 'info');

    try {
      // Simulation des PHP-Services
      if (config.mockMode) {
        await new Promise(r => setTimeout(r, 800)); // Latenz simulieren
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const nextBoiler = 65 + Math.random() * 10;
        const nextOutside = 5 + Math.random() * 5;

        setData(prev => ({
          ...prev,
          boilerTemp: Number(nextBoiler.toFixed(1)),
          outsideTemp: Number(nextOutside.toFixed(1)),
          history: [...prev.history, { time: timeStr, boiler: nextBoiler, outside: nextOutside }].slice(-20),
          menuTree: {
            name: "ETA PE-K 15",
            children: [
              { 
                name: "Kessel", 
                children: [
                  { name: "Kessel-Temperatur", value: nextBoiler.toFixed(1), unit: "°C" },
                  { name: "Abgas-Temperatur", value: "138.5", unit: "°C" },
                  { name: "Kessel-Soll", value: "75.0", unit: "°C" },
                  { name: "Zündung Status", value: "Ein", unit: "" }
                ]
              },
              {
                name: "Lagerung",
                children: [
                  { name: "Vorrat Pellets", value: "2450", unit: "kg" },
                  { name: "Füllstand", value: "65", unit: "%" }
                ]
              },
              {
                name: "Heizkreis 1",
                children: [
                  { name: "Vorlauf-Ist", value: "45.2", unit: "°C" },
                  { name: "Vorlauf-Soll", value: "48.0", unit: "°C" }
                ]
              }
            ]
          }
        }));
        setLastUpdate(now.toLocaleTimeString());
        addLog(`Synchronisation erfolgreich. HTTP 200 OK.`, 'success');
      } else {
        // Hier würde der echte Fetch zum PHP-Script erfolgen:
        // const res = await fetch('/api/get_data.php');
        addLog(`Direkter API-Zugriff blockiert (CORS). Bitte PHP-Proxy oder Mock-Modus nutzen.`, 'error');
      }
    } catch (err: any) {
      addLog(`Fehler beim Abgleich: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [config, isSyncing, addLog]);

  useEffect(() => {
    performSync();
    const interval = setInterval(performSync, config.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [config.refreshInterval, config.apiUrl, performSync]);

  // --- UI Komponenten ---

  const StatCard = ({ label, value, unit, icon: Icon, colorClass }: any) => (
    <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl bg-slate-800/50 ${colorClass}`}>
          <Icon size={24} />
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-3xl font-black text-white tracking-tighter">{value}</span>
            <span className="text-slate-500 font-bold text-sm uppercase">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const RecursiveNode = ({ item, depth = 0 }: any) => {
    const [open, setOpen] = useState(depth === 0);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div className={`${depth > 0 ? 'ml-6 border-l border-slate-800 pl-4' : ''} my-1`}>
        <div 
          className={`flex items-center p-2.5 rounded-xl transition-all ${hasChildren ? 'cursor-pointer hover:bg-slate-800' : 'cursor-default'}`}
          onClick={() => hasChildren && setOpen(!open)}
        >
          {hasChildren ? (
            open ? <ChevronDown size={14} className="mr-2 text-slate-500" /> : <ChevronRight size={14} className="mr-2 text-slate-500" />
          ) : <div className="w-5" />}
          <span className={`text-sm ${hasChildren ? 'text-slate-200 font-semibold' : 'text-slate-400'}`}>{item.name}</span>
          {item.value && (
            <div className="ml-auto flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-lg border border-slate-800/50">
              <span className="text-orange-500 font-mono text-xs font-bold">{item.value}</span>
              <span className="text-slate-600 text-[10px] uppercase font-bold">{item.unit}</span>
            </div>
          )}
        </div>
        {open && hasChildren && (
          <div className="mt-1">
            {item.children.map((c: any, i: number) => <RecursiveNode key={i} item={c} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-black text-slate-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-900 bg-slate-950 flex flex-col p-8">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-orange-600 p-2.5 rounded-2xl shadow-xl shadow-orange-900/20">
            <Flame size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-none">ETA<span className="text-orange-500">touch</span></h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Heating Intelligence</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'menu', label: 'CAN-Bus Baum', icon: Layers },
            { id: 'alerts', label: 'Störungen', icon: AlertTriangle, count: data.alerts.length },
            { id: 'config', label: 'Konfiguration', icon: Settings }
          ].map(nav => (
            <button 
              key={nav.id}
              onClick={() => setView(nav.id as View)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm ${
                view === nav.id 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
              }`}
            >
              <nav.icon size={20} />
              {nav.label}
              {nav.count ? <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{nav.count}</span> : null}
            </button>
          ))}
        </nav>

        <div className="mt-auto bg-slate-900/40 p-5 rounded-3xl border border-slate-800/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase text-slate-500">Service Status</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-orange-500 animate-ping' : 'bg-emerald-500'}`}></span>
              <span className="text-[10px] font-bold text-white uppercase">{isSyncing ? 'Syncing' : 'Bereit'}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-600 font-mono">
            DB-LastUpdate: {lastUpdate || 'Nie'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-tr from-black via-slate-950 to-slate-900 p-12">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-5xl font-black text-white mb-3 tracking-tighter uppercase">{view}</h2>
              <div className="flex items-center gap-6 text-slate-500 text-sm font-semibold">
                <span className="flex items-center gap-2"><Globe size={16} /> {config.apiUrl}</span>
                <span className="flex items-center gap-2"><Clock size={16} /> Intervall: {config.refreshInterval}s</span>
              </div>
            </div>
            <button 
              onClick={performSync}
              disabled={isSyncing}
              className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
              Manual Sync
            </button>
          </header>

          {view === 'overview' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Kessel-Ist" value={data.boilerTemp} unit="°C" icon={Thermometer} colorClass="text-orange-500" />
                <StatCard label="Außen-Temperatur" value={data.outsideTemp} unit="°C" icon={Activity} colorClass="text-blue-400" />
                <StatCard label="Abgas-Temperatur" value={data.exhaustTemp} unit="°C" icon={Gauge} colorClass="text-rose-500" />
                <StatCard label="Laufzeit" value={data.runtime} unit="Std" icon={HardDrive} colorClass="text-emerald-400" />
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-10 rounded-[40px] shadow-2xl">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black text-white flex items-center gap-3">
                    <Activity size={24} className="text-orange-500" />
                    TEMPERATUR-TRENDS
                  </h3>
                  <div className="flex gap-6 text-[10px] font-black tracking-widest uppercase">
                    <span className="flex items-center gap-2"><span className="w-3 h-1 bg-orange-500 rounded-full"></span> Kessel</span>
                    <span className="flex items-center gap-2"><span className="w-3 h-1 bg-blue-400 rounded-full"></span> Außen</span>
                  </div>
                </div>
                <div className="h-96">
                  <Line 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { 
                          grid: { color: 'rgba(255,255,255,0.03)' }, 
                          ticks: { color: '#475569', font: { weight: 'bold' } } 
                        },
                        x: { 
                          grid: { display: false }, 
                          ticks: { color: '#475569', font: { weight: 'bold' } } 
                        }
                      }
                    }}
                    data={{
                      labels: data.history.map(h => h.time),
                      datasets: [
                        {
                          data: data.history.map(h => h.boiler),
                          borderColor: '#f97316',
                          backgroundColor: 'rgba(249, 115, 22, 0.05)',
                          fill: true,
                          tension: 0.4,
                          borderWidth: 4,
                          pointRadius: 0
                        },
                        {
                          data: data.history.map(h => h.outside),
                          borderColor: '#60a5fa',
                          backgroundColor: 'rgba(96, 165, 250, 0.05)',
                          fill: true,
                          tension: 0.4,
                          borderWidth: 4,
                          pointRadius: 0
                        }
                      ]
                    }} 
                  />
                </div>
              </div>
            </div>
          )}

          {view === 'menu' && (
            <div className="bg-slate-900/60 border border-slate-800 p-10 rounded-[40px] shadow-2xl">
              {data.menuTree ? <RecursiveNode item={data.menuTree} /> : <div className="p-20 text-center text-slate-600 font-bold uppercase tracking-widest">Warte auf Daten...</div>}
            </div>
          )}

          {view === 'alerts' && (
            <div className="space-y-6">
              {data.alerts.length === 0 ? (
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-20 rounded-[40px] text-center">
                  <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <Database size={48} />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-4">SYSTEM NOMINAL</h3>
                  <p className="text-slate-500 max-w-md mx-auto font-medium">Keine aktiven Störungen oder Warnungen im Heizkreis erkannt.</p>
                </div>
              ) : null}
            </div>
          )}

          {view === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-slate-900/60 border border-slate-800 p-10 rounded-[40px]">
                <h3 className="text-2xl font-black text-white flex items-center gap-3 mb-8 uppercase tracking-tight">
                  <Settings size={24} className="text-slate-500" />
                  Basis-Konfiguration
                </h3>
                <div className="space-y-8">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">API Basis-URL (ETAtouch Adresse)</label>
                    <input 
                      type="text" 
                      value={config.apiUrl} 
                      onChange={e => setConfig({...config, apiUrl: e.target.value})}
                      className="w-full bg-black/40 border-2 border-slate-800 focus:border-orange-500 rounded-2xl px-6 py-4 text-white outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Abruf-Intervall (Sekunden)</label>
                    <input 
                      type="number" 
                      value={config.refreshInterval} 
                      onChange={e => setConfig({...config, refreshInterval: Number(e.target.value)})}
                      className="w-full bg-black/40 border-2 border-slate-800 focus:border-orange-500 rounded-2xl px-6 py-4 text-white outline-none transition-all font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-4 p-6 bg-orange-500/5 rounded-3xl border-2 border-orange-500/20">
                    <input 
                      type="checkbox" 
                      checked={config.mockMode} 
                      onChange={e => setConfig({...config, mockMode: e.target.checked})}
                      id="mock"
                      className="w-6 h-6 accent-orange-600 cursor-pointer"
                    />
                    <label htmlFor="mock" className="text-sm font-bold text-slate-200 cursor-pointer">Simulation-Modus (Demo-Daten statt Live-API)</label>
                  </div>
                </div>
              </div>

              <div className="bg-black/80 border border-slate-800 rounded-[40px] flex flex-col h-[600px] shadow-inner">
                <div className="p-8 border-b border-slate-900 flex justify-between items-center">
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    <Terminal size={18} className="text-emerald-500" />
                    SYNC-DIENST LOGS (HTTP ONLY)
                  </div>
                  <button onClick={() => setLogs([])} className="text-[10px] font-black hover:text-white transition-colors text-slate-700">RESET</button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 font-mono text-xs space-y-3">
                  {logs.map((l, i) => (
                    <div key={i} className="flex gap-4 border-l-2 border-slate-900 pl-4 py-1">
                      <span className="text-slate-700 font-bold whitespace-nowrap">[{l.time}]</span>
                      <span className={l.type === 'error' ? 'text-rose-500' : l.type === 'success' ? 'text-emerald-400' : 'text-orange-500/70'}>
                        {l.msg}
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-slate-800 italic uppercase text-[10px] font-black">Warte auf Service-Start...</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
