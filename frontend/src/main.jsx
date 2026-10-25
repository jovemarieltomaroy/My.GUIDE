import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import SplashScreen from "./components/SplashScreen";
import { AuthProvider } from "./context/AuthContext";

import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SplashScreen>
          <App />
        </SplashScreen>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
