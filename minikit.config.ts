const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjM0NDYyMCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDhmNjgzRDRDNTAyMkZkRGE2MGI0NTJmODZlNjE2NDRkODlDNDNkY2MifQ",
    payload: "eyJkb21haW4iOiJ2aWJlY2hlY2stb2xpdmUudmVyY2VsLmFwcCJ9",
    signature: "aKEZqHCugBKFf9QdXYkLx80TaKFt5qvitPO1dOomogVVq2f/QX3+aw8NWXfljOHEIid4xpQ5fxkRynC8cQXW2hw="
  },
  miniapp: {
    version: "1",
    name: "Vibe Check", 
    subtitle: "Check Your Signal Score", 
    description: "Track your Farcaster signal strength, growth stats, and daily vibe. Get insights into your followers, likes, and streak to understand your onchain presence.",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/vibe_cat.jpg`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["social", "analytics", "farcaster", "signal", "stats", "growth"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "Sync up and check your vibe",
    ogTitle: "Vibe Check - Check Your Signal Score",
    ogDescription: "Track your Farcaster signal strength, growth stats, and daily vibe. Get insights into your onchain presence.",
    ogImageUrl: `${ROOT_URL}/vibe_cat.jpg`,
  },
} as const;

