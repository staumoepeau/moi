frappe.pages["qms_admin"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("QMS Administration"),
		single_column: true,
	});
};

frappe.pages["qms_admin"].on_page_show = function (wrapper) {
	load_admin_page(wrapper);
};

function load_admin_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("qms_admin.bundle.jsx").then(() => {
		frappe.qms_admin = new frappe.ui.QmsAdmin({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}
