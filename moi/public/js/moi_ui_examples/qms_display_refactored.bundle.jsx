/**
 * qms_display_refactored.bundle.jsx
 *
 * Bundle entry point for the refactored QMS Display page
 * Use this to load the component in Frappe
 */

import React from "react"
import ReactDOM from "react-dom/client"
import { QmsDisplayRefactored } from "./QmsDisplayRefactored"

// Import mywhy-ui CSS (commented out - not needed for production)
// import "mywhy-ui/globals.css"

const root = ReactDOM.createRoot(document.getElementById("app"))
root.render(
  <React.StrictMode>
    <QmsDisplayRefactored />
  </React.StrictMode>
)
