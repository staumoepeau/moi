# Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class QMSCounter(Document):
	def after_insert(self):
		"""Broadcast counter status update when counter is created"""
		frappe.logger().info(f"[QMSCounter] after_insert hook called for {self.name}")
		self.broadcast_counter_status_update()

	def after_update(self):
		"""Broadcast counter status update when counter is modified"""
		frappe.logger().info(f"[QMSCounter] after_update hook called for {self.name}, status={self.status}")
		self.broadcast_counter_status_update()

	def broadcast_counter_status_update(self):
		"""Send real-time event to all connected clients"""
		frappe.logger().info(f"[QMSCounter] Broadcasting counter status: {self.name} = {self.status}")
		try:
			frappe.publish_realtime(
				"counter_status_updated",
				{
					"counter": self.name,
					"status": self.status,
				},
				after_commit=False
			)
			frappe.logger().info(f"[QMSCounter] Event published successfully for counter {self.name}")
		except Exception as e:
			frappe.logger().error(f"[QMSCounter] Failed to publish event: {str(e)}")