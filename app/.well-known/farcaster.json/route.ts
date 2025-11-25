import { withValidManifest } from "@coinbase/onchainkit/minikit";
import { minikitConfig } from "../../../minikit.config";

export async function GET() {
  const manifest = withValidManifest(minikitConfig);
  
  // Ensure baseBuilder is included in the manifest
  const manifestWithBaseBuilder = {
    ...manifest,
    baseBuilder: minikitConfig.baseBuilder,
  };
  
  return Response.json(manifestWithBaseBuilder);
}
