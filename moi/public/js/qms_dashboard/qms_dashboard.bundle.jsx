import * as React from "react";
import { QmsDashboard } from "./QmsDashboard";
import { createRoot } from "react-dom/client";


class Qms_Dashboard {
	constructor({ page, wrapper }) {
		this.$wrapper = $(wrapper);
		this.page = page;

		this.init();
	}

	init() {
		this.setup_app();
	}

	setup_app() {
		// create and mount the react app
		const root = createRoot(this.$wrapper.get(0));
		root.render(<QmsDashboard />);
		this.$qms_admin = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.Qms_Dashboard = Qms_Dashboard;
export default Qms_Dashboard;