import * as React from "react";
import { QmsDisplay } from "./QmsDisplay";
import { createRoot } from "react-dom/client";


class Qms_Display {
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
		root.render(<QmsDisplay />);
		this.$qms_display = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.Qms_Display = Qms_Display;
export default Qms_Display;