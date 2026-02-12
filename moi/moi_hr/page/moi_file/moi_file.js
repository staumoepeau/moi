frappe.pages["moi-file"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("MOI File"),
		single_column: true,
	});
};

frappe.pages["moi-file"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("moi_file.bundle.jsx").then(() => {
		frappe.moi_file = new frappe.ui.MoiFile({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}