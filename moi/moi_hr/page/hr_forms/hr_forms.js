frappe.pages["hr-forms"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("HR Forms"),
		single_column: true,
	});
};

frappe.pages["hr-forms"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("hr_forms.bundle.jsx").then(() => {
		frappe.hr_forms = new frappe.ui.HrForms({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}