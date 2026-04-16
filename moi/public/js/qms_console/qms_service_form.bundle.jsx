import * as React from "react";
import { QmsServiceForm } from "./QmsServiceForm";
import { createRoot } from "react-dom/client";

class QmsServiceFormApp {
	constructor({ page, wrapper }) {
		this.$wrapper = $(wrapper);
		this.page = page;
		this.init();
	}

	init() {
		// Hide frappe UI for full-screen form
		this.page.sidebar?.hide();
		$(".navbar").hide();
		this.page.header?.hide();
		$(".layout-main-section-wrapper").css({ padding: "0", margin: "0" });
		$(".layout-main-section").css({ padding: "0", "max-width": "100%" });
		$(".page-footer").hide();

		this.setup_app();
	}

	setup_app() {
		const root = createRoot(this.$wrapper.get(0));
		root.render(<QmsServiceForm />);
		this.$app = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.QmsServiceFormApp = QmsServiceFormApp;
export default QmsServiceFormApp;
