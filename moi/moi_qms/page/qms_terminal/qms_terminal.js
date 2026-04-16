// Add manifest link to page head before anything else
frappe.call({
	method: 'frappe.client.get',
	args: {
		doctype: 'Website Settings',
		name: 'Website Settings'
	},
	freeze: false,
	callback: function() {
		// Just trigger after page setup
	}
});

// Polyfill for Chrome DevTools metrics (harmless if missing)
if (typeof window.__chromium_devtools_metrics_reporter === 'undefined') {
	window.__chromium_devtools_metrics_reporter = function() {};
}

// Suppress harmless Chrome extension errors
window.addEventListener('unhandledrejection', event => {
	if (event.reason && event.reason.message &&
	    event.reason.message.includes('Could not establish connection')) {
		event.preventDefault();
	}
});

frappe.pages["qms_terminal"].on_page_load = function (wrapper) {
	// Add manifest link to document head IMMEDIATELY
	if (!document.querySelector('link[rel="manifest"]')) {
		const link = document.createElement('link');
		link.rel = 'manifest';
		link.href = '/assets/moi/manifest.json';
		document.head.appendChild(link);
		console.log('[QMS] Manifest link added');
	}

	// Add theme color meta tag
	if (!document.querySelector('meta[name="theme-color"]')) {
		const meta = document.createElement('meta');
		meta.name = 'theme-color';
		meta.content = '#2490ef';
		document.head.appendChild(meta);
	}

	// ── iOS-specific PWA Support ──────────────────────────────────────
	// Enable standalone mode on iOS
	if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
		const iosMeta = document.createElement('meta');
		iosMeta.name = 'apple-mobile-web-app-capable';
		iosMeta.content = 'yes';
		document.head.appendChild(iosMeta);
		console.log('[QMS] iOS standalone mode enabled');
	}

	// Set iOS status bar style
	if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
		const statusBarMeta = document.createElement('meta');
		statusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
		statusBarMeta.content = 'black-translucent';
		document.head.appendChild(statusBarMeta);
	}

	// Set iOS app title (shows on home screen)
	if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
		const titleMeta = document.createElement('meta');
		titleMeta.name = 'apple-mobile-web-app-title';
		titleMeta.content = 'MOI QMS';
		document.head.appendChild(titleMeta);
	}

	// Add iOS home screen icon (required for home screen appearance)
	if (!document.querySelector('link[rel="apple-touch-icon"]')) {
		const icon = document.createElement('link');
		icon.rel = 'apple-touch-icon';
		icon.href = '/assets/moi/icons/icon-192.png';
		document.head.appendChild(icon);
		console.log('[QMS] iOS home screen icon added');
	}

	// Register service worker for offline support
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/assets/moi/service-worker.js', { scope: '/' })
			.then(registration => {
				console.log('[QMS] Service Worker registered');
			})
			.catch(error => {
				console.warn('[QMS] Service Worker registration failed:', error);
			});
	}

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
