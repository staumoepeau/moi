frappe.pages["qms_console"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("QMS Console"),
		single_column: true,
	});
};

frappe.pages["qms_console"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("qms_console.bundle.jsx").then(() => {
		frappe.qms_console = new frappe.ui.Qms_Console({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}