import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// DevTools Console is not a JS module — `import.meta` fails there. In dev we mirror the value here
// so you can run: __VITE_SYNC_ADMIN_USER_ID__   (no import.meta)
if (import.meta.env.DEV) {
  const syncAdminId = import.meta.env.VITE_SYNC_ADMIN_USER_ID;
  (globalThis as unknown as { __VITE_SYNC_ADMIN_USER_ID__?: string }).__VITE_SYNC_ADMIN_USER_ID__ =
    syncAdminId;
  if (syncAdminId == null || String(syncAdminId).trim() === "") {
    console.warn(
      "[dev] VITE_SYNC_ADMIN_USER_ID is missing. Add it to .env in the project root and restart npm run dev."
    );
  }
}

createRoot(document.getElementById("root")!).render(<App />);