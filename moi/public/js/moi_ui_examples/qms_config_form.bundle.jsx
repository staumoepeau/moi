/**
 * qms_config_form.bundle.jsx
 *
 * Bundle entry point for the QMS Config Form example page
 * Use this to load the component in Frappe
 */

import React from "react"
import ReactDOM from "react-dom/client"
import { QmsConfigForm } from "./QmsConfigForm"

// Import mywhy-ui CSS
import "mywhy-ui/globals.css"

const root = ReactDOM.createRoot(document.getElementById("app"))
root.render(
  <React.StrictMode>
    <QmsConfigForm />
  </React.StrictMode>
)
