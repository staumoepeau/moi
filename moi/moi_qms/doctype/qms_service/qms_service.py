# Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname


class QMSService(Document):
	
	def validate(self):
		# Set the service code using the autoname logic
		self.service_code = make_autoname("S.###", doc=self)	
