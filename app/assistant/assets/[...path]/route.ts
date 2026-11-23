import { proxyCadetDev } from "@/lib/cadet-dev-proxy";

// The assistant bundle uses /assistant/assets even inside /web/assistant.
// Serve these same-origin instead of taking the assistant deep-link redirect.
export const GET = proxyCadetDev;
export const HEAD = proxyCadetDev;
