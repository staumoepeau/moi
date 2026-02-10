frappe.pages["qms_display"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("QMS Display"),
		single_column: true,
	});
};

frappe.pages["qms_display"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("qms_display.bundle.jsx").then(() => {
		frappe.qms_display = new frappe.ui.Qms_Display({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}