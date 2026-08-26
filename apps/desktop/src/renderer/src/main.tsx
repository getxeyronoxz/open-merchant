import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@open-merchant/ui/tokens.css";
import "@open-merchant/ui/components.css";
import "./app.css";

import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing from index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
