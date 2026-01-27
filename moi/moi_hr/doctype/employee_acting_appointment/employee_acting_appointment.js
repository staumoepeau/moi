// Copyright (c) 2025, Sione Taumoepeau and contributors
// For license information, please see license.txt

frappe.ui.form.on("Employee Acting Appointment", {
    on_submit: function(frm) {

        frappe.call({
            method: "hr.api.employee.add_employee_role",
            args: {
                employee: frm.doc.employee,  // use linked employee, not current doc name
                role: frm.doc.acting_role,
                branch: frm.doc.location,
                department: frm.doc.department,
                acting_start_date: frm.doc.acting_start_date,
                acting_end_date: frm.doc.acting_end_date
            },
            callback: function(r) {
                if (!r.exc) {
                    frappe.msgprint(__("✅ Acting role assigned successfully."));
                    frm.reload_doc();
                }
            }
        });
    }
});
