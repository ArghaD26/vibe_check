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
    // Fetch user profile from Neynar
    const profileResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          "api_key": neynarApiKey,
          "accept": "application/json",
        },
      }
    );

    if (!profileResponse.ok) {
      throw new Error(`Neynar API error: ${profileResponse.statusText}`);
    }

    const profileData = await profileResponse.json();
    const user = profileData.users?.[0];

    if (!user) {
      return null;
    }

    // Fetch user stats/casts for engagement metrics
    const castsResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/user?fid=${fid}&limit=100`,
      {
        headers: {
          "api_key": neynarApiKey,
          "accept": "application/json",
        },
      }
    );

    let likesReceived = 0;
    const followersCount = user.follower_count || 0;
    
    if (castsResponse.ok) {
      const castsData = await castsResponse.json();
      const casts = castsData.result?.casts || [];
      likesReceived = casts.reduce((sum: number, cast: { reactions?: { likes?: unknown[] } }) => 
        sum + (cast.reactions?.likes?.length || 0), 0);
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
  const authorization = request.headers.get("Authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Missing token" }, { status: 401 });
  }

  try {
    const payload = await client.verifyJwt({
      token: authorization.split(" ")[1] as string,
      domain: getUrlHost(request),
    });

    const userFid = typeof payload.sub === 'string' ? parseInt(payload.sub) : payload.sub;

    // Try to fetch from Neynar first, then fallback to Farcaster
    let userData = await fetchUserDataFromNeynar(userFid);
    
    if (!userData) {
      userData = await fetchUserDataFromFarcaster(userFid);
    }

    if (!userData) {
      return NextResponse.json(
        { message: "Unable to fetch user data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (e) {
    if (e instanceof Error) {
      return NextResponse.json({ message: e.message }, { status: 500 });
    }
    throw e;
  }
}

