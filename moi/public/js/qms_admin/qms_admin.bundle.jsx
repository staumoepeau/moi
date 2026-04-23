import { QmsAdmin } from "./QmsAdmin";

frappe.ui.QmsAdmin = class QmsAdmin {
	constructor({ wrapper, page }) {
		this.wrapper = wrapper;
		this.page = page;
		this.init();
	}

	init() {
		frappe.render_app(this.wrapper, () => <QmsAdmin />);
	}
};
