"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useMiniKit, useComposeCast } from "@coinbase/onchainkit/minikit";
import { 
  Zap, 
  Activity, 
  ShieldCheck, 
  Flame,
  Share2,
  ArrowRight,
  Lightbulb,
  X,
  Home,
  BarChart3,
  Info
} from 'lucide-react';

// --- Types & Mock Data ---
type ViewState = 'splash' | 'onboarding' | 'checkin' | 'scanning' | 'score' | 'tips';

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

// MOCK_USER removed - we now use null state and fetch real data


// --- Helper Components ---
const ScoreGauge = ({ score }: { score: number }) => {
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score);
  
  // Color scheme based on score tiers (0-100 scale)
  const scorePercent = score * 100;
  let colorClass = 'text-red-500'; // 0-29: Red
  if (scorePercent >= 30 && scorePercent < 40) colorClass = 'text-orange-500'; // 30-39: Orange
  if (scorePercent >= 40 && scorePercent < 50) colorClass = 'text-yellow-400'; // 40-49: Yellow
  if (scorePercent >= 50 && scorePercent < 60) colorClass = 'text-lime-400'; // 50-59: Lime
  if (scorePercent >= 60 && scorePercent < 70) colorClass = 'text-green-400'; // 60-69: Green
  if (scorePercent >= 70 && scorePercent < 80) colorClass = 'text-emerald-400'; // 70-79: Emerald
  if (scorePercent >= 80 && scorePercent < 90) colorClass = 'text-cyan-400'; // 80-89: Cyan
  if (scorePercent >= 90) colorClass = 'text-purple-400'; // 90-100: Purple
  
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
        <span className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] mb-2 uppercase">VIBE SCORE</span>
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
  // Check cache first (5 minute cache)
  const cacheKey = `vibe_check_user_${fid}`;
  const cacheTimestampKey = `vibe_check_user_${fid}_timestamp`;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  if (typeof window !== 'undefined') {
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cacheTimestampKey);
    
    if (cachedData && cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp, 10);
      if (age < CACHE_DURATION) {
        console.log(`Using cached user data for FID: ${fid} (age: ${Math.round(age / 1000)}s)`);
        return JSON.parse(cachedData);
      }
    }
  }
  
  try {
    console.log(`Fetching user data for FID: ${fid} from API route`);
    
    // Call our server-side API route with FID as query parameter
    // Add version query param to force cache refresh
    const version = Date.now();
    const response = await fetch(`/api/user-stats?fid=${fid}&v=${version}`, {
      method: "GET",
      headers: {
        "accept": "application/json",
      },
      cache: 'no-store', // Force fresh fetch
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

    // Validate the score is reasonable (not mock data or error)
    if (apiUser.neynarScore > 0.95) {
      console.warn("⚠️ Suspiciously high score detected:", apiUser.neynarScore);
      console.warn("⚠️ Scores > 95% are very rare. This might be incorrect data.");
      // Don't reject it here - let the backend validation handle it
      // But log it for debugging
    }
    
    // Additional validation: reject clearly invalid scores
    if (apiUser.neynarScore < 0 || apiUser.neynarScore > 1 || isNaN(apiUser.neynarScore)) {
      console.error("❌ Invalid score value:", apiUser.neynarScore);
      return null;
    }

    // Get current streak (without updating - streak only updates on check-in)
    const streak = getCurrentStreak(fid);
    
    // Calculate score delta (compare with previous score if available)
    const prevScoreKey = getStorageKey(fid, 'prevScore');
    const prevScore = typeof window !== 'undefined' 
      ? parseFloat(localStorage.getItem(prevScoreKey) || '0')
      : 0;
    const scoreDelta = prevScore > 0 ? apiUser.neynarScore - prevScore : 0;
    
    // Store current score for next time (only if it's valid)
    if (typeof window !== 'undefined' && apiUser.neynarScore > 0 && apiUser.neynarScore <= 1) {
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

    // Cache the user data
    if (typeof window !== 'undefined') {
      localStorage.setItem(cacheKey, JSON.stringify(userData));
      localStorage.setItem(cacheTimestampKey, Date.now().toString());
    }

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
  const { composeCastAsync } = useComposeCast();
  const [view, setView] = useState<ViewState>('splash');
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [_showOnboarding, setShowOnboarding] = useState(false);

  // Initialize the miniapp and fetch real user data
  useEffect(() => {
    const initializeAndFetchData = async () => {
      setIsLoading(true);
      setApiError(null);
      
      // Initialize the frame
    if (!isFrameReady) {
      setFrameReady();
    }

      // Small delay only if frame is not ready yet
      if (!isFrameReady) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

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
        console.log("📊 Score:", userData.neynarScore, `(${(userData.neynarScore * 100).toFixed(1)}%)`);
        
        // Validate score is reasonable (not mock data or error)
        if (userData.neynarScore >= 0.95) {
          console.warn("⚠️ WARNING: Score is suspiciously high (≥95%). This might be incorrect data.");
          // Show error but still display the data (user can decide)
          setApiError("Warning: Score seems unusually high. If incorrect, please refresh.");
        }
        
        // Reject clearly invalid scores
        if (userData.neynarScore < 0 || userData.neynarScore > 1 || isNaN(userData.neynarScore)) {
          console.error("❌ Invalid score, rejecting:", userData.neynarScore);
          setApiError("Invalid score data received. Please try again.");
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        setUser(userData);
        setIsLoading(false);
      } else {
        console.error("❌ Failed to fetch user data from API");
        setApiError("Failed to load your vibe score. Please try again.");
        setIsLoading(false);
        // Don't set user - will show error state
      }
    };

    initializeAndFetchData();
  }, [isFrameReady, setFrameReady, context]);

  useEffect(() => {
    // Check if user has seen onboarding before
    const hasSeenOnboarding = typeof window !== 'undefined' 
      ? localStorage.getItem('vibe_check_onboarding_seen') === 'true'
      : false;
    
    const timer = setTimeout(() => {
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
        setView('onboarding');
      } else {
        setView('checkin');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleOnboardingComplete = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vibe_check_onboarding_seen', 'true');
    }
    setShowOnboarding(false);
    setView('checkin');
  };

  const handleCheckIn = () => {
    if (!user) return;
    setView('scanning');
    // Update streak when user checks in
    if (user.fid) {
      const newStreak = updateStreak(user.fid);
      setUser(prev => prev ? { ...prev, streak: newStreak } : null);
    }
    setTimeout(() => setView('score'), 2500);
  };

  const handleShareScore = async () => {
    if (!user) return;
    try {
      const scorePercent = (user.neynarScore * 100).toFixed(1);
      const appUrl = process.env.NEXT_PUBLIC_URL || 'https://vibecheck-olive.vercel.app';
      
      // Create an engaging share message
      const shareText = `My neynar score is ${scorePercent}% 🔥\n\nCheck your neynar score and see where you rank! 👇`;
      
      const result = await composeCastAsync({
        text: shareText,
        embeds: [appUrl]
      });

      // result.cast can be null if user cancels
      if (result?.cast) {
        console.log("Cast created successfully:", result.cast.hash);
      } else {
        console.log("User cancelled the cast");
      }
    } catch (error) {
      console.error("Error sharing cast:", error);
      // Fallback to clipboard if compose fails
      if (!user) return;
      const scorePercent = (user.neynarScore * 100).toFixed(1);
      const shareText = `My neynar score is ${scorePercent}% 🔥\n\nCheck your neynar score: ${process.env.NEXT_PUBLIC_URL || 'https://vibecheck-olive.vercel.app'}`;
      navigator.clipboard.writeText(shareText);
      alert('Share text copied to clipboard!');
    }
  };


  // --- Views ---
  const renderOnboarding = () => (
    <div className="flex flex-col h-full bg-zinc-950 dark:bg-zinc-950 text-white p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
          <Zap className="relative z-10 w-16 h-16 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter">Welcome to Vibe Check</h1>
        <div className="space-y-4 max-w-sm">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-lg font-bold text-emerald-400 mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              What is Vibe Check?
            </h2>
            <p className="text-zinc-300 text-sm leading-relaxed">
              Track your signal strength and growth stats. Get insights into your onchain presence and daily vibe.
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-lg font-bold text-cyan-400 mb-2 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              How to Get Started
            </h2>
            <p className="text-zinc-300 text-sm leading-relaxed">
              Tap &quot;Check Vibe&quot; to analyze your score. Check in daily to build your streak and improve your ranking.
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-lg font-bold text-purple-400 mb-2 flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Share Your Score
            </h2>
            <p className="text-zinc-300 text-sm leading-relaxed">
              Share your neynar score with friends and see where you rank in the community.
            </p>
          </div>
        </div>
      </div>
      <div className="pt-6 pb-8">
        <button
          onClick={handleOnboardingComplete}
          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/30 min-h-[44px]"
        >
          Get Started
        </button>
      </div>
    </div>
  );

  const renderSplash = () => (
    <div className="flex flex-col items-center justify-center h-full bg-black dark:bg-black text-white space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
        <Zap className="relative z-10 w-20 h-20 text-emerald-400 animate-bounce" />
      </div>
      <h1 className="text-3xl font-black tracking-tighter italic">VIBE CHECK</h1>
    </div>
  );

  const renderCheckIn = () => {
    if (!user) {
      return (
        <div className="flex flex-col h-full bg-zinc-950 dark:bg-zinc-950 text-white items-center justify-center p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
                <Image 
                  src="/vibecheck_1024.png" 
                  alt="Vibe Check" 
                  width={128}
                  height={128}
                  className="relative z-10 animate-pulse"
                  priority
                />
              </div>
              <h1 className="text-3xl font-black tracking-tighter italic">VIBE CHECK</h1>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-red-400 text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-red-400">Failed to Load Data</h2>
              <p className="text-zinc-400 text-sm">{apiError || "Unable to fetch your vibe score"}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full bg-zinc-950 dark:bg-zinc-950 text-white relative overflow-hidden">
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
        <button onClick={handleCheckIn} className="group w-full bg-white dark:bg-white hover:bg-zinc-200 dark:hover:bg-zinc-200 text-black h-16 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 min-h-[44px]">
          <Activity className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span>CHECK VIBE</span>
        </button>
      </div>
    </div>
    );
  };

  const renderScanning = () => (
    <div className="flex flex-col items-center justify-center h-full bg-black dark:bg-black text-white">
      <div className="w-64 h-2 bg-zinc-900 rounded-full overflow-hidden mb-8">
        <div className="h-full bg-emerald-500 animate-[loading_2s_ease-in-out_infinite] w-1/3"></div>
      </div>
      <h2 className="text-xl font-bold animate-pulse">ANALYZING CASTS...</h2>
    </div>
  );

  const renderScore = () => {
    if (!user) {
      return (
        <div className="flex flex-col h-full bg-zinc-950 dark:bg-zinc-950 text-white items-center justify-center p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
                <Image 
                  src="/vibecheck_1024.png" 
                  alt="Vibe Check" 
                  width={128}
                  height={128}
                  className="relative z-10 animate-pulse"
                  priority
                />
              </div>
              <h1 className="text-3xl font-black tracking-tighter italic">VIBE CHECK</h1>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-red-400 text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-red-400">Failed to Load Data</h2>
              <p className="text-zinc-400 text-sm">{apiError || "Unable to fetch your vibe score"}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full bg-zinc-950 dark:bg-zinc-950 text-white">
        {apiError && (
          <div className="bg-yellow-900/40 border-b border-yellow-700/50 p-3 text-center">
            <p className="text-yellow-400 text-sm">{apiError}</p>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          <div className="mb-8"><ScoreGauge score={user.neynarScore} /></div>
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-emerald-400 tracking-wide text-sm">TIER: {user.rank}</span>
            </div>
          </div>
        </div>
      <div className="p-6 pb-8 space-y-3">
        <button
          onClick={handleShareScore}
          className="group w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/30 min-h-[44px]"
        >
          <Share2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="text-lg">Share My Vibe Score</span>
        </button>
        <button
          onClick={() => setView('tips')}
          className="group w-full bg-zinc-800 dark:bg-zinc-800 hover:bg-zinc-700 dark:hover:bg-zinc-700 border border-zinc-700 dark:border-zinc-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 min-h-[44px]"
        >
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          <span className="text-lg">How to Improve Your Vibe Score</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
    );
  };

  const renderTips = () => (
    <div className="flex flex-col h-full bg-zinc-950 dark:bg-zinc-950 text-white">
      {/* Header with back button */}
      <div className="sticky top-0 bg-zinc-950/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 dark:border-zinc-800 p-4 flex items-center justify-between z-10">
        <h1 className="text-xl font-black tracking-tight">⭐ Neynar Score: Quick Do & Don&apos;t Guide</h1>
        <button
          onClick={() => setView('score')}
          className="p-2 hover:bg-zinc-800 dark:hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px]"
        >
          <X className="w-5 h-5" />
      </button>
      </div>

      {/* Content - scrollable with bottom padding for nav bar */}
      <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-6">
        <div className="space-y-4">
          {/* Introduction */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
            <p className="text-zinc-300 leading-relaxed mb-2">
              Neynar measures how helpful, real, and trustworthy you are in the feed.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              Scores go from 0.00 to 1.00, and they update weekly — slow and steady wins.
            </p>
          </div>

          {/* DO Section */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
            <h2 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
              <span className="text-2xl">✅</span>
              DO: What Helps Your Score
            </h2>
            <ul className="space-y-3 text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold mt-1">•</span>
                <span>Post real, original content — your thoughts, stories, photos, and experiences.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold mt-1">•</span>
                <span>Share value: tips, insights, or ideas that spark discussion.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold mt-1">•</span>
                <span>Make strong casts, not many: a few good posts beat 10 empty ones.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold mt-1">•</span>
                <span>Engage with intention: read before you react, leave meaningful comments, ask questions.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold mt-1">•</span>
                <span>Join real conversations: replies and dialogues count for almost half of the score.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold mt-1">•</span>
                <span>Be consistent: small, steady quality keeps your score rising.</span>
              </li>
            </ul>
          </div>

          {/* DON'T Section */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
            <h2 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
              <span className="text-2xl">❌</span>
              DON&apos;T: What Hurts Your Score
            </h2>
            <ul className="space-y-3 text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="text-red-400 font-bold mt-1">•</span>
                <span>Spam-liking or rapid reactions — Neynar flags it as fake engagement.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 font-bold mt-1">•</span>
                <span>AI-sounding or overly artificial posts — too much of it lowers quality signals.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 font-bold mt-1">•</span>
                <span>Low-effort content: generic quotes, recycled images, Pinterest/Google photos.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 font-bold mt-1">•</span>
                <span>Posting just to post: quantity without substance drags your score down.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 font-bold mt-1">•</span>
                <span>Surface-level interactions: supporting people with empty likes can even get you blocked.</span>
              </li>
            </ul>
          </div>

          {/* Core Idea */}
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-5">
            <h2 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
              <span className="text-2xl">🌱</span>
              The Core Idea
            </h2>
            <p className="text-zinc-200 leading-relaxed mb-3">
              Neynar doesn&apos;t reward noise — it rewards social usefulness.
            </p>
            <p className="text-zinc-200 leading-relaxed mb-3">
              If your presence makes conversations better, your score naturally grows.
            </p>
            <p className="text-zinc-200 leading-relaxed italic">
              Stay curious, stay human, and keep the feed bright.
            </p>
          </div>
        </div>
      </div>

      {/* Footer button - removed since we have bottom nav */}
    </div>
  );

  // Bottom navigation bar
  const renderBottomNav = () => {
    // Don't show nav on splash, onboarding, or scanning
    if (view === 'splash' || view === 'onboarding' || view === 'scanning') return null;
    
    return (
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-900/95 dark:bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800 dark:border-zinc-800 z-50">
        <div className="flex items-center justify-around h-16 px-4">
          <button
            onClick={() => setView('checkin')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] transition-colors ${
              view === 'checkin' 
                ? 'text-emerald-400' 
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setView('score')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] transition-colors ${
              view === 'score' 
                ? 'text-emerald-400' 
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs font-medium">Score</span>
          </button>
          <button
            onClick={() => setView('tips')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] transition-colors ${
              view === 'tips' 
                ? 'text-emerald-400' 
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            <Info className="w-5 h-5" />
            <span className="text-xs font-medium">Tips</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-screen max-w-md mx-auto sm:h-[800px] sm:rounded-3xl shadow-2xl overflow-hidden font-sans select-none relative">
      {view === 'splash' && renderSplash()}
      {view === 'onboarding' && renderOnboarding()}
      {view === 'checkin' && renderCheckIn()}
      {view === 'scanning' && renderScanning()}
      {view === 'score' && renderScore()}
      {view === 'tips' && renderTips()}
      {renderBottomNav()}
    </div>
  );
}
