"use client";
import React, { useState, useEffect } from 'react';
import { useQuickAuth, useMiniKit } from "@coinbase/onchainkit/minikit";
import { 
  Zap, 
  Activity, 
  Share2, 
  ArrowRight, 
  TrendingUp, 
  ShieldCheck, 
  Flame, 
  Lock,
  Star
} from 'lucide-react';

// --- Types & Mock Data ---
type ViewState = 'splash' | 'checkin' | 'scanning' | 'score' | 'stats' | 'digest';

interface UserData {
  username: string;
  fid: number;
  streak: number;
  neynarScore: number;
  scoreDelta: number;
  rank: string;
  followersGained: number; // New field for the stats card
  likesReceived: number;   // New field for the stats card
}

const MOCK_USER: UserData = {
  username: 'dwr.eth',
  fid: 3,
  streak: 15,
  neynarScore: 0.998,
  scoreDelta: 0.002,
  rank: 'LEGENDARY',
  followersGained: 12,
  likesReceived: 145,
};

const MOCK_DIGEST = [
  {
    id: 1,
    author: 'vitalik.eth',
    text: 'The most important thing for L2 scaling is not just TPS, but data availability sampling. We need to ensure...',
    signalStrength: 'Critical',
    time: '2h ago'
  },
  {
    id: 2,
    author: 'jessepollak',
    text: 'Base is seeing all time high usage today. The onchain summer never ended. Builders are building.',
    signalStrength: 'High',
    time: '4h ago'
  },
  {
    id: 3,
    author: 'balajis',
    text: 'The network state is forming faster than you think. Look at the data from the latest census.',
    signalStrength: 'High',
    time: '6h ago'
  }
];

// --- Helper Components ---
const ScoreGauge = ({ score }: { score: number }) => {
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score);
  
  let colorClass = 'text-red-500';
  if (score > 0.58) colorClass = 'text-yellow-400';
  if (score > 0.72) colorClass = 'text-emerald-400';
  if (score > 0.9) colorClass = 'text-purple-400';
  
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="128" cy="128" r={radius} stroke="currentColor" strokeWidth="12" fill="transparent" className="text-zinc-900" />
        <circle
          cx="128"
          cy="128"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="transparent"
          strokeLinecap="round"
          className={`${colorClass} transition-all duration-1000 ease-out`}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <span className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] mb-2 uppercase">Signal Score</span>
        <span className={`text-6xl font-black ${colorClass} tracking-tighter`}>{(score * 100).toFixed(1)}</span>
        <span className={`text-sm font-bold ${colorClass} opacity-80 mt-1`}>%</span>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const { isFrameReady, setFrameReady, context } = useMiniKit();
  const [view, setView] = useState<ViewState>('splash');
  const [user, setUser] = useState<UserData>(MOCK_USER);

  // Initialize the miniapp
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);
 
  // Fetch real user data using useQuickAuth for authenticated requests
  // Note: useQuickAuth only works when the app is running in a Farcaster frame context
  // It automatically adds the Authorization header when in the proper context
  const { data: userStatsData, isLoading: isStatsLoading, error: userStatsError } = useQuickAuth<{
    success: boolean;
    user?: UserData;
  }>("/api/user-stats", { method: "GET" });

  // Also try to get user FID from context as fallback
  const userFid = context?.user?.fid;

  useEffect(() => {
    console.log("=== User Stats Effect ===");
    console.log("isStatsLoading:", isStatsLoading);
    console.log("userStatsError:", userStatsError);
    console.log("userStatsData:", userStatsData);
    console.log("context.user:", context?.user);
    console.log("userFid from context:", userFid);
    
    if (userStatsError) {
      console.error("❌ Error fetching user stats:", userStatsError);
    }
    
    // If useQuickAuth didn't work but we have a user FID from context, try direct fetch
    if (!isStatsLoading && !userStatsData && userFid && isFrameReady) {
      console.log("⚠️ useQuickAuth returned no data, but we have FID from context.");
      console.log("⚠️ This might mean useQuickAuth isn't working in this context.");
      console.log("⚠️ Please check the Network tab to see if /api/user-stats was called.");
      console.log("⚠️ If not called, the hook might need the app to be in a Farcaster frame context.");
    }
    
    if (!isStatsLoading) {
      if (userStatsData?.success && userStatsData.user) {
        console.log("✅ Loaded real user data:", userStatsData.user);
        setUser(userStatsData.user);
      } else if (userStatsData && !userStatsData.success) {
        console.warn("⚠️ API returned but with success: false");
        console.warn("Response:", userStatsData);
      } else {
        console.warn("⚠️ No user data received, using mock data.");
        console.warn("userStatsData is:", userStatsData);
        console.warn("This might mean:");
        console.warn("1. API endpoint not being called");
        console.warn("2. useQuickAuth not working in this context");
        console.warn("3. Check Network tab to see if /api/user-stats was called");
      }
    }
  }, [userStatsData, isStatsLoading, userStatsError, userFid, isFrameReady, context]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setView('checkin');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleCheckIn = () => {
    setView('scanning');
    setTimeout(() => setView('score'), 2500);
  };

  const handleShareStats = () => {
    const text = `Yesterday's Vibe Stats 📊\n\n👥 +${user.followersGained} Followers\n⭐ ${user.likesReceived} Likes\n🔥 ${user.streak} Day Streak\n\nCheck your growth 👇`;
    navigator.clipboard.writeText(text);
    alert('Stats copied to clipboard! (Simulating Share)');
  };

  // --- Views ---
  const renderSplash = () => (
    <div className="flex flex-col items-center justify-center h-full bg-black text-white space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
        <Zap className="relative z-10 w-20 h-20 text-emerald-400 animate-bounce" />
      </div>
      <h1 className="text-3xl font-black tracking-tighter italic">VIBE CHECK</h1>
    </div>
  );

  const renderCheckIn = () => (
    <div className="flex flex-col h-full bg-zinc-950 text-white relative overflow-hidden">
      <div className="flex justify-between items-center p-6 z-10">
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 rounded-full">
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="text-xs font-bold text-zinc-300">{user.streak} Day Streak</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center z-10 p-6 text-center mt-[-40px]">
        <h2 className="text-zinc-500 font-bold tracking-widest text-xs mb-4">
          GOOD MORNING, @{(context?.user?.displayName || user.username || "THERE").toUpperCase()}
        </h2>
        <h1 className="text-5xl font-black leading-none tracking-tight mb-6">
          READY TO<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">SYNC UP?</span>
        </h1>
      </div>
      <div className="p-6 z-10">
        <button onClick={handleCheckIn} className="group w-full bg-white hover:bg-zinc-200 text-black h-16 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95">
          <Activity className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span>CHECK VIBE</span>
        </button>
      </div>
    </div>
  );

  const renderScanning = () => (
    <div className="flex flex-col items-center justify-center h-full bg-black text-white">
      <div className="w-64 h-2 bg-zinc-900 rounded-full overflow-hidden mb-8">
        <div className="h-full bg-emerald-500 animate-[loading_2s_ease-in-out_infinite] w-1/3"></div>
      </div>
      <h2 className="text-xl font-bold animate-pulse">ANALYZING CASTS...</h2>
    </div>
  );

  const renderScore = () => (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="mb-8"><ScoreGauge score={user.neynarScore} /></div>
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-emerald-400 tracking-wide text-sm">STATUS: {user.rank}</span>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-3 bg-zinc-900/50 border-t border-zinc-800">
        <button onClick={() => setView('stats')} className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
          <span>View Growth Stats</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderStats = () => (
    <div className="flex flex-col h-full bg-black text-white relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <h2 className="text-zinc-500 text-xs font-bold tracking-[0.2em] mb-6 uppercase">Yesterday&apos;s Vibe</h2>
        {/* The Card Container */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
          {/* 2x1 Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Followers Box */}
            <div className="bg-black/40 p-5 rounded-2xl flex flex-col items-center justify-center aspect-square border border-zinc-800/50">
              <TrendingUp className="w-8 h-8 text-emerald-400 mb-3" />
              <span className="text-3xl font-black text-white">+{user.followersGained}</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Followers</span>
            </div>
            {/* Likes Box */}
            <div className="bg-black/40 p-5 rounded-2xl flex flex-col items-center justify-center aspect-square border border-zinc-800/50">
              <Star className="w-8 h-8 text-purple-400 fill-purple-400 mb-3" />
              <span className="text-3xl font-black text-white">{user.likesReceived}</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Likes</span>
            </div>
          </div>
          {/* Streak Banner */}
          <div className="bg-gradient-to-r from-orange-900/40 to-red-900/40 border border-orange-500/20 rounded-xl py-4 flex items-center justify-center gap-2">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
            <span className="text-orange-200 font-bold text-lg">{user.streak} Day Streak!</span>
          </div>
        </div>
      </div>
      {/* Action Buttons */}
      <div className="p-6 space-y-3 z-10 bg-zinc-900/50 border-t border-zinc-800">
        <button
          onClick={handleShareStats}
          className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
        >
          <Share2 className="w-5 h-5" />
          <span>Share Stats</span>
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setView('digest')}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Next: Signals
          </button>
          <button
            onClick={() => setView('checkin')}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Close App
            </button>
        </div>
      </div>
    </div>
  );

  const renderDigest = () => (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      <div className="p-6 pb-2 flex justify-between items-center">
        <h2 className="text-xl font-black italic tracking-tighter">THE SIGNAL</h2>
        <button onClick={() => setView('stats')} className="text-xs font-bold text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full">STATS</button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-6 mt-4">
        {MOCK_DIGEST.map((cast) => (
          <div key={cast.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold">
                {cast.author[0].toUpperCase()}
              </div>
              <div className="font-bold text-sm text-zinc-200">@{cast.author}</div>
            </div>
            <p className="text-sm text-zinc-300">{cast.text}</p>
          </div>
        ))}
        <div className="pt-4 pb-8">
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-xl p-6 text-center border border-dashed border-zinc-700">
            <Lock className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
            <h3 className="font-bold text-zinc-400 text-sm">Pro Insights Locked</h3>
            <p className="text-zinc-600 text-xs mt-1 mb-3">Unlock deeper analytics with $DEGEN</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen max-w-md mx-auto sm:h-[800px] sm:rounded-3xl shadow-2xl overflow-hidden font-sans select-none">
      {view === 'splash' && renderSplash()}
      {view === 'checkin' && renderCheckIn()}
      {view === 'scanning' && renderScanning()}
      {view === 'score' && renderScore()}
      {view === 'stats' && renderStats()}
      {view === 'digest' && renderDigest()}
    </div>
  );
}
