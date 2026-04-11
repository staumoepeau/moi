import * as React from "react";
import { QmsTerminal } from "./QmsTerminal";
import { createRoot } from "react-dom/client";

class Qms_Terminal {
	constructor({ page, wrapper }) {
		this.$wrapper = $(wrapper);
		this.page = page;

		this.init();
	}

	init() {
		this.hide_frappe_ui(); // Remove sidebar and navbar for kiosk mode
		this.setup_app();
	}

	hide_frappe_ui() {
		// Hide sidebar, navbar, and header for full-screen kiosk mode
		this.page.sidebar?.hide();
		$(".navbar").hide();
		this.page.header?.hide();
		$(".layout-main-section-wrapper").css({ padding: "0", margin: "0" });
		$(".layout-main-section").css({ padding: "0", "max-width": "100%" });
		$(".page-footer").hide();
	}

	setup_app() {
		// create and mount the react app
		const root = createRoot(this.$wrapper.get(0));
		root.render(<QmsTerminal />);
		this.$qms_terminal = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.Qms_Terminal = Qms_Terminal;
export default Qms_Terminal;