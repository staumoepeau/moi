

import frappe
from frappe.model.document import Document

@frappe.whitelist()
def add_employee_role(employee, role, branch, department, acting_start_date, acting_end_date):
    emp = frappe.get_doc("Employee", employee)

    # ✅ Add role if not already assigned
    user_id = emp.user_id
    if user_id and not frappe.db.exists("Has Role", {"parent": user_id, "role": role}):
        user_doc = frappe.get_doc("User", user_id)
        user_doc.append("roles", {"role": role})
        user_doc.save(ignore_permissions=True)

    # ✅ Check if internal_work_history row already exists
    exists = False
    for row in emp.internal_work_history:
        if (
            row.branch == branch and
            row.department == department and
            row.designation == role and
            row.custom_type == "Acting" and
            str(row.from_date) == str(acting_start_date) and
            str(row.to_date) == str(acting_end_date) and
            row.custom_status == "Active"
        ):
            exists = True
            break

    # ✅ Append only if not already added
    if not exists:
        emp.append("internal_work_history", {
            "branch": branch,
            "department": department,
            "designation": role,
            "custom_type": "Acting",
            "from_date": acting_start_date,
            "to_date": acting_end_date,
            "custom_status": "Active"
            
        })

    # ✅ Set acting info
    emp.custom_acting = 1

    emp.save(ignore_permissions=True)



@frappe.whitelist()
def remove_employee_role(employee, role=None):
    """Remove the active acting role from the linked User,
    mark it as Expired in internal_work_history,
    and clear acting flags on Employee."""

    emp = frappe.get_doc("Employee", employee)
    user_id = emp.user_id

    # ── Find the active acting designation if role not given ─────────────
    active_rows = [
        row for row in emp.get("internal_work_history", [])
        if (getattr(row, "custom_status", None) or "").lower() == "active"
    ]

    if not role:
        role = active_rows[-1].designation if active_rows else None

    if not role:
        frappe.msgprint(f"No active acting role found for {emp.name}.")
        return {"removed": 0, "role": None}

    # ── Remove that role from the linked User ────────────────────────────
    removed = 0
    if user_id and frappe.db.exists("User", user_id):
        user_doc = frappe.get_doc("User", user_id)
        before = len(user_doc.roles)
        user_doc.roles = [r for r in user_doc.roles if r.role != role]
        user_doc.save(ignore_permissions=True)
        removed = before - len(user_doc.roles)

    # ── Mark matching internal_work_history as Expired ───────────────────
    for row in active_rows:
        if row.designation == role:
            row.custom_status = "Expired"

    # ── Clear acting flags on Employee ───────────────────────────────────
    emp.custom_acting = 0
    emp.save(ignore_permissions=True)

    frappe.msgprint(f"✅ Acting role '{role}' removed and marked Expired for {emp.employee_name or emp.name} (User: {user_id})")
    return {"removed": removed, "role": role}
