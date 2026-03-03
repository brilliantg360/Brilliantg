import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Globe, 
  AlertCircle, 
  RefreshCw, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  Zap,
  Wallet,
  LayoutDashboard,
  ExternalLink,
  Settings,
  Bell,
  History,
  CheckCircle2,
  XCircle,
  Play,
  Calendar,
  ShieldCheck,
  Target,
  BarChart
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  ReferenceArea,
  Label
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { getForexAnalysis, getMarketNews, MarketSignal, BacktestResult, backtestForex, getEconomicCalendar, EconomicEvent } from './services/geminiService';
import { getOandaAccountSummary, getOandaPositions, OandaAccountSummary, OandaPosition } from './services/brokerService';
import TradingViewWidget from './components/TradingViewWidget';

// Mock data for initial state and charts
const MAJOR_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];

const generateMockHistory = (base: number) => {
  return Array.from({ length: 20 }, (_, i) => ({
    time: `${i}:00`,
    price: base + (Math.random() - 0.5) * 0.01
  }));
};

const PAIR_BASES: Record<string, number> = {
  'EUR/USD': 1.0850,
  'GBP/USD': 1.2640,
  'USD/JPY': 150.20,
  'AUD/USD': 0.6530,
  'USD/CAD': 1.3510,
};

export default function App() {
  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [analysis, setAnalysis] = useState<MarketSignal | null>(null);
  const [news, setNews] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>(PAIR_BASES);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>(PAIR_BASES);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'analysis' | 'chart' | 'broker' | 'backtest' | 'calendar'>('analysis');
  const [brokerData, setBrokerData] = useState<OandaAccountSummary | null>(null);
  const [positions, setPositions] = useState<OandaPosition[]>([]);
  const [alerts, setAlerts] = useState<{id: string, pair: string, action: string, strategy: string, time: string, confidence: number}[]>([]);
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [latestAlert, setLatestAlert] = useState<any>(null);
  const [confirmationMode, setConfirmationMode] = useState(false);

  // Backtest state
  const [backtestParams, setBacktestParams] = useState({
    startDate: '2024-01-01',
    endDate: '2024-02-01',
    initialBalance: 10000,
    riskPerTrade: 1
  });
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtesting, setBacktesting] = useState(false);

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<EconomicEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarFilters, setCalendarFilters] = useState({
    currency: 'ALL',
    impact: 'ALL'
  });

  const fetchData = async (pair: string, isConfirmation: boolean = confirmationMode) => {
    setLoading(true);
    try {
      // Fetch analysis first as it's the most critical
      const analysisData = await getForexAnalysis(pair, isConfirmation);
      setAnalysis(analysisData);
      
      // Update price and history with real data
      if (analysisData.currentPrice > 0) {
        setPrices(prev => ({ ...prev, [pair]: analysisData.currentPrice }));
      }
      if (analysisData.history && analysisData.history.length > 0) {
        setHistory(analysisData.history);
      } else {
        setHistory(generateMockHistory(analysisData.currentPrice || prices[pair]));
      }

      // Trigger alert if signal is strong
      if (analysisData.action !== 'NEUTRAL' && analysisData.confidence >= 70) {
        const newAlert = {
          id: Math.random().toString(36).substr(2, 9),
          pair: analysisData.pair,
          action: analysisData.action,
          strategy: analysisData.strategy,
          time: new Date().toLocaleTimeString(),
          confidence: analysisData.confidence
        };
        setAlerts(prev => [newAlert, ...prev].slice(0, 10));
        setLatestAlert(newAlert);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }

      // Fetch other data in background with slight delay to avoid rate limits
      setTimeout(async () => {
        try {
          const [newsData, calendarData] = await Promise.all([
            getMarketNews(),
            getEconomicCalendar()
          ]);
          setNews(newsData);
          setCalendarEvents(calendarData);
        } catch (e) {
          console.error("Background fetch error:", e);
        }
      }, 1000);

      // Broker data can be fetched independently
      const [brokerSummary, brokerPositions] = await Promise.all([
        getOandaAccountSummary(),
        getOandaPositions()
      ]);
      setBrokerData(brokerSummary);
      setPositions(brokerPositions);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedPair, confirmationMode);
    
    // Simulate live price updates
    const interval = setInterval(() => {
      setPrices(prev => {
        setPrevPrices(prev);
        const next = { ...prev };
        Object.keys(next).forEach(p => {
          next[p] = next[p] + (Math.random() - 0.5) * 0.0005;
        });
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedPair]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(selectedPair, confirmationMode);
    setRefreshing(false);
  };

  const runBacktest = async () => {
    setBacktesting(true);
    try {
      const result = await backtestForex(
        selectedPair,
        backtestParams.startDate,
        backtestParams.endDate,
        backtestParams.initialBalance,
        backtestParams.riskPerTrade
      );
      setBacktestResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setBacktesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-zinc-100 flex flex-col data-grid">
      {/* Notification Overlay */}
      <AnimatePresence>
        {showNotification && latestAlert && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -100, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[100] w-full max-w-md px-4"
          >
            <div className={cn(
              "p-4 rounded-2xl border shadow-2xl flex items-center gap-4 backdrop-blur-xl",
              latestAlert.action === 'BUY' ? "bg-brand-accent/20 border-brand-accent/50" : "bg-brand-danger/20 border-brand-danger/50"
            )}>
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                latestAlert.action === 'BUY' ? "bg-brand-accent text-brand-bg" : "bg-brand-danger text-white"
              )}>
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">New Signal Alert</span>
                  <span className="text-[10px] font-mono opacity-40">{latestAlert.time}</span>
                </div>
                <h4 className="text-lg font-black tracking-tight">
                  {latestAlert.action} {latestAlert.pair}
                </h4>
                <p className="text-xs font-bold text-brand-accent/80 uppercase tracking-widest mb-1">{latestAlert.strategy}</p>
                <p className="text-xs opacity-70">Strong trend detected with {latestAlert.confidence}% confidence.</p>
              </div>
              <button onClick={() => setShowNotification(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <XCircle className="w-5 h-5 opacity-40" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-brand-border bg-brand-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center">
              <Zap className="text-brand-bg w-5 h-5 fill-current" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">TrendPulse <span className="text-brand-accent">Forex</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-full bg-brand-border/50 border border-brand-border">
              <div className={cn(
                "w-2 h-2 rounded-full",
                brokerData ? "bg-brand-accent animate-pulse" : "bg-zinc-600"
              )} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {brokerData ? `${brokerData.balance} ${brokerData.currency}` : "Broker Offline"}
              </span>
              {brokerData && (
                <div className="flex items-center gap-2 border-l border-brand-border pl-2">
                  <span className={cn(
                    "text-[10px] font-mono font-bold",
                    parseFloat(brokerData.pl) >= 0 ? "text-brand-accent" : "text-brand-danger"
                  )}>
                    {parseFloat(brokerData.pl) > 0 ? '+' : ''}{brokerData.pl}
                  </span>
                </div>
              )}
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
              {MAJOR_PAIRS.map(pair => (
                <div key={pair} className="flex items-center gap-2">
                  <span>{pair}</span>
                  <span className={cn(
                    "font-mono transition-colors duration-500",
                    prices[pair] >= prevPrices[pair] ? "text-brand-accent" : "text-brand-danger"
                  )}>
                    {prices[pair].toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
            <button 
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="p-2 hover:bg-brand-border rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-5 h-5", (loading || refreshing) && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Pair Selection & Chart */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Recommendation Banner */}
          {!loading && analysis && analysis.action !== 'NEUTRAL' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-4 rounded-2xl border flex items-center gap-4 shadow-lg",
                analysis.action === 'BUY' ? "bg-brand-accent/10 border-brand-accent/30" : "bg-brand-danger/10 border-brand-danger/30"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                analysis.action === 'BUY' ? "bg-brand-accent text-brand-bg" : "bg-brand-danger text-brand-bg"
              )}>
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em]",
                    analysis.action === 'BUY' ? "text-brand-accent" : "text-brand-danger"
                  )}>
                    Active Recommendation
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                </div>
                <h3 className="text-lg font-bold truncate tracking-tight">{analysis.verdict}</h3>
                <p className="text-xs text-zinc-400 font-medium">{analysis.setup}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-brand-accent text-brand-bg font-bold rounded-lg text-xs hover:opacity-90 transition-opacity">
                  BUY
                </button>
                <button className="px-4 py-2 bg-brand-danger text-brand-bg font-bold rounded-lg text-xs hover:opacity-90 transition-opacity">
                  SELL
                </button>
              </div>
              <div className="hidden sm:flex flex-col items-end shrink-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Confidence</span>
                <span className={cn(
                  "text-xl font-black font-mono",
                  analysis.confidence >= 80 ? "text-brand-accent" : "text-zinc-300"
                )}>
                  {analysis.confidence}%
                </span>
              </div>
            </motion.div>
          )}

          {/* Pair Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {MAJOR_PAIRS.map(pair => (
              <button
                key={pair}
                onClick={() => {
                  setSelectedPair(pair);
                  fetchData(pair, confirmationMode);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border",
                  selectedPair === pair 
                    ? "bg-brand-accent text-brand-bg border-brand-accent shadow-[0_0_20px_rgba(16,185,129,0.2)]" 
                    : "bg-brand-card border-brand-border text-zinc-400 hover:border-zinc-600"
                )}
              >
                {pair}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const nextMode = !confirmationMode;
              setConfirmationMode(nextMode);
              fetchData(selectedPair, nextMode);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 mb-4",
              confirmationMode 
                ? "bg-brand-accent/20 border-brand-accent text-brand-accent shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                : "bg-brand-card border-brand-border text-zinc-500 hover:text-zinc-300"
            )}
          >
            <ShieldCheck className={cn("w-3 h-3", confirmationMode ? "animate-pulse" : "")} />
            Confirmation Mode: {confirmationMode ? 'ON' : 'OFF'}
          </button>

          {/* Chart Section */}
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-brand-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveTab('analysis')}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                    activeTab === 'analysis' ? "bg-brand-border text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Quick Chart
                </button>
                <button 
                  onClick={() => setActiveTab('chart')}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
                    activeTab === 'chart' ? "bg-brand-border text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <ExternalLink className="w-4 h-4" />
                  TradingView
                </button>
                <button 
                  onClick={() => setActiveTab('broker')}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
                    activeTab === 'broker' ? "bg-brand-border text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Wallet className="w-4 h-4" />
                  Broker
                </button>
                <button 
                  onClick={() => setActiveTab('backtest')}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
                    activeTab === 'backtest' ? "bg-brand-border text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <History className="w-4 h-4" />
                  Backtest
                </button>
                <button 
                  onClick={() => setActiveTab('calendar')}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
                    activeTab === 'calendar' ? "bg-brand-border text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  Calendar
                </button>
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                <span className={cn(
                  "text-xl font-mono font-bold tracking-tighter transition-colors duration-500",
                  prices[selectedPair] >= prevPrices[selectedPair] ? "text-brand-accent" : "text-brand-danger"
                )}>
                  {prices[selectedPair].toFixed(4)}
                </span>
                {analysis && (
                  <span className={cn(
                    "flex items-center text-xs font-medium",
                    analysis.changePercent >= 0 ? "text-brand-accent" : "text-brand-danger"
                  )}>
                    {analysis.changePercent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(analysis.changePercent).toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            <div className="h-[450px] w-full relative">
              <AnimatePresence mode="wait">
                {activeTab === 'analysis' && (
                  <motion.div 
                    key="quick"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis dataKey="time" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={['auto', 'auto']} stroke="#525252" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val.toFixed(4)} />
                        <Tooltip contentStyle={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '8px' }} itemStyle={{ color: '#10b981' }} />
                        <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" animationDuration={1500} />
                        
                        {analysis && analysis.takeProfit !== "N/A" && (
                          <ReferenceLine 
                            y={parseFloat(analysis.takeProfit)} 
                            stroke="#10b981" 
                            strokeDasharray="3 3"
                            label={{ 
                              value: `TP: ${analysis.takeProfit}`, 
                              position: 'right', 
                              fill: '#10b981', 
                              fontSize: 10,
                              fontWeight: 'bold'
                            }} 
                          />
                        )}
                        
                        {analysis && analysis.stopLoss !== "N/A" && (
                          <ReferenceLine 
                            y={parseFloat(analysis.stopLoss)} 
                            stroke="#ef4444" 
                            strokeDasharray="3 3"
                            label={{ 
                              value: `SL: ${analysis.stopLoss}`, 
                              position: 'right', 
                              fill: '#ef4444', 
                              fontSize: 10,
                              fontWeight: 'bold'
                            }} 
                          />
                        )}

                        {analysis && analysis.confirmationPrice && analysis.confirmationPrice !== "N/A" && (
                          <ReferenceLine 
                            y={parseFloat(analysis.confirmationPrice)} 
                            stroke="#3b82f6" 
                            strokeDasharray="5 5"
                            label={{ 
                              value: `CONFIRM: ${analysis.confirmationPrice}`, 
                              position: 'left', 
                              fill: '#3b82f6', 
                              fontSize: 10,
                              fontWeight: 'bold'
                            }} 
                          />
                        )}

                        {analysis && analysis.liquidityAreas && analysis.liquidityAreas.map((area, idx) => (
                          <ReferenceArea
                            key={idx}
                            y1={area.bottom}
                            y2={area.top}
                            fill={area.type === 'SUPPLY' ? '#ef4444' : '#10b981'}
                            fillOpacity={0.05}
                            stroke={area.type === 'SUPPLY' ? '#ef4444' : '#10b981'}
                            strokeOpacity={0.1}
                            strokeDasharray="3 3"
                          >
                            <Label 
                              value={area.type} 
                              position="insideTopLeft" 
                              fill={area.type === 'SUPPLY' ? '#ef4444' : '#10b981'} 
                              fontSize={8} 
                              fontWeight="bold"
                              opacity={0.3}
                            />
                          </ReferenceArea>
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}

                {activeTab === 'chart' && (
                  <motion.div 
                    key="tv"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full w-full"
                  >
                    <TradingViewWidget symbol={selectedPair} />
                  </motion.div>
                )}

                {activeTab === 'broker' && (
                  <motion.div 
                    key="broker"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 h-full flex flex-col"
                  >
                    {!brokerData ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
                        <div className="w-16 h-16 bg-brand-border rounded-full flex items-center justify-center">
                          <Settings className="w-8 h-8 text-zinc-500" />
                        </div>
                        <h4 className="text-xl font-bold">Connect Your Broker</h4>
                        <p className="text-sm text-zinc-500">
                          Link your OANDA account to view real-time balance, open positions, and execute trades directly from TrendPulse.
                        </p>
                        <div className="flex flex-col w-full gap-2">
                          <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-2">Setup Required</p>
                          <div className="bg-brand-border/30 p-3 rounded-lg text-left text-xs font-mono text-zinc-400 border border-brand-border">
                            1. Add OANDA_API_KEY to .env<br/>
                            2. Add OANDA_ACCOUNT_ID to .env
                          </div>
                        </div>
                        <a 
                          href="https://fxtrade.oanda.com/your-account" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full py-3 bg-brand-accent text-brand-bg font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                        >
                          Get API Key
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="bg-brand-border/20 p-5 rounded-2xl border border-brand-border">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Balance</span>
                            <div className="text-2xl font-mono font-bold mt-1 truncate">{brokerData.balance}</div>
                            <span className="text-[10px] text-zinc-600 font-bold">{brokerData.currency}</span>
                          </div>
                          <div className="bg-brand-border/20 p-5 rounded-2xl border border-brand-border">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Equity</span>
                            <div className="text-2xl font-mono font-bold mt-1 truncate">{brokerData.equity}</div>
                            <span className="text-[10px] text-zinc-600 font-bold">{brokerData.currency}</span>
                          </div>
                          <div className="bg-brand-border/20 p-5 rounded-2xl border border-brand-border">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Unrealized P/L</span>
                            <div className={cn(
                              "text-2xl font-mono font-bold mt-1 truncate",
                              parseFloat(brokerData.pl) >= 0 ? "text-brand-accent" : "text-brand-danger"
                            )}>
                              {parseFloat(brokerData.pl) > 0 ? '+' : ''}{brokerData.pl}
                            </div>
                            <span className="text-[10px] text-zinc-600 font-bold">{brokerData.currency}</span>
                          </div>
                          <div className="bg-brand-border/20 p-5 rounded-2xl border border-brand-border">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Open Positions</span>
                            <div className="text-2xl font-mono font-bold mt-1">{brokerData.openTradeCount}</div>
                            <span className="text-[10px] text-zinc-600 font-bold">Active Trades</span>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-bold mb-4 flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4 text-brand-accent" />
                            Active Positions
                          </h5>
                          <div className="space-y-3">
                            {positions.length === 0 ? (
                              <div className="p-8 border border-dashed border-brand-border rounded-xl text-center text-zinc-500 text-sm">
                                No active positions found.
                              </div>
                            ) : (
                              positions.map((pos, idx) => (
                                <div key={idx} className="bg-brand-card border border-brand-border p-4 rounded-xl flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-brand-border rounded-lg flex items-center justify-center font-bold text-xs">
                                      {pos.instrument.replace('_', '/')}
                                    </div>
                                    <div>
                                      <div className="font-bold">{pos.instrument}</div>
                                      <div className="text-xs text-zinc-500">
                                        {parseFloat(pos.long.units) > 0 ? `Long ${pos.long.units}` : `Short ${pos.short.units}`}
                                      </div>
                                    </div>
                                  </div>
                                  <div className={cn(
                                    "font-mono font-bold",
                                    parseFloat(pos.long.pl || pos.short.pl) >= 0 ? "text-brand-accent" : "text-brand-danger"
                                  )}>
                                    {parseFloat(pos.long.pl || pos.short.pl) > 0 ? '+' : ''}{pos.long.pl || pos.short.pl}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                {activeTab === 'backtest' && (
                  <motion.div 
                    key="backtest"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 h-full flex flex-col overflow-y-auto"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Controls */}
                      <div className="lg:col-span-4 space-y-6">
                        <div className="bg-brand-border/20 p-6 rounded-2xl border border-brand-border space-y-4">
                          <h4 className="font-bold flex items-center gap-2">
                            <Settings className="w-4 h-4 text-brand-accent" />
                            Backtest Parameters
                          </h4>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Date Range</label>
                              <div className="grid grid-cols-2 gap-2">
                                <input 
                                  type="date" 
                                  value={backtestParams.startDate}
                                  onChange={(e) => setBacktestParams(prev => ({ ...prev, startDate: e.target.value }))}
                                  className="bg-brand-bg border border-brand-border rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-brand-accent"
                                />
                                <input 
                                  type="date" 
                                  value={backtestParams.endDate}
                                  onChange={(e) => setBacktestParams(prev => ({ ...prev, endDate: e.target.value }))}
                                  className="bg-brand-bg border border-brand-border rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-brand-accent"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Initial Balance</label>
                              <input 
                                type="number" 
                                value={backtestParams.initialBalance}
                                onChange={(e) => setBacktestParams(prev => ({ ...prev, initialBalance: parseInt(e.target.value) }))}
                                className="w-full bg-brand-bg border border-brand-border rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-brand-accent"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Risk per Trade (%)</label>
                              <input 
                                type="number" 
                                value={backtestParams.riskPerTrade}
                                onChange={(e) => setBacktestParams(prev => ({ ...prev, riskPerTrade: parseFloat(e.target.value) }))}
                                className="w-full bg-brand-bg border border-brand-border rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-brand-accent"
                              />
                            </div>
                          </div>

                          <button 
                            onClick={runBacktest}
                            disabled={backtesting}
                            className="w-full py-3 bg-brand-accent text-brand-bg font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {backtesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Run AI Backtest
                          </button>
                        </div>

                        <div className="bg-brand-accent/5 p-6 rounded-2xl border border-brand-accent/20 space-y-3">
                          <h5 className="text-xs font-bold text-brand-accent uppercase flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Risk Strategy
                          </h5>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            TrendPulse uses a <strong>Fixed Fractional</strong> position sizing model. By risking only {backtestParams.riskPerTrade}% per trade, the AI ensures that even a series of losses won't deplete your capital, while wins compound your growth.
                          </p>
                        </div>
                      </div>

                      {/* Results */}
                      <div className="lg:col-span-8">
                        {!backtestResult && !backtesting ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-brand-border rounded-3xl opacity-50">
                            <BarChart className="w-12 h-12 mb-4" />
                            <h4 className="text-xl font-bold">No Backtest Data</h4>
                            <p className="text-sm">Configure your parameters and click "Run AI Backtest" to see historical performance.</p>
                          </div>
                        ) : backtesting ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                            <div className="relative">
                              <div className="w-24 h-24 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin" />
                              <Zap className="w-8 h-8 text-brand-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                            </div>
                            <div>
                              <h4 className="text-xl font-bold">AI Analyzing History...</h4>
                              <p className="text-sm text-zinc-500">Scanning historical prices and economic events for {selectedPair}.</p>
                            </div>
                          </div>
                        ) : (
                          <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                          >
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="bg-brand-border/20 p-4 rounded-2xl border border-brand-border">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Final Balance</span>
                                <div className={cn(
                                  "text-xl font-mono font-bold mt-1",
                                  backtestResult.finalBalance >= backtestResult.initialBalance ? "text-brand-accent" : "text-brand-danger"
                                )}>
                                  ${backtestResult.finalBalance.toLocaleString()}
                                </div>
                              </div>
                              <div className="bg-brand-border/20 p-4 rounded-2xl border border-brand-border">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Win Rate</span>
                                <div className="text-xl font-mono font-bold mt-1 text-brand-accent">{backtestResult.winRate}%</div>
                              </div>
                              <div className="bg-brand-border/20 p-4 rounded-2xl border border-brand-border">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Total Trades</span>
                                <div className="text-xl font-mono font-bold mt-1">{backtestResult.totalTrades}</div>
                              </div>
                              <div className="bg-brand-border/20 p-4 rounded-2xl border border-brand-border">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Profit Factor</span>
                                <div className="text-xl font-mono font-bold mt-1 text-emerald-400">{backtestResult.profitFactor}</div>
                              </div>
                            </div>

                            {/* Trade List */}
                            <div className="space-y-3">
                              <h5 className="font-bold flex items-center gap-2">
                                <Target className="w-4 h-4 text-brand-accent" />
                                Simulated Trades
                              </h5>
                              <div className="grid grid-cols-1 gap-3">
                                {backtestResult.trades.map((trade, idx) => (
                                  <div key={idx} className="bg-brand-card border border-brand-border p-4 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs",
                                        trade.type === 'BUY' ? "bg-brand-accent/20 text-brand-accent" : "bg-brand-danger/20 text-brand-danger"
                                      )}>
                                        {trade.type}
                                      </div>
                                      <div>
                                        <div className="font-bold text-sm">{trade.date}</div>
                                        <div className="text-[10px] text-zinc-500 font-mono">
                                          Entry: {trade.entry} • Exit: {trade.exit}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className={cn(
                                        "font-mono font-bold",
                                        trade.result === 'WIN' ? "text-brand-accent" : "text-brand-danger"
                                      )}>
                                        {trade.profit > 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                      </div>
                                      <div className="text-[10px] text-zinc-500 max-w-[200px] truncate">{trade.reason}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="p-6 bg-brand-border/10 rounded-2xl border border-brand-border">
                              <h5 className="text-xs font-bold text-zinc-400 uppercase mb-2">AI Performance Summary</h5>
                              <p className="text-sm text-zinc-300 leading-relaxed italic">"{backtestResult.summary}"</p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'calendar' && (
                  <motion.div 
                    key="calendar"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 h-full flex flex-col overflow-y-auto"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                      <div>
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                          <Calendar className="w-6 h-6 text-brand-accent" />
                          Economic Calendar
                        </h3>
                        <p className="text-zinc-500 text-sm">Upcoming high-impact events for major currencies.</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <select 
                          value={calendarFilters.currency}
                          onChange={(e) => setCalendarFilters(prev => ({ ...prev, currency: e.target.value }))}
                          className="bg-brand-border/20 border border-brand-border rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-brand-accent"
                        >
                          <option value="ALL">All Currencies</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="JPY">JPY</option>
                          <option value="AUD">AUD</option>
                        </select>
                        <select 
                          value={calendarFilters.impact}
                          onChange={(e) => setCalendarFilters(prev => ({ ...prev, impact: e.target.value }))}
                          className="bg-brand-border/20 border border-brand-border rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-brand-accent"
                        >
                          <option value="ALL">All Impact</option>
                          <option value="HIGH">High Impact</option>
                          <option value="MEDIUM">Medium Impact</option>
                          <option value="LOW">Low Impact</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
                      <div className="grid grid-cols-12 bg-brand-border/20 p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <div className="col-span-2">Time</div>
                        <div className="col-span-1">Currency</div>
                        <div className="col-span-4">Event</div>
                        <div className="col-span-1 text-center">Impact</div>
                        <div className="col-span-1 text-right">Actual</div>
                        <div className="col-span-1 text-right">Forecast</div>
                        <div className="col-span-2 text-right">Previous</div>
                      </div>
                      
                      <div className="divide-y divide-brand-border">
                        {calendarEvents
                          .filter(e => calendarFilters.currency === 'ALL' || e.currency === calendarFilters.currency)
                          .filter(e => calendarFilters.impact === 'ALL' || e.impact === calendarFilters.impact)
                          .map((event) => (
                          <div key={event.id} className="grid grid-cols-12 p-4 items-center hover:bg-white/5 transition-colors">
                            <div className="col-span-2 text-xs font-mono text-zinc-400">{event.time}</div>
                            <div className="col-span-1">
                              <span className="px-2 py-1 bg-brand-border rounded text-[10px] font-bold">{event.currency}</span>
                            </div>
                            <div className="col-span-4 text-sm font-medium">{event.event}</div>
                            <div className="col-span-1 flex justify-center">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                event.impact === 'HIGH' ? "bg-brand-danger shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                                event.impact === 'MEDIUM' ? "bg-amber-500" : "bg-zinc-600"
                              )} />
                            </div>
                            <div className="col-span-1 text-right text-xs font-mono font-bold">{event.actual}</div>
                            <div className="col-span-1 text-right text-xs font-mono text-zinc-500">{event.forecast}</div>
                            <div className="col-span-2 text-right text-xs font-mono text-zinc-500">{event.previous}</div>
                          </div>
                        ))}
                        {calendarEvents.length === 0 && (
                          <div className="p-12 text-center text-zinc-500">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-20" />
                            <p>Loading economic events...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Analysis Reasoning */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-brand-accent" />
              <h3 className="font-bold text-lg">AI Market Analysis</h3>
            </div>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-brand-border rounded w-3/4"></div>
                <div className="h-4 bg-brand-border rounded w-full"></div>
                <div className="h-4 bg-brand-border rounded w-5/6"></div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none text-zinc-400 leading-relaxed">
                <Markdown>{analysis?.reasoning}</Markdown>
              </div>
            )}
          </div>

          {/* Embedded TradingView Chart */}
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden h-[500px]">
            <div className="p-4 border-b border-brand-border flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-accent" />
                Live Technical Chart
              </h3>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Powered by TradingView</span>
            </div>
            <div className="h-[calc(100%-57px)]">
              <TradingViewWidget symbol={selectedPair} />
            </div>
          </div>

          {/* Risk Management Section */}
          {!loading && analysis && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-card border border-brand-border rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="w-5 h-5 text-brand-accent" />
                <h3 className="font-bold text-lg">Risk Management Strategy</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Risk-Reward Ratio</span>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-mono font-bold">
                      1:{(analysis.tpPips / (analysis.slPips || 1)).toFixed(1)}
                    </div>
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      (analysis.tpPips / (analysis.slPips || 1)) >= 2 ? "bg-brand-accent/20 text-brand-accent" : "bg-amber-500/20 text-amber-500"
                    )}>
                      {(analysis.tpPips / (analysis.slPips || 1)) >= 2 ? 'Excellent' : 'Moderate'}
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500">Targeting {analysis.tpPips} pips vs {analysis.slPips} pips risk.</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Position Sizing</span>
                  <div className="text-sm font-medium text-zinc-300">
                    Recommended: <span className="text-brand-accent">0.01 - 0.05 Lots</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">Based on a standard $10,000 account with 1% risk.</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Trade Management</span>
                  <ul className="text-[10px] text-zinc-400 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-brand-accent" />
                      Move SL to Break Even at +20 pips
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-brand-accent" />
                      Close 50% position at TP1
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Signals & News */}
        <div className="lg:col-span-4 space-y-6">
          {/* Signal Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-card border border-brand-border rounded-2xl p-6 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Trading Signal</h3>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-brand-border text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
                Live
              </div>
            </div>

            {loading ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-16 bg-brand-border rounded-xl"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-12 bg-brand-border rounded-xl"></div>
                  <div className="h-12 bg-brand-border rounded-xl"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className={cn(
                  "p-6 rounded-2xl border flex flex-col items-center justify-center text-center gap-2",
                  analysis?.action === 'BUY' ? "bg-brand-accent/10 border-brand-accent/20" : 
                  analysis?.action === 'SELL' ? "bg-brand-danger/10 border-brand-danger/20" : 
                  "bg-zinc-500/10 border-zinc-500/20"
                )}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-60">Recommendation</span>
                    {analysis?.strategy !== 'NONE' && (
                      <span className="px-2 py-0.5 rounded bg-brand-border text-[10px] font-black text-brand-accent uppercase tracking-tighter border border-brand-accent/30">
                        {analysis?.strategy}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-5xl font-black tracking-tighter",
                    analysis?.action === 'BUY' ? "text-brand-accent" : 
                    analysis?.action === 'SELL' ? "text-brand-danger" : 
                    "text-zinc-400"
                  )}>
                    {analysis?.action}
                  </span>
                  
                  {analysis?.verdict && (
                    <div className="mt-4 p-3 bg-brand-border/30 rounded-xl border border-brand-border/50">
                      <p className="text-sm font-bold text-zinc-200 leading-tight mb-1">{analysis.verdict}</p>
                      <p className="text-[10px] text-zinc-500 font-medium italic">{analysis.setup}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <button className="py-3 bg-brand-accent text-brand-bg font-black rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      BUY
                    </button>
                    <button className="py-3 bg-brand-danger text-brand-bg font-black rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                      SELL
                    </button>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-32 h-1.5 bg-brand-border rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-accent transition-all duration-1000" 
                        style={{ width: `${analysis?.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold">{analysis?.confidence}% Confidence</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-brand-border/30 p-4 rounded-xl border border-brand-border flex justify-between items-center">
                    <span className="text-xs text-zinc-500 font-bold uppercase">Entry</span>
                    <span className="font-mono font-bold text-brand-accent">{analysis?.entryPrice}</span>
                  </div>
                  <div className="bg-brand-border/30 p-4 rounded-xl border border-brand-border flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs text-zinc-500 font-bold uppercase">Take Profit</span>
                      <span className="text-[10px] text-emerald-500/60 font-mono">+{analysis?.tpPips} Pips</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">{analysis?.takeProfit}</span>
                  </div>
                  <div className="bg-brand-border/30 p-4 rounded-xl border border-brand-border flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs text-zinc-500 font-bold uppercase">Stop Loss</span>
                      <span className="text-[10px] text-brand-danger/60 font-mono">-{analysis?.slPips} Pips</span>
                    </div>
                    <span className="font-mono font-bold text-brand-danger">{analysis?.stopLoss}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-500/80 leading-tight">
                    Trading involves significant risk. Signals are AI-generated for informational purposes and do not constitute financial advice.
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Market News & Signal History */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-brand-accent" />
                <h3 className="font-bold text-lg">Signal History</h3>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Last 10 Alerts</span>
            </div>
            
            <div className="space-y-3 mb-8">
              {alerts.length === 0 ? (
                <div className="p-6 border border-dashed border-brand-border rounded-xl text-center text-zinc-500 text-xs">
                  No alerts triggered yet. High-confidence signals will appear here.
                </div>
              ) : (
                alerts.map((alert) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={alert.id} 
                    className="p-3 bg-brand-border/20 border border-brand-border rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px]",
                        alert.action === 'BUY' ? "bg-brand-accent/20 text-brand-accent" : "bg-brand-danger/20 text-brand-danger"
                      )}>
                        {alert.action[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-2">
                          {alert.pair}
                          <span className="text-[8px] px-1 py-0.5 bg-brand-border rounded text-zinc-400 uppercase font-black">
                            {alert.strategy}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500">{alert.time} • {alert.confidence}% Conf.</div>
                      </div>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter",
                      alert.action === 'BUY' ? "bg-brand-accent text-brand-bg" : "bg-brand-danger text-white"
                    )}>
                      {alert.action}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 mb-6 pt-6 border-t border-brand-border">
              <Globe className="w-5 h-5 text-brand-accent" />
              <h3 className="font-bold text-lg">Market Sentiment</h3>
            </div>
            
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-brand-border rounded-xl"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-brand-border">
                <div className="prose prose-invert prose-sm text-zinc-400">
                  <Markdown>{news}</Markdown>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border bg-brand-card/30 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">TrendPulse v1.0</span>
          </div>
          <div className="flex gap-6 text-xs font-medium text-zinc-500">
            <a href="#" className="hover:text-zinc-300">Terms</a>
            <a href="#" className="hover:text-zinc-300">Privacy</a>
            <a href="#" className="hover:text-zinc-300">Risk Disclosure</a>
          </div>
          <p className="text-[10px] text-zinc-600 max-w-xs text-center md:text-right">
            Real-time data simulated for demonstration. AI analysis uses Gemini 3.1 Pro with Google Search grounding.
          </p>
        </div>
      </footer>
    </div>
  );
}
