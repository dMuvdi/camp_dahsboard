// Consent signing backend; all logic lives in ../_shared/consentHandler.ts (shared with the Node self-checks)
import { handleConsent } from "../_shared/consentHandler.ts";

Deno.serve(handleConsent);
