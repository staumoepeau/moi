import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

def add_custom_statuses_to_leave_application():
    new_statuses = ["Endorse", "Pending"]

    # Try to find existing property setter for the 'status' field
    property_setter = frappe.db.get_value(
        "Property Setter",
        filters={
            "doc_type": "Leave Application",
            "field_name": "status",
            "property": "options",
        },
    )

    if property_setter:
        property_setter_doc = frappe.get_doc("Property Setter", property_setter)
        current_options = property_setter_doc.value or ""
        options_list = current_options.split("\n")

        for status in new_statuses:
            if status not in options_list:
                options_list.append(status)

        property_setter_doc.value = "\n".join(options_list)
        property_setter_doc.save()

    else:
        # If no property setter exists, modify options using make_property_setter
        meta = frappe.get_meta("Leave Application")
        field = meta.get_field("status")
        current_options = field.options or ""
        options_list = current_options.split("\n")

        for status in new_statuses:
            if status not in options_list:
                options_list.append(status)

        make_property_setter(
            "Leave Application",
            "status",
            "options",
            "\n".join(options_list),
            "Text",
            validate_fields_for_doctype=False,
        )

def add_custom_statuses_to_employee():
    new_statuses = ["Vacant", "Abolish"]

    # Try to find existing property setter for the 'status' field
    property_setter = frappe.db.get_value(
        "Property Setter",
        filters={
            "doc_type": "Employee",
            "field_name": "status",
            "property": "options",
        },
    )

    if property_setter:
        property_setter_doc = frappe.get_doc("Property Setter", property_setter)
        current_options = property_setter_doc.value or ""
        options_list = current_options.split("\n")

        for status in new_statuses:
            if status not in options_list:
                options_list.append(status)

        property_setter_doc.value = "\n".join(options_list)
        property_setter_doc.save()

    else:
        # If no property setter exists, modify options using make_property_setter
        meta = frappe.get_meta("Employee")
        field = meta.get_field("status")
        current_options = field.options or ""
        options_list = current_options.split("\n")

        for status in new_statuses:
            if status not in options_list:
                options_list.append(status)

        make_property_setter(
            "Employee",
            "status",
            "options",
            "\n".join(options_list),
            "Text",
            validate_fields_for_doctype=False,
        )

def add_custom_statuses_to_attendance():
    new_statuses = ["Work Travel Overseas", "Work Travel Local"]


    # Try to find existing property setter for the 'status' field
    property_setter = frappe.db.get_value(
        "Property Setter",
        filters={
            "doc_type": "Attendance",
            "field_name": "status",
            "property": "options",
        },
    )

    if property_setter:
        property_setter_doc = frappe.get_doc("Property Setter", property_setter)
        current_options = property_setter_doc.value or ""
        options_list = current_options.split("\n")

        for status in new_statuses:
            if status not in options_list:
                options_list.append(status)

        property_setter_doc.value = "\n".join(options_list)
        property_setter_doc.save()

    else:
        # If no property setter exists, modify options using make_property_setter
        meta = frappe.get_meta("Attendance")
        field = meta.get_field("status")
        current_options = field.options or ""
        options_list = current_options.split("\n")

        for status in new_statuses:
            if status not in options_list:
                options_list.append(status)

        make_property_setter(
            "Attendance",
            "status",
            "options",
            "\n".join(options_list),
            "Text",
            validate_fields_for_doctype=False,
        )


def leave_status():
	add_custom_statuses_to_leave_application()
	

def employee_status():
	add_custom_statuses_to_employee()

def attendance_status():
    add_custom_statuses_to_attendance()

