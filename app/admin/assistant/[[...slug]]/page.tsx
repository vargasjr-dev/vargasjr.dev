import { CadetAssistant } from "./cadet-assistant";

export default function AssistantPage() {
  // basename /admin puts the desktop shell's own /assistant route at
  // /admin/assistant — the bare path already lands inside the app.
  return <CadetAssistant />;
}
