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
  baseBuilder: {
    ownerAddress: "0xD7924Fcd7EC2BBD907ED677e9D20941540C1EC00"
  },
  miniapp: {
    version: "1",
    name: "Vibe Check", 
    subtitle: "Check your signal score", 
    description: "Track your signal strength, growth stats, and daily vibe. Get insights into your followers, likes, and streak to understand your onchain presence.",
    screenshotUrls: [
      `${ROOT_URL}/vibecheck_screenshot_1.png`,
      `${ROOT_URL}/vibecheck_screenshot_2.png`,
      `${ROOT_URL}/vibecheck_screenshot_3.png`
    ],
    iconUrl: `${ROOT_URL}/vibecheck_1024.png`,
    splashImageUrl: `${ROOT_URL}/vibecheck_1024.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["social", "neynar", "base", "farcaster", "stats", "baseapp"],
    heroImageUrl: `${ROOT_URL}/vibecheck_cover_1200x630.png`, 
    tagline: "Sync up and check your vibe",
    ogTitle: "Vibe Check - Neynar Score",
    ogDescription: "Track your vibe score and see where you rank. Check your vibe and share your score!",
    ogImageUrl: `${ROOT_URL}/vibecheck_cover_1200x630.png`,
  },
} as const;

