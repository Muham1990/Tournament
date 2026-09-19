import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { SupabaseAuthProvider } from "./hooks/useSupabaseAuth";
import { ToastProvider } from "./hooks/useToast";
import "./i18n";
import "./styles/index.css";
import { initTelegramMiniApp } from "./telegram";

initTelegramMiniApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SupabaseAuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SupabaseAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
