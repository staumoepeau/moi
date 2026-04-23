frappe.pages['qms_console'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'qms_console',
		single_column: true
	});
}