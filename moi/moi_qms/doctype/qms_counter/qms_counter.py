# Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class QMSCounter(Document):

    def validate(self):
        if self.status == "Open" and self.officer:
            # Check if this officer is already signed into another counter
            other_counter = frappe.db.exists("QMS Counter", {
                "officer": self.officer,
                "name": ["!=", self.name],
                "status": "Open"
            })
            if other_counter:
                frappe.throw(f"You are already active on Counter {other_counter}")