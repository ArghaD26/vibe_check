"use client";
import React, { useState, useEffect } from 'react';
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { 
  Zap, 
  Activity, 
  ShieldCheck, 
  Flame
} from 'lucide-react';

// --- Types & Mock Data ---
type ViewState = 'splash' | 'checkin' | 'scanning' | 'score';

interface UserData {
  username: string;
  fid: number;
  streak: number;
  neynarScore: number;
  scoreDelta: number;
  rank: string;
  totalFollowers: number; // Total follower count
  accountAgeDays: number; // Account age in days
}

const MOCK_USER: UserData = {
  username: 'dwr.eth',
  fid: 3,
  streak: 15,
  neynarScore: 0.998,
  scoreDelta: 0.002,
  rank: 'LEGENDARY',
  totalFollowers: 1250,
  accountAgeDays: 365,
};


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

// Helper functions for tracking streak and followers
function getStorageKey(fid: number, key: string): string {
  return `vibe_check_${fid}_${key}`;
}

function getStreakData(fid: number): { streak: number; lastCheckIn: string | null } {
  if (typeof window === 'undefined') return { streak: 0, lastCheckIn: null };
  
  const streakKey = getStorageKey(fid, 'streak');
  const lastCheckInKey = getStorageKey(fid, 'lastCheckIn');
  
  const streak = parseInt(localStorage.getItem(streakKey) || '0', 10);
  const lastCheckIn = localStorage.getItem(lastCheckInKey);
  
  return { streak, lastCheckIn };
}

function getCurrentStreak(fid: number): number {
  // Just read the streak without updating it
  const { streak } = getStreakData(fid);
  return streak || 1; // Default to 1 if no streak exists
}

function updateStreak(fid: number): number {
  if (typeof window === 'undefined') return 1;
  
  const { streak, lastCheckIn } = getStreakData(fid);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
  
  let newStreak = streak;
  
  if (!lastCheckIn) {
    // First check-in ever
    newStreak = 1;
  } else if (lastCheckIn === today) {
    // Already checked in today, keep current streak
    newStreak = streak;
  } else if (lastCheckIn === yesterday) {
    // Checked in yesterday, increment streak
    newStreak = streak + 1;
  } else {
    // Missed a day, reset streak
    newStreak = 1;
  }
  
  // Update storage
  const streakKey = getStorageKey(fid, 'streak');
  const lastCheckInKey = getStorageKey(fid, 'lastCheckIn');
  localStorage.setItem(streakKey, newStreak.toString());
  localStorage.setItem(lastCheckInKey, today);
  
  return newStreak;
}

// Removed follower tracking functions - now showing total followers instead

// Fetch user data from server-side API route (keeps API keys secure)
async function fetchUserData(fid: number): Promise<UserData | null> {
  try {
    console.log(`Fetching user data for FID: ${fid} from API route`);
    
    // Call our server-side API route with FID as query parameter
    const response = await fetch(`/api/user-stats?fid=${fid}`, {
      method: "GET",
      headers: {
        "accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API route error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    console.log("API route response:", data);
    
    if (!data.success || !data.user) {
      console.warn("API route returned unsuccessful response:", data);
      return null;
    }

    const apiUser = data.user;

    // Get current streak (without updating - streak only updates on check-in)
    const streak = getCurrentStreak(fid);
    
    // Calculate score delta (compare with previous score if available)
    const prevScoreKey = getStorageKey(fid, 'prevScore');
    const prevScore = typeof window !== 'undefined' 
      ? parseFloat(localStorage.getItem(prevScoreKey) || '0')
      : 0;
    const scoreDelta = prevScore > 0 ? apiUser.neynarScore - prevScore : 0;
    
    // Store current score for next time
    if (typeof window !== 'undefined') {
      localStorage.setItem(prevScoreKey, apiUser.neynarScore.toString());
    }

    const userData: UserData = {
      username: apiUser.username,
      fid: apiUser.fid,
      streak: streak, // Use client-side tracked streak
      neynarScore: apiUser.neynarScore,
      scoreDelta: scoreDelta,
      rank: apiUser.rank,
      totalFollowers: apiUser.totalFollowers,
      accountAgeDays: apiUser.accountAgeDays,
    };

    console.log("✅ Final user data:", userData);
    return userData;
  } catch (error) {
    console.error("Error fetching user data from API route:", error);
    return null;
  }
}

// --- Main App Component ---
export default function App() {
  const { isFrameReady, setFrameReady, context } = useMiniKit();
  const [view, setView] = useState<ViewState>('splash');
  const [user, setUser] = useState<UserData>(MOCK_USER);

  // Initialize the miniapp and fetch real user data
  useEffect(() => {
    const initializeAndFetchData = async () => {
      // Initialize the frame
      if (!isFrameReady) {
        setFrameReady();
      }

      // Wait a bit for frame to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get user FID from context
      let userFid: number;
      
      if (context?.user?.fid) {
        userFid = typeof context.user.fid === 'string' ? parseInt(context.user.fid) : context.user.fid;
        console.log("✅ Got FID from context:", userFid);
      } else {
        // Fallback to mock FID for testing (dwr.eth)
        userFid = 3;
        console.warn("⚠️ No context available, using fallback FID:", userFid);
      }

      // Fetch real user data
      const userData = await fetchUserData(userFid);
      
      if (userData) {
        console.log("✅ Loaded real user data:", userData);
        setUser(userData);
      } else {
        console.warn("⚠️ Failed to fetch user data, using mock data");
      }
    };

    initializeAndFetchData();
  }, [isFrameReady, setFrameReady, context]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setView('checkin');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleCheckIn = () => {
    setView('scanning');
    // Update streak when user checks in
    if (user.fid) {
      const newStreak = updateStreak(user.fid);
      setUser(prev => ({ ...prev, streak: newStreak }));
    }
    setTimeout(() => setView('score'), 2500);
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
    </div>
  );


  return (
    <div className="w-full h-screen max-w-md mx-auto sm:h-[800px] sm:rounded-3xl shadow-2xl overflow-hidden font-sans select-none">
      {view === 'splash' && renderSplash()}
      {view === 'checkin' && renderCheckIn()}
      {view === 'scanning' && renderScanning()}
      {view === 'score' && renderScore()}
    </div>
  );
}
