import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@farcaster/quick-auth";

const client = createClient();

// Helper function to get domain from request
function getUrlHost(request: NextRequest): string {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const url = new URL(origin);
      return url.host;
    } catch (error) {
      console.warn("Invalid origin header:", origin, error);
    }
  }

  const host = request.headers.get("host");
  if (host) {
    return host;
  }

  let urlValue: string;
  if (process.env.VERCEL_ENV === "production") {
    urlValue = process.env.NEXT_PUBLIC_URL!;
  } else if (process.env.VERCEL_URL) {
    urlValue = `https://${process.env.VERCEL_URL}`;
  } else {
    urlValue = "http://localhost:3000";
  }

  const url = new URL(urlValue);
  return url.host;
}

// Fetch user data from Neynar API
async function fetchUserDataFromNeynar(fid: number) {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.warn("NEYNAR_API_KEY not set, using fallback data");
    return null;
  }

  try {
    console.log(`Fetching Neynar data for FID: ${fid}`);
    console.log(`API Key present: ${!!neynarApiKey}, length: ${neynarApiKey?.length}`);
    
    // Fetch user profile from Neynar - try v2 first, fallback to v1
    let profileResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          "api_key": neynarApiKey,
          "accept": "application/json",
        },
      }
    );

    // If v2 fails, try v1
    if (!profileResponse.ok && profileResponse.status === 404) {
      console.log("v2 endpoint failed, trying v1...");
      profileResponse = await fetch(
        `https://api.neynar.com/v1/farcaster/user?fid=${fid}`,
        {
          headers: {
            "api_key": neynarApiKey,
            "accept": "application/json",
          },
        }
      );
    }

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error(`Neynar API error (${profileResponse.status}):`, errorText);
      throw new Error(`Neynar API error: ${profileResponse.statusText}`);
    }

    const profileData = await profileResponse.json();
    console.log("Neynar profile data:", JSON.stringify(profileData, null, 2));
    
    // Handle different possible response structures
    const user = profileData.users?.[0] || profileData.result?.user || profileData.user;

    if (!user) {
      console.warn("No user found in Neynar response. Full response:", profileData);
      return null;
    }

    console.log("Found user:", user.username || user.display_name);
    console.log("User object keys:", Object.keys(user));
    
    // Log experimental_features specifically to debug score location
    if (user.experimental_features) {
      console.log("🔬 Experimental features:", JSON.stringify(user.experimental_features, null, 2));
    } else {
      console.log("⚠️ No experimental_features found in user object");
    }
    
    // Log full user object (but truncate if too large)
    const userStr = JSON.stringify(user, null, 2);
    if (userStr.length > 5000) {
      console.log("Full user object (truncated):", userStr.substring(0, 5000) + "...");
    } else {
      console.log("Full user object:", userStr);
    }

    // Get follower count - Neynar API v2 returns follower_count directly
    const totalFollowers = user.follower_count || 
                           user.followers?.count || 
                           user.followers_count ||
                           0;
    console.log("📊 Total followers from Neynar API:", totalFollowers);

    // Get Neynar score from experimental features or calculate it
    // Neynar API might return score as 0-1 (decimal) or 0-100 (percentage)
    let neynarScore = user.experimental_features?.neynar_score || 
                     user.experimental_features?.score ||
                     user.neynar_score || 
                     user.score || 
                     null;
    
    console.log("🔍 Raw score from API:", {
      experimental_features: user.experimental_features,
      neynar_score: user.neynar_score,
      score: user.score,
      rawValue: neynarScore,
      rawType: typeof neynarScore
    });
    
    // If score is missing, return null instead of defaulting
    if (neynarScore === null || neynarScore === undefined) {
      console.warn("⚠️ No Neynar score found in API response");
      return null; // Don't return fake data
    }
    
    // Validate score is a number
    if (typeof neynarScore !== 'number' || isNaN(neynarScore)) {
      console.error("❌ Invalid score type or NaN:", neynarScore);
      return null;
    }
    
    // Convert to 0-1 range if it's in 0-100 range
    // Neynar scores are typically in 0-100 range, but check carefully
    if (neynarScore > 1 && neynarScore <= 100) {
      console.log("📊 Score appears to be in 0-100 format, converting to 0-1");
      neynarScore = neynarScore / 100;
    } else if (neynarScore > 100) {
      // If score is > 100, it's definitely wrong - reject it
      console.error("❌ Score is > 100, which is invalid:", neynarScore);
      return null;
    } else if (neynarScore < 0) {
      // Negative scores are invalid
      console.error("❌ Score is negative, which is invalid:", neynarScore);
      return null;
    }
    
    // Store original raw score for validation
    const originalRawScore = neynarScore;
    
    // Ensure score is between 0 and 1
    neynarScore = Math.max(0, Math.min(1, neynarScore));
    
    // Additional validation: Reject suspiciously high scores (> 0.95) unless from reliable source
    // Real Neynar scores rarely exceed 0.95 (95%), so scores > 0.95 are likely errors
    if (neynarScore > 0.95) {
      console.warn("⚠️ WARNING: Score is suspiciously high (>95%):", neynarScore);
      console.warn("⚠️ This might be incorrect data. Checking score source...");
      
      // Check if score came from experimental_features (most reliable source)
      const fromExperimentalFeatures = !!(user.experimental_features?.neynar_score || 
                                         user.experimental_features?.score);
      
      if (!fromExperimentalFeatures) {
        console.error("❌ High score (>95%) not from experimental_features, likely incorrect. Rejecting.");
        console.error("❌ Raw score was:", originalRawScore, "from source:", {
          experimental_neynar_score: user.experimental_features?.neynar_score,
          experimental_score: user.experimental_features?.score,
          neynar_score: user.neynar_score,
          score: user.score
        });
        return null;
      } else {
        console.log("✅ High score confirmed from experimental_features, accepting:", neynarScore);
      }
    }
    
    console.log("⭐ Final Neynar score (0-1):", neynarScore, `(${(neynarScore * 100).toFixed(1)}%)`);

    // Calculate account age in days from created_at timestamp
    let accountAgeDays = 0;
    try {
      // Neynar API may provide created_at, registered_at, or registration_timestamp
      const createdAt = user.created_at || 
                       user.registered_at || 
                       user.registration_timestamp ||
                       user.timestamp;
      
      console.log("📅 Checking for creation date:", {
        created_at: user.created_at,
        registered_at: user.registered_at,
        registration_timestamp: user.registration_timestamp,
        timestamp: user.timestamp
      });
      
      if (createdAt) {
        // Handle both Unix timestamp (seconds or milliseconds) and ISO string
        let creationDate: Date;
        if (typeof createdAt === 'number') {
          // If it's a number, check if it's in seconds or milliseconds
          // Timestamps > 1e12 are in milliseconds, < 1e12 are in seconds
          creationDate = new Date(createdAt > 1e12 ? createdAt : createdAt * 1000);
        } else if (typeof createdAt === 'string') {
          creationDate = new Date(createdAt);
        } else {
          creationDate = new Date(createdAt);
        }
        
        // Validate the date
        if (!isNaN(creationDate.getTime())) {
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - creationDate.getTime());
          accountAgeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          console.log("📅 Account creation date:", creationDate);
          console.log("📅 Account age in days:", accountAgeDays);
        } else {
          throw new Error("Invalid date");
        }
      } else {
        console.warn("⚠️ No account creation date found in Neynar API response");
        // Fallback: estimate based on FID (lower FID = older account)
        // FID 1 was created around Jan 2020, so we can estimate
        const baseDate = new Date('2020-01-01').getTime();
        const now = Date.now();
        const daysSinceBase = Math.floor((now - baseDate) / (1000 * 60 * 60 * 24));
        
        // Lower FID = older account, but this is very rough
        if (fid < 1000) {
          accountAgeDays = Math.min(daysSinceBase, 730); // ~2 years max
        } else if (fid < 10000) {
          accountAgeDays = Math.min(daysSinceBase, 365); // ~1 year max
        } else {
          accountAgeDays = Math.min(daysSinceBase, 180); // ~6 months max
        }
        console.log("📅 Estimated account age from FID:", accountAgeDays, "days");
      }
    } catch (error) {
      console.error("❌ Error calculating account age:", error);
      // Final fallback
      accountAgeDays = 365; // Default to 1 year
    }
    
    // Determine tier based on score (0-100 scale, every 10 points)
    // Convert score (0-1) to percentage (0-100)
    const scorePercent = Math.floor(neynarScore * 100);
    
    // Calculate tier based on 10-point ranges
    let rank: string;
    if (scorePercent >= 90) {
      rank = "LEGENDARY";
    } else if (scorePercent >= 80) {
      rank = "MASTER";
    } else if (scorePercent >= 70) {
      rank = "ELITE";
    } else if (scorePercent >= 60) {
      rank = "ADVANCED";
    } else if (scorePercent >= 50) {
      rank = "STRONG";
    } else if (scorePercent >= 40) {
      rank = "GROWING";
    } else if (scorePercent >= 30) {
      rank = "RISING";
    } else if (scorePercent >= 20) {
      rank = "APPRENTICE";
    } else if (scorePercent >= 10) {
      rank = "NOVICE";
    } else {
      rank = "BEGINNER";
    }

    return {
      username: user.username || user.display_name || `fid-${fid}`,
      fid: fid,
      streak: Math.floor(Math.random() * 30) + 1, // Placeholder - you'd track this in a database
      neynarScore: neynarScore,
      scoreDelta: (Math.random() * 0.01) - 0.005, // Placeholder
      rank: rank,
      totalFollowers: totalFollowers,
      accountAgeDays: accountAgeDays,
    };
  } catch (error) {
    console.error("Error fetching from Neynar:", error);
    return null;
  }
}

// Fallback function using Farcaster Hub API (no API key required)
async function fetchUserDataFromFarcaster(fid: number) {
  try {
    // Using a public Farcaster Hub endpoint
    const response = await fetch(
      `https://hub-api.neynar.com/v1/farcaster/user-by-fid?fid=${fid}`,
      {
        headers: {
          "accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const user = data.result?.user;

    if (!user) {
      return null;
    }

    // Basic stats (without Neynar API, we have limited data)
    // Estimate account age from FID
    const baseDate = new Date('2020-01-01').getTime();
    const now = Date.now();
    const daysSinceBase = Math.floor((now - baseDate) / (1000 * 60 * 60 * 24));
    let accountAgeDays = 365; // Default
    if (fid < 1000) {
      accountAgeDays = Math.min(daysSinceBase, 730);
    } else if (fid < 10000) {
      accountAgeDays = Math.min(daysSinceBase, 365);
    } else {
      accountAgeDays = Math.min(daysSinceBase, 180);
    }

    return {
      username: user.username || user.display_name || `fid-${fid}`,
      fid: fid,
      streak: 1, // Would need to track this
      neynarScore: 0.5, // Default score without Neynar API
      scoreDelta: 0,
      rank: "BEGINNER",
      totalFollowers: 0, // Farcaster Hub API doesn't provide follower count
      accountAgeDays: accountAgeDays,
    };
  } catch (error) {
    console.error("Error fetching from Farcaster:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  console.log("=== User Stats API Called ===");
  const authorization = request.headers.get("Authorization");
  const { searchParams } = new URL(request.url);
  const fidParam = searchParams.get("fid");
  
  console.log("Authorization header present:", !!authorization);
  console.log("FID query param:", fidParam);
  console.log("Request origin:", request.headers.get("origin"));
  console.log("Request referer:", request.headers.get("referer"));
  console.log("User agent:", request.headers.get("user-agent"));

  let userFid: number | null = null;

  // Try to get FID from JWT auth first
  if (authorization && authorization.startsWith("Bearer ")) {
    try {
      const domain = getUrlHost(request);
      console.log("Verifying JWT for domain:", domain);
      
      const payload = await client.verifyJwt({
        token: authorization.split(" ")[1] as string,
        domain: domain,
      });

      console.log("JWT verified, payload:", payload);
      userFid = typeof payload.sub === 'string' ? parseInt(payload.sub) : payload.sub;
      console.log("User FID from JWT:", userFid);
    } catch (jwtError) {
      console.warn("JWT verification failed:", jwtError);
      // Continue to try FID query param
    }
  }

  // Fallback to FID query parameter if JWT auth failed or not provided
  if (!userFid && fidParam) {
    userFid = parseInt(fidParam);
    console.log("Using FID from query param:", userFid);
  }

  if (!userFid || isNaN(userFid)) {
    console.error("Unable to determine user FID");
    return NextResponse.json({ 
      success: false,
      message: "Unable to determine user FID. Provide either JWT token or 'fid' query parameter.",
      error: "Missing user identifier",
    }, { status: 400 });
  }

  try {

    // Try to fetch from Neynar first, then fallback to Farcaster
    console.log("Attempting to fetch from Neynar...");
    let userData = await fetchUserDataFromNeynar(userFid);
    
    if (!userData) {
      console.log("Neynar fetch failed, trying Farcaster fallback...");
      userData = await fetchUserDataFromFarcaster(userFid);
    }

    if (!userData) {
      console.error("Failed to fetch user data from both Neynar and Farcaster");
      // Return a response with success: false so frontend knows it failed
      return NextResponse.json(
        { 
          success: false,
          message: "Unable to fetch user data",
          error: "Both Neynar and Farcaster APIs failed",
          fid: userFid
        },
        { status: 200 } // Return 200 so useQuickAuth doesn't treat it as an error
      );
    }

    console.log("Successfully fetched user data:", userData);
    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (e) {
    console.error("Error in user-stats route:", e);
    if (e instanceof Error) {
      return NextResponse.json({ 
        success: false,
        message: e.message,
        error: e.stack
      }, { status: 200 }); // Return 200 so frontend can handle it
    }
    throw e;
  }
}

