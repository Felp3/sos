import React from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

const rootElement = document.getElementById("root")!
const application = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, application)
} else {
  createRoot(rootElement).render(application)
}
