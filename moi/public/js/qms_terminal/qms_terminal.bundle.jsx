import * as React from "react";
import { QmsTerminal } from "./QmsTerminal";
import { createRoot } from "react-dom/client";

class Qms_Terminal {
	constructor({ page, wrapper }) {
		this.$wrapper = $(wrapper);
		this.page = page;

		this.init();
	}

	init() {
		this.hide_frappe_ui(); // Remove sidebar and navbar for kiosk mode
		this.setup_pwa(); // Setup PWA support
		this.setup_app();
	}

	setup_pwa() {
		// Add manifest link (served from /assets/moi/)
		if (!document.querySelector('link[rel="manifest"]')) {
			const manifest = document.createElement('link');
			manifest.rel = 'manifest';
			manifest.href = '/assets/moi/manifest.json';
			document.head.appendChild(manifest);
		}

		// Add PWA meta tags
		const metaTags = [
			{ name: 'theme-color', content: '#2490ef' },
			{ name: 'apple-mobile-web-app-capable', content: 'yes' },
			{ name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
			{ name: 'apple-mobile-web-app-title', content: 'QMS Ticket' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
		];

		metaTags.forEach(tag => {
			if (!document.querySelector(`meta[name="${tag.name}"]`)) {
				const meta = document.createElement('meta');
				meta.name = tag.name;
				meta.content = tag.content;
				document.head.appendChild(meta);
			}
		});

		// Add apple-touch-icon
		if (!document.querySelector('link[rel="apple-touch-icon"]')) {
			const icon = document.createElement('link');
			icon.rel = 'apple-touch-icon';
			icon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%232490ef" width="192" height="192" rx="45"/><text x="96" y="96" font-size="96" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">Q</text></svg>';
			document.head.appendChild(icon);
		}

		console.log('[PWA] Setup completed');
	}

	hide_frappe_ui() {
		// Hide sidebar, navbar, and header for full-screen kiosk mode
		this.page.sidebar?.hide();
		$(".navbar").hide();
		this.page.header?.hide();
		$(".layout-main-section-wrapper").css({ padding: "0", margin: "0" });
		$(".layout-main-section").css({ padding: "0", "max-width": "100%" });
		$(".page-footer").hide();
	}

	setup_app() {
		// create and mount the react app
		const root = createRoot(this.$wrapper.get(0));
		root.render(<QmsTerminal />);
		this.$qms_terminal = root;
	}
}

frappe.provide("frappe.ui");
frappe.ui.Qms_Terminal = Qms_Terminal;
export default Qms_Terminal;