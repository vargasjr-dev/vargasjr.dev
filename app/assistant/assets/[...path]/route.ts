import { proxyCadetApp } from "@/lib/cadet-app-proxy";

// The assistant bundle uses /assistant/assets even inside /web/assistant.
// Serve these same-origin instead of taking the assistant deep-link redirect.
export const GET = proxyCadetApp;
export const HEAD = proxyCadetApp;
