import * as React from "react";
import { MOIFile } from "./MOIFile";
import { createRoot } from "react-dom/client";


class MoiFile {
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
		root.render(<MOIFile />);
		this.$moi_file = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.MoiFile = MoiFile;
export default MoiFile;