"use client";
import React, { useState, useEffect } from 'react';
import { useMiniKit } from "@coinbase/onchainkit/minikit";
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

// Fetch user data directly from Neynar API
// Note: In production, consider using a server-side API route to keep the API key secure
async function fetchUserData(fid: number): Promise<UserData | null> {
  // Use NEXT_PUBLIC_ prefix for client-side environment variables in Next.js
  const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
  
  if (!NEYNAR_API_KEY) {
    console.warn("NEXT_PUBLIC_NEYNAR_API_KEY not set, using mock data");
    return null;
  }

  try {
    console.log(`Fetching Neynar data for FID: ${fid}`);
    
    // Call Neynar API v2
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        method: "GET",
        headers: {
          "accept": "application/json",
          "api_key": NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Neynar API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    console.log("Neynar API response:", data);
    
    // Handle different response structures
    const user = data.users?.[0] || data.result?.user || data.user;
    
    if (!user) {
      console.warn("No user found in Neynar response");
      return null;
    }

    // Extract user data
    const username = user.username || user.display_name || `fid-${fid}`;
    // const pfpUrl = user.pfp_url || user.pfp?.url; // Reserved for future use
    
    // Get neynar_score from experimental features or calculate it
    let neynarScore = user.experimental_features?.neynar_score || 
                     user.neynar_score || 
                     user.score || 
                     0.5; // Default to 0.5 if missing
    
    // Ensure score is between 0 and 1
    neynarScore = Math.max(0, Math.min(1, neynarScore));

    // Calculate rank based on score
    let rank = "RISING";
    if (neynarScore > 0.9) rank = "LEGENDARY";
    else if (neynarScore > 0.72) rank = "ELITE";
    else if (neynarScore > 0.58) rank = "STRONG";

    // Get total follower count
    const totalFollowers = user.follower_count || user.followers?.count || 0;
    console.log("📊 Total followers from API:", totalFollowers);
    
    // Calculate account age in days
    let accountAgeDays = 0;
    try {
      // Try to get account creation date from various possible fields
      const createdAt = user.created_at || 
                       user.registered_at || 
                       user.registration_timestamp ||
                       user.timestamp;
      
      if (createdAt) {
        // Handle both Unix timestamp (seconds or milliseconds) and ISO string
        let creationDate: Date;
        if (typeof createdAt === 'number') {
          // If it's a number, check if it's in seconds or milliseconds
          creationDate = new Date(createdAt > 1e12 ? createdAt : createdAt * 1000);
        } else if (typeof createdAt === 'string') {
          creationDate = new Date(createdAt);
        } else {
          creationDate = new Date(createdAt);
        }
        
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - creationDate.getTime());
        accountAgeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        console.log("📅 Account creation date:", creationDate);
        console.log("📅 Account age in days:", accountAgeDays);
      } else {
        console.warn("⚠️ No account creation date found in API response");
        // Fallback: estimate based on FID (lower FID = older account, roughly)
        // This is a rough estimate - FID 1 was created around Jan 2020
        accountAgeDays = Math.max(1, Math.floor((Date.now() - new Date('2020-01-01').getTime()) / (1000 * 60 * 60 * 24)));
      }
    } catch (error) {
      console.error("❌ Error calculating account age:", error);
      accountAgeDays = 0;
    }

    // Get current streak (without updating - streak only updates on check-in)
    const streak = getCurrentStreak(fid);
    
    // Calculate score delta (compare with previous score if available)
    const prevScoreKey = getStorageKey(fid, 'prevScore');
    const prevScore = typeof window !== 'undefined' 
      ? parseFloat(localStorage.getItem(prevScoreKey) || '0')
      : 0;
    const scoreDelta = prevScore > 0 ? neynarScore - prevScore : 0;
    
    // Store current score for next time
    if (typeof window !== 'undefined') {
      localStorage.setItem(prevScoreKey, neynarScore.toString());
    }

    console.log("✅ Final user data:", {
      username,
      fid,
      streak,
      neynarScore,
      scoreDelta,
      rank,
      totalFollowers,
      accountAgeDays,
    });

    return {
      username,
      fid,
      streak,
      neynarScore,
      scoreDelta,
      rank,
      totalFollowers,
      accountAgeDays,
    };
  } catch (error) {
    console.error("Error fetching user data from Neynar:", error);
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

  const handleShareStats = () => {
    const text = `Vibe Check Stats 📊\n\n👥 ${user.totalFollowers} Followers\n📅 ${user.accountAgeDays} Days Old\n🔥 ${user.streak} Day Streak\n\nCheck your vibe 👇`;
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
              <span className="text-3xl font-black text-white">{user.totalFollowers.toLocaleString()}</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Followers</span>
            </div>
            {/* Account Age Box */}
            <div className="bg-black/40 p-5 rounded-2xl flex flex-col items-center justify-center aspect-square border border-zinc-800/50">
              <Star className="w-8 h-8 text-purple-400 fill-purple-400 mb-3" />
              <span className="text-3xl font-black text-white">{user.accountAgeDays}</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Days Old</span>
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
