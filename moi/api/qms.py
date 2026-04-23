# Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
# For license information, please see license.txt


import frappe
from frappe.utils import now_datetime

@frappe.whitelist(allow_guest=True)
def preview_ticket(service_name):
    """
    Preview the NEXT ticket number without saving to database.
    Used when user selects a service - shows them the ticket number.
    The ticket is only saved when they actually print.
    """
    # Get the LAST ticket in the entire system (highest number)
    last_ticket = frappe.get_all(
        "QMS Ticket",
        fields=["name"],
        order_by="name desc",
        limit=1
    )

    if last_ticket:
        last_name = last_ticket[0].name
        # Extract the number from the ticket name
        # e.g., "QMS-TKEN-2024-260411030" -> "260411030"
        try:
            full_number_str = last_name.split("-")[-1]
            last_number = int(full_number_str)
            next_number = last_number + 1
            # Format with same digit count as original
            full_number = str(next_number).zfill(len(full_number_str))
        except (ValueError, IndexError):
            next_number = 1
            full_number = "000000001"
    else:
        next_number = 1
        full_number = "000000001"

    # Get ONLY the last 3 digits with zero-padding
    # e.g., "260411031" -> "031", "000000001" -> "001"
    last_three = str(next_number)[-3:].zfill(3)

    return {
        "predicted_name": f"QMS-TKEN-2024-{full_number}",
        "display_number": last_three  # e.g., "031" (ONLY last 3 digits with zero-padding)
    }


@frappe.whitelist(allow_guest=True)
def create_ticket(service_name, customer_type=None, payment_method=None):
    """
    Create and save a ticket to the database.
    This is called ONLY when the user actually prints the ticket.
    If user closes without printing, this is never called.
    Automatically assigns a counter if one is configured for the service AND
    the counter's capabilities match the customer type and payment method.
    """
    # Get default counter from service if configured
    default_counter = frappe.db.get_value("QMS Service", service_name, "default_counter")
    assigned_counter = None

    # Validate counter capabilities match customer type and payment method
    if default_counter:
        counter_doc = frappe.get_doc("QMS Counter", default_counter)

        # Check if counter accepts this customer type
        can_serve_customer = False
        if customer_type == "Individual" and counter_doc.accept_individual:
            can_serve_customer = True
        elif customer_type == "Business" and counter_doc.accept_business:
            can_serve_customer = True

        # Check if counter accepts this payment method
        can_accept_payment = False
        if payment_method == "Cash" and counter_doc.accept_cash:
            can_accept_payment = True
        elif payment_method == "Cheque" and counter_doc.accept_cheque:
            can_accept_payment = True

        # Only assign if both conditions are met
        if can_serve_customer and can_accept_payment:
            assigned_counter = default_counter

    doc = frappe.get_doc({
        "doctype": "QMS Ticket",
        "service_requested": service_name,
        "customer_type": customer_type,
        "payment_method": payment_method,
        "counter": assigned_counter,  # Only assign if capabilities match
        "status": "Waiting"
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()  # Ensure it's committed to DB
    return doc.name


@frappe.whitelist()
def call_next_ticket(counter_number, officer):
    """Calls the next customer in the queue by serial number (FIFO).

    Rate limiting: minimum 10 seconds between consecutive calls to prevent race conditions.
    """
    from frappe.utils import get_datetime

    # Find the internal Record Name (ID) using the Counter Number field
    counter_record_name = frappe.db.get_value("QMS Counter",
        {"counter_number": counter_number}, "name")

    if not counter_record_name:
        frappe.throw(f"Counter Number {counter_number} is not configured in the system.")

    # 1. Check if the last ticket was called less than 10 seconds ago (rate limiter)
    last_called = frappe.get_all("QMS Ticket",
        filters={"status": ["in", ["Called", "Serving", "Completed"]]},
        fields=["called_at"],
        order_by="called_at desc",
        limit=1
    )

    if last_called and last_called[0].called_at:
        last_call_time = get_datetime(last_called[0].called_at)
        current_time = now_datetime()
        seconds_elapsed = (current_time - last_call_time).total_seconds()

        if seconds_elapsed < 10:
            wait_time = int(10 - seconds_elapsed)
            frappe.throw(f"Please wait {wait_time} second(s) before calling the next customer (minimum 10 second gap).")

    # 2. Get the oldest waiting ticket (FIFO by creation time)
    ticket = frappe.get_all("QMS Ticket",
        filters={"status": "Waiting"},
        fields=["name"],
        order_by="creation asc",
        limit=1
    )

    if not ticket:
        frappe.throw("No customers waiting in queue.")

    # 3. Update the ticket and assign to counter
    doc = frappe.get_doc("QMS Ticket", ticket[0].name)
    doc.status = "Called"
    doc.counter = counter_record_name
    doc.called_at = now_datetime()
    doc.officer = officer
    doc.save(ignore_permissions=True)

    frappe.db.commit()

    # 4. Notify Public Display
    frappe.publish_realtime("ticket_called", {
        "ticket_id": doc.name,
        "counter_number": counter_number
    })

    return doc.name

@frappe.whitelist()
def complete_service(ticket_id, customer_name, customer_id, payment_method=None):
    """Saves final details and completes the ticket."""
    doc = frappe.get_doc("QMS Ticket", ticket_id)
    doc.customer_name = customer_name
    doc.customer_id = customer_id
    doc.officer = frappe.session.user
    doc.status = "Completed"
    doc.completed_at = now_datetime()
    if payment_method:
        doc.payment_method = payment_method
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    # Notify display of status update
    frappe.publish_realtime("qms_update", {
        "ticket_id": ticket_id,
        "status": "Completed",
        "payment_method": payment_method
    })
    return "Success"


@frappe.whitelist()
def complete_with_recall(ticket_id, customer_name, customer_id, recall_reason):
    """Completes the ticket and marks it for recall with a reason."""
    doc = frappe.get_doc("QMS Ticket", ticket_id)
    doc.customer_name = customer_name
    doc.customer_id = customer_id
    doc.officer = frappe.session.user
    doc.status = "Completed"
    doc.completed_at = now_datetime()
    doc.marked_for_recall = 1
    doc.recall_reason = recall_reason
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    # Notify display of status update
    frappe.publish_realtime("qms_update", {
        "ticket_id": ticket_id,
        "status": "Completed"
    })
    return "ok"


@frappe.whitelist()
def close_recall(ticket_id):
    """Closes a recall by clearing the marked_for_recall flag."""
    doc = frappe.get_doc("QMS Ticket", ticket_id)
    doc.marked_for_recall = 0
    doc.recall_reason = ""
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return "ok"



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
    frappe.logger().info(f"[QMS API] update_counter_status called: counter={counter_number}, status={status}")

    # Update the QMS Counter status field (this will trigger after_update hook for real-time sync)
    try:
        counter_doc = frappe.get_doc("QMS Counter", counter_number)
        frappe.logger().info(f"[QMS API] Loaded counter: {counter_number}, old_status={counter_doc.status}")

        counter_doc.status = status
        counter_doc.save(ignore_permissions=True)

        frappe.logger().info(f"[QMS API] Saved counter: {counter_number}, new_status={counter_doc.status}")
    except Exception as e:
        frappe.logger().error(f"[QMS API] Error updating counter: {str(e)}")
        raise

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
    """Re-emits the ticket_called realtime event and saves a recall history entry."""
    doc = frappe.get_doc("QMS Ticket", ticket_id)
    doc.append("recall_history", {
        "recalled_at": now_datetime(),
        "recalled_by": officer,
        "recall_note": doc.recall_reason or "",
    })
    doc.save(ignore_permissions=True)
    frappe.db.commit()

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

    # Notify display of status update
    frappe.publish_realtime("qms_update", {
        "ticket_id": ticket_id,
        "status": "No Show"
    })
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

@frappe.whitelist()
def get_completed_tickets(counter_number, limit=5):
    """Returns recent completed+marked-for-recall tickets for this officer at this counter."""
    officer = frappe.session.user
    counter_id = frappe.db.get_value("QMS Counter", {"counter_number": counter_number}, "name")
    if not counter_id:
        return []
    tickets = frappe.get_all(
        "QMS Ticket",
        filters={"counter": counter_id, "officer": officer, "status": "Completed", "marked_for_recall": 1},
        fields=["name", "customer_name", "customer_id", "service_requested", "completed_at", "recall_reason"],
        order_by="completed_at desc",
        limit=int(limit)
    )
    for t in tickets:
        t["recall_count"] = frappe.db.count("QMS Ticket Recall", {"parent": t["name"]})
    return tickets


@frappe.whitelist(allow_guest=True)
def get_marked_for_recall(limit=10):
    """Returns all tickets currently marked for recall (for display screen)."""
    tickets = frappe.get_all(
        "QMS Ticket",
        filters={"status": "Completed", "marked_for_recall": 1},
        fields=["name", "customer_name", "service_requested", "recall_reason", "counter", "completed_at"],
        order_by="completed_at desc",
        limit=int(limit)
    )
    # Add counter number for display
    for t in tickets:
        if t.counter:
            counter_num = frappe.db.get_value("QMS Counter", t.counter, "counter_number")
            t["counter_number"] = counter_num or t.counter
    return tickets


@frappe.whitelist()
def reset_stuck_tickets():
    """Resets tickets stuck in 'Called' status.

    For tickets older than 5 minutes: marks as 'No Show'
    For newer tickets: resets back to 'Waiting'

    This handles cases where:
    - A console crashed/closed while calling a ticket
    - A ticket was abandoned by an officer
    - Network issues left a ticket in limbo

    Returns the count of tickets reset.
    """
    from frappe.utils import get_datetime, now_datetime
    import json

    stuck_tickets = frappe.get_all("QMS Ticket",
        filters={"status": "Called"},
        fields=["name", "called_at", "officer", "counter"])

    if not stuck_tickets:
        return {"message": "No stuck tickets found", "count": 0}

    count = 0
    current_time = now_datetime()
    five_minutes_ago = current_time - frappe.utils.timedelta(minutes=5)

    for ticket in stuck_tickets:
        doc = frappe.get_doc("QMS Ticket", ticket.name)
        called_at = get_datetime(ticket.called_at)

        # If called more than 5 minutes ago, mark as No Show
        if called_at < five_minutes_ago:
            doc.status = "No Show"
            doc.no_show_at = now_datetime()
        else:
            # Recent calls: reset back to Waiting
            doc.status = "Waiting"
            doc.called_at = None

        doc.counter = None
        doc.officer = None
        doc.save(ignore_permissions=True)
        count += 1

    frappe.db.commit()

    frappe.publish_realtime("ticket_reset", {
        "count": count,
        "message": f"Reset {count} stuck ticket(s)"
    })

    return {"message": f"Reset {count} stuck ticket(s). Old tickets marked as No Show, recent ones returned to queue.", "count": count}