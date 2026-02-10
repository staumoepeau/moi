# Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import now_datetime
from frappe.model.document import Document


# class QMSTicket(Document):
# 	pass


class QMSTicket(frappe.model.document.Document):
	
	def before_insert(self):		
			# Also set the initial waiting timestamp
			if not self.waiting_since:
				self.waiting_since = frappe.utils.now_datetime()
			
	def on_update(self):
		# 2. Capture when the officer actually starts the call
		if self.status == "Called" and not self.called_at:
			self.called_at = now_datetime()
			
		# 3. Capture completion and clean up
		if self.status == "Completed" and not self.completed_at:
			self.completed_at = now_datetime()