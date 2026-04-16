# Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
# For license information, please see license.txt

import frappe
from frappe import Page


@frappe.whitelist()
def get_active_services():
	"""Get list of active QMS services"""
	services = frappe.get_list("QMS Service", {
		"filters": {"is_active": 1},
		"fields": ["name", "image", "background_color", "avg_time"],
		"order_by": "service_name asc"
	})
	return services
