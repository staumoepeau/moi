import * as React from "react";
import { App } from "./App";
import { createRoot } from "react-dom/client";

class Qms_Terminal {
	constructor({ page, wrapper }) {
		this.$wrapper = $(wrapper);
		this.page = page;

		this.init();
	}

	init() {
		// this.hide_frappe_ui(); // Remove sidebar and navbar
		this.setup_app();
	}

	// hide_frappe_ui() {
	// 	// 1. Hide the Sidebar
	// 	this.page.sidebar.hide();

	// 	// 2. Hide the Navbar (Global Frappe Navbar)
	// 	$(".navbar").hide();

	// 	// 3. Remove the Breadcrumbs and Page Headings for a clean look
	// 	this.page.header.hide();

	// 	// 4. Force the container to take full width and height
	// 	// Frappe usually adds padding and max-width to the layout
	// 	$(".layout-main-section-wrapper").css({
	// 		"padding": "0",
	// 		"margin": "0"
	// 	});
		
	// 	$(".layout-main-section").css({
	// 		"padding": "0",
	// 		"max-width": "100%"
	// 	});
		
	// 	// Hide the footer if it exists
	// 	$(".page-footer").hide();
	// }

	setup_app() {
		// create and mount the react app
		const root = createRoot(this.$wrapper.get(0));
		root.render(<App />);
		this.$qms_terminal = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.Qms_Terminal = Qms_Terminal;
export default Qms_Terminal;