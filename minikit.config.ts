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
    name: "Cubey", 
    subtitle: "Your AI Ad Companion", 
    description: "Ads",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["marketing", "ads", "quickstart", "waitlist"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "",
    ogTitle: "",
    ogDescription: "",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
  },
} as const;

