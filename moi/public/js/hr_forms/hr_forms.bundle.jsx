import * as React from "react";
import { HRForms } from "./HRForms";
import { createRoot } from "react-dom/client";


class HrForms {
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
		root.render(<HRForms />);
		this.$hr_forms = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.HrForms = HrForms;
export default HrForms;