# Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
# For license information, please see license.txt


import frappe
from frappe.utils import now_datetime

@frappe.whitelist(allow_guest=True)
def create_ticket(service_name):
    doc = frappe.get_doc({
        "doctype": "QMS Ticket",
        "service_requested": service_name, # This must match the name of the 'QMS Service' record
        "status": "Waiting"
    })
    doc.insert(ignore_permissions=True)
    return doc.name


@frappe.whitelist()
def call_next_ticket(status, service, counter_number, officer):
    """Finds the oldest waiting ticket and assigns it to a counter by its number."""
    
    # 1. Find the internal Record Name (ID) using the Counter Number field
    # This allows Counter Number '04' to link to record 'QMS-C.100'
    counter_record_name = frappe.db.get_value("QMS Counter", 
        {"counter_number": counter_number}, "name")

    if not counter_record_name:
        frappe.throw(f"Counter Number {counter_number} is not configured in the system.")

    # 2. Get the oldest ticket with 'Waiting' status
    ticket = frappe.get_all("QMS Ticket", 
        filters={"status": status, "service_requested": service}, 
        fields=["name"], 
        order_by="creation asc", 
        limit=1
    )
    
    if not ticket:
        frappe.throw("No customers waiting in queue.")

    # 3. Update the ticket
    doc = frappe.get_doc("QMS Ticket", ticket[0].name)
    doc.status = "Called"
    doc.counter = counter_record_name  # Links to the actual DB ID (e.g., QMS-C.100)
    doc.called_at = now_datetime()
    doc.officer = officer
    doc.save(ignore_permissions=True)
    
    frappe.db.commit() 
    
    # 4. Notify Public Display
    frappe.publish_realtime("ticket_called", {
        "ticket_id": doc.name,
        "counter_number": counter_number # TV shows the physical number '04'
    })

    return doc.name

@frappe.whitelist()
def complete_service(ticket_id, customer_name, customer_id):
    """Saves final details and completes the ticket."""
    doc = frappe.get_doc("QMS Ticket", ticket_id)
    doc.customer_name = customer_name
    doc.customer_id = customer_id
    doc.officer = frappe.session.user
    doc.status = "Completed"
    doc.completed_at = now_datetime()
    doc.save(ignore_permissions=True)
    return "Success"



@frappe.whitelist()
def get_active_ticket(counter_id):
    """Checks if the counter already has a ticket with status 'Called' or 'Serving'."""
    ticket = frappe.get_all("QMS Ticket", 
        filters={"counter": counter_id, "status": ["in", ["Called", "Serving"]]},
        fields=["name", "status", "customer_name", "customer_id", "service_requested"],
        limit=1
    )
    return ticket[0] if ticket else None



@frappe.whitelist()
def check_in_to_counter(counter_number):
    user = frappe.session.user
    
    # 1. Check if the counter is already taken by someone else
    existing_officer = frappe.db.get_value("QMS Counter", 
        {"counter_number": counter_number, "status": "Open"}, "officer")
    
    if existing_officer and existing_officer != user:
        frappe.throw(f"Counter {counter_number} is already being used by {existing_officer}")

    # 2. Update the counter status and assign the officer
    # We find the internal ID first since you mentioned IDs like QMS-C.100
    counter_id = frappe.db.get_value("QMS Counter", {"counter_number": counter_number}, "name")
    
    doc = frappe.get_doc("QMS Counter", counter_id)
    doc.status = "Open"
    doc.officer = user
    doc.save(ignore_permissions=True)
    
    return "Success"


import frappe
from frappe.utils import now_datetime

@frappe.whitelist()
def update_counter_status(counter_number, status, service, officer):
    """
    Updates QMS Counter status and logs session in QMS Counter Details
    """
    # 1. We don't have a status field in QMS Counter based on your JSON, 
    # but we can track the live status in the session logs.
    
    if status == "Open":
        # Create a new session record
        new_log = frappe.get_doc({
            "doctype": "QMS Counter Details",
            "counter_number": counter_number,
            "service": service,
            "officer": officer,
            "status": "Open",
            "opening_time": now_datetime()
        })
        new_log.insert(ignore_permissions=True)
        frappe.db.commit()
        return new_log.name

    elif status in ["Closed", "Break"]:
        # Find the currently open session for this specific counter and officer
        # We look for the most recent record where closing_time is NOT set
        active_session = frappe.get_all("QMS Counter Details", 
            filters={
                "counter_number": counter_number,
                "officer": officer,
                "status": "Open",
                "closing_time": ["is", "not set"]
            },
            order_by="creation desc",
            limit=1
        )

        if active_session:
            frappe.db.set_value("QMS Counter Details", active_session[0].name, {
                "status": status,
                "closing_time": now_datetime()
            })
            frappe.db.commit()
            return active_session[0].name

    return True

@frappe.whitelist()
def recall_ticket(ticket_id, counter_number, officer):
    """Re-emits the ticket_called realtime event so the display screen announces again."""
    frappe.publish_realtime(
        "ticket_recalled",
        {
            "ticket_id": ticket_id,
            "counter_number": counter_number,
        },
        after_commit=False
    )
    return "ok"

@frappe.whitelist()
def no_show(ticket_id, officer, counter_number):
    """Marks the ticket as No Show and frees the counter."""
    ticket = frappe.get_doc("QMS Ticket", ticket_id)
    ticket.status = "No Show"
    ticket.officer = officer
    ticket.no_show_at = frappe.utils.now()
    ticket.save(ignore_permissions=True)
    frappe.db.commit()
    return "ok"



@frappe.whitelist(allow_guest=True)
def submit_feedback(ticket_id, rating, comment=""):
    """
    Creates a QMS Feedback document linked to the ticket.
    Requires a DocType called 'QMS Feedback' with fields:
      - ticket        (Link -> QMS Ticket)
      - rating        (Int)
      - comment       (Text)
      - service       (Link -> QMS Service, fetched from ticket)
      - submitted_at  (Datetime)
    """
    ticket = frappe.get_doc("QMS Ticket", ticket_id)

    # Guard: only allow feedback on completed tickets
    if ticket.status != "Completed":
        frappe.throw("Feedback can only be submitted for completed tickets.")

    # Guard: prevent duplicate feedback
    existing = frappe.db.exists("QMS Feedback", {"ticket": ticket_id})
    if existing:
        frappe.throw("Feedback has already been submitted for this ticket.")

    feedback = frappe.get_doc({
        "doctype": "QMS Feedback",
        "ticket": ticket_id,
        "rating": int(rating),
        "comment": comment,
        "service": ticket.service_requested,
        "submitted_at": frappe.utils.now(),
    })
    feedback.insert(ignore_permissions=True)
    frappe.db.commit()
    return "ok"