frappe.pages["qms_dashboard"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("QMS Dashboard"),
		single_column: true,
	});
};

frappe.pages["qms_dashboard"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("qms_dashboard.bundle.jsx").then(() => {
		frappe.qms_dashboard = new frappe.ui.Qms_Dashboard({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}