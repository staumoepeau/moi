frappe.pages["qms_terminal"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("QMS Terminal"),
		single_column: true,
	});
};

frappe.pages["qms_terminal"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("qms_terminal.bundle.jsx").then(() => {
		frappe.qms_terminal = new frappe.ui.Qms_Terminal({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}