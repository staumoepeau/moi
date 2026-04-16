// Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
// For license information, please see license.txt

frappe.ui.form.on("QMS Service", {
	refresh(frm) {
		ensure_fontawesome_loaded();
		display_icon_preview(frm);
	},
	image(frm) {
		display_icon_preview(frm);
	}
});

function ensure_fontawesome_loaded() {
	if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
		document.head.appendChild(link);
	}
}

function display_icon_preview(frm) {
	const icon_value = frm.doc.image;
	const icon_field = frm.get_field("image");

	if (!icon_field) return;

	// Remove existing preview if any
	const existing_preview = document.querySelector(".icon-preview-container");
	if (existing_preview) {
		existing_preview.remove();
	}

	// Create icon preview container
	const preview_html = `
		<div class="icon-preview-container" style="margin-top: 10px; padding: 15px; background-color: #f8f9fa; border-radius: 6px; display: flex; align-items: center; gap: 15px;">
			<div class="icon-display" style="font-size: 48px; color: #5e72e4; min-width: 60px; text-align: center;">
				${icon_value ? `<i class="fas ${icon_value}"></i>` : '<i class="fas fa-image" style="color: #ccc;"></i>'}
			</div>
			<div class="icon-info">
				<div style="font-weight: 600; color: #2c3e50;">${icon_value || "No icon selected"}</div>
				<div style="font-size: 12px; color: #7f8c8d; margin-top: 4px;">Font Awesome Free Icon</div>
			</div>
		</div>
	`;

	// Insert preview after the icon field
	const icon_field_wrapper = icon_field.$wrapper;
	icon_field_wrapper.insertAdjacentHTML("afterend", preview_html);
}
