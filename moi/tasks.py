# Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import now_datetime, get_datetime
from datetime import datetime, timedelta


@frappe.whitelist()
def cleanup_uncalled_tickets():
	"""
	Cleanup uncalled tickets (status="Waiting") from the previous day at 11:50 PM.
	This ensures the next day's ticket numbering starts fresh from 001.

	Runs every minute, but only executes at 11:50 PM (23:50).
	"""

	# Get current time
	current_time = now_datetime()
	current_hour = current_time.hour
	current_minute = current_time.minute

	# Only run at 11:50 PM (23:50)
	if not (current_hour == 23 and current_minute == 50):
		return

	# Check if cleanup already ran today (store in system settings)
	last_cleanup_date = frappe.db.get_single_value("System Settings", "qms_last_cleanup_date")
	today_str = datetime.now().strftime("%Y-%m-%d")

	# If cleanup already ran today, skip
	if last_cleanup_date and str(last_cleanup_date) == today_str:
		frappe.logger().info("[QMS Cleanup] Already cleaned up today")
		return

	try:
		# Get yesterday's date
		yesterday = datetime.now() - timedelta(days=1)
		yesterday_start = get_datetime(f"{yesterday.strftime('%Y-%m-%d')} 00:00:00")
		yesterday_end = get_datetime(f"{yesterday.strftime('%Y-%m-%d')} 23:59:59")

		# Find uncalled tickets from yesterday (status = "Waiting")
		uncalled_tickets = frappe.db.get_list(
			"QMS Ticket",
			filters=[
				["QMS Ticket", "status", "=", "Waiting"],
				["QMS Ticket", "creation", ">=", yesterday_start],
				["QMS Ticket", "creation", "<=", yesterday_end],
			],
			fields=["name"],
		)

		if not uncalled_tickets:
			frappe.logger().info("[QMS Cleanup] No uncalled tickets to cleanup")
		else:
			frappe.logger().info(f"[QMS Cleanup] Found {len(uncalled_tickets)} uncalled tickets from yesterday")

			# Delete uncalled tickets
			for ticket in uncalled_tickets:
				try:
					frappe.delete_doc("QMS Ticket", ticket.name, ignore_permissions=True)
				except Exception as e:
					frappe.logger().error(f"[QMS Cleanup] Error deleting ticket {ticket.name}: {str(e)}")

			frappe.db.commit()
			frappe.logger().info(f"[QMS Cleanup] Successfully cleaned up {len(uncalled_tickets)} uncalled tickets")

		# Update system settings to mark cleanup as done for today
		frappe.db.set_value("System Settings", "System Settings", "qms_last_cleanup_date", today_str)
		frappe.db.commit()

		frappe.logger().info("[QMS Cleanup] Maintenance completed successfully at 23:50")

	except Exception as e:
		frappe.logger().error(f"[QMS Cleanup] Error during cleanup: {str(e)}")
