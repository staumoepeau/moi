frappe.pages["moi-file"].on_page_load = function (wrapper) {
	// Create and inject aggressive CSS to hide sidebar
	const style = document.createElement("style");
	style.textContent = `
		.body-sidebar-container { display: none !important; }
		.layout-side-section { display: none !important; }
		.sidebar-menu { display: none !important; }
		.layout-side { display: none !important; }
		body.frappe-control .layout-wrapper { margin-left: 0 !important; }
		body.frappe-control .layout-main { margin-left: 0 !important; width: 100% !important; }
		.page-head { margin-left: 0 !important; width: 100% !important; }
		.layout-main-section { margin-left: 0 !important; width: 100% !important; }
		.frappe-control .navbar { position: relative; }
	`;
	document.head.appendChild(style);

	// Use MutationObserver to ensure sidebar stays hidden
	const observer = new MutationObserver(() => {
		const bodySidebar = document.querySelector(".body-sidebar-container");
		if (bodySidebar) bodySidebar.style.display = "none";

		const sidebar = document.querySelector(".layout-side-section");
		if (sidebar) sidebar.style.display = "none";

		const sidebarMenu = document.querySelector(".sidebar-menu");
		if (sidebarMenu) sidebarMenu.style.display = "none";

		const layoutSide = document.querySelector(".layout-side");
		if (layoutSide) layoutSide.style.display = "none";

		const layoutWrapper = document.querySelector(".layout-wrapper");
		if (layoutWrapper) layoutWrapper.style.marginLeft = "0";

		const layoutMain = document.querySelector(".layout-main");
		if (layoutMain) {
			layoutMain.style.marginLeft = "0";
			layoutMain.style.width = "100%";
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });

	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("MOI Document Management"),
		single_column: true,
	});

	// Immediately hide sidebar elements
	const hideElements = () => {
		[".body-sidebar-container", ".layout-side-section", ".sidebar-menu", ".layout-side"].forEach(
			selector => {
				document.querySelectorAll(selector).forEach(el => {
					el.style.display = "none";
				});
			}
		);

		const layoutWrapper = document.querySelector(".layout-wrapper");
		if (layoutWrapper) layoutWrapper.style.marginLeft = "0";

		const layoutMain = document.querySelector(".layout-main");
		if (layoutMain) {
			layoutMain.style.marginLeft = "0";
			layoutMain.style.width = "100%";
		}
	};

	hideElements();
	setTimeout(hideElements, 100);
	setTimeout(hideElements, 500);
};

frappe.pages["moi-file"].on_page_show = function (wrapper) {
	// Keep sidebar hidden on page show
	const hideElements = () => {
		[".body-sidebar-container", ".layout-side-section", ".sidebar-menu", ".layout-side"].forEach(
			selector => {
				document.querySelectorAll(selector).forEach(el => {
					el.style.display = "none";
				});
			}
		);

		const layoutWrapper = document.querySelector(".layout-wrapper");
		if (layoutWrapper) layoutWrapper.style.marginLeft = "0";

		const layoutMain = document.querySelector(".layout-main");
		if (layoutMain) {
			layoutMain.style.marginLeft = "0";
			layoutMain.style.width = "100%";
		}
	};

	hideElements();
	setTimeout(hideElements, 50);

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
