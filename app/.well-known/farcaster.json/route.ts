import { withValidManifest } from "@coinbase/onchainkit/minikit";
import { minikitConfig } from "../../../minikit.config";

export async function GET() {
  const manifest = withValidManifest(minikitConfig);
  
  // Ensure baseBuilder is included in the manifest at the root level
  // Base Builder requires this field to verify ownership
  const manifestWithBaseBuilder = {
    ...manifest,
    baseBuilder: {
      ownerAddress: minikitConfig.baseBuilder.ownerAddress,
    },
  };
  
  return Response.json(manifestWithBaseBuilder);
}
