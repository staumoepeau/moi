import * as React from "react";
import { QmsConsole } from "./QmsConsole";
import { createRoot } from "react-dom/client";


class Qms_Console {
	constructor({ page, wrapper }) {
		this.$wrapper = $(wrapper);
		this.page = page;

		this.init();
	}

	init() {
		// this.setup_page_actions();
		this.setup_app();
	}

	// setup_page_actions() {
	// 	// setup page actions
	// 	this.primary_btn = this.page.set_primary_action(__("Print Message"), () =>
	//   		frappe.msgprint("Hello My Page!")
	// 	);
	// }

	setup_app() {
		// create and mount the react app
		const root = createRoot(this.$wrapper.get(0));
		root.render(<QmsConsole />);
		this.$qms_console = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.Qms_Console = Qms_Console;
export default Qms_Console;