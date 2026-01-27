# Copyright (c) 2025, Sione Taumoepeau and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate
from hrms.hr.utils import update_employee_work_history


class EmployeeActingAppointment(Document):

	def validate(self):
		if not self.acting_start_date or not self.acting_end_date:
			frappe.throw(_("Both Acting Start Date and Acting End Date are required."))

		start_date = getdate(self.acting_start_date)
		end_date = getdate(self.acting_end_date)
		today = getdate(nowdate())

		if start_date > end_date:
			frappe.throw(_("Acting End Date cannot be earlier than Acting Start Date."))

		if end_date < today:
			frappe.msgprint(_("Warning: Acting End Date is already in the past."))


