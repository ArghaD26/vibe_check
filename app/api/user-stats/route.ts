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

    // Fetch user stats/casts for engagement metrics
    let likesReceived = 0;
    const followersCount = user.follower_count || user.followers?.count || 0;
    
    try {
      const castsResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/user?fid=${fid}&limit=100`,
        {
          headers: {
            "api_key": neynarApiKey,
            "accept": "application/json",
          },
        }
      );

      if (castsResponse.ok) {
        const castsData = await castsResponse.json();
        const casts = castsData.result?.casts || castsData.casts || [];
        likesReceived = casts.reduce((sum: number, cast: { reactions?: { likes?: unknown[] }; like_count?: number }) => {
          const likes = cast.reactions?.likes?.length || cast.like_count || 0;
          return sum + likes;
        }, 0);
        console.log(`Calculated likes received: ${likesReceived} from ${casts.length} casts`);
      } else {
        console.warn("Failed to fetch casts, status:", castsResponse.status);
      }
    } catch (castError) {
      console.warn("Error fetching casts:", castError);
      // Continue without cast data
    }

    // Calculate Neynar score (this is a placeholder - adjust based on actual Neynar scoring)
    // You might need to use a different endpoint or calculate this yourself
    const neynarScore = Math.min(0.99, 0.5 + (followersCount / 10000) * 0.3 + (likesReceived / 1000) * 0.2);
    
    // Determine rank based on score
    let rank = "RISING";
    if (neynarScore > 0.9) rank = "LEGENDARY";
    else if (neynarScore > 0.72) rank = "ELITE";
    else if (neynarScore > 0.58) rank = "STRONG";

    return {
      username: user.username || user.display_name || `fid-${fid}`,
      fid: fid,
      streak: Math.floor(Math.random() * 30) + 1, // Placeholder - you'd track this in a database
      neynarScore: neynarScore,
      scoreDelta: (Math.random() * 0.01) - 0.005, // Placeholder
      rank: rank,
      followersGained: Math.floor(Math.random() * 20), // Placeholder - compare with previous day
      likesReceived: likesReceived,
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
    return {
      username: user.username || user.display_name || `fid-${fid}`,
      fid: fid,
      streak: 1, // Would need to track this
      neynarScore: 0.5, // Default score without Neynar API
      scoreDelta: 0,
      rank: "RISING",
      followersGained: 0,
      likesReceived: 0,
    };
  } catch (error) {
    console.error("Error fetching from Farcaster:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  console.log("=== User Stats API Called ===");
  const authorization = request.headers.get("Authorization");
  console.log("Authorization header present:", !!authorization);

  if (!authorization || !authorization.startsWith("Bearer ")) {
    console.error("Missing or invalid authorization header");
    return NextResponse.json({ 
      success: false,
      message: "Missing token" 
    }, { status: 401 });
  }

  try {
    const domain = getUrlHost(request);
    console.log("Verifying JWT for domain:", domain);
    
    const payload = await client.verifyJwt({
      token: authorization.split(" ")[1] as string,
      domain: domain,
    });

    console.log("JWT verified, payload:", payload);
    const userFid = typeof payload.sub === 'string' ? parseInt(payload.sub) : payload.sub;
    console.log("User FID:", userFid);

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

