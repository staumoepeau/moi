// Copyright (c) 2026, Sione & Finau Hoi Taumoepeau and TMP TECHNOLOGY and contributors
// For license information, please see license.txt


frappe.ui.form.on('MOI QMS Department', {
    refresh: function(frm) {
        // 1. Initial fetch when form loads
        render_queue_container(frm);
        fetchQueueList(frm);

        // 2. Real-time listener
        // We use frappe.realtime.on to listen for updates from the backend
        frappe.realtime.on("queue_update", function(data) {
            if (data.department === frm.doc.name) {
                fetchQueueList(frm);
            }
        });
    },
    unload: function(frm) {
        // Best practice: remove listener when leaving the form
        frappe.realtime.off("queue_update");
    }
});

// Function to inject the base HTML structure into the form
function render_queue_container(frm) {
    let html_content = `
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
        <div class="container mt-2">
            <table class="table table-bordered table-hover shadow-sm">
                <thead class="table-dark text-center">
                    <tr>
                        <th>Ticket #</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="queue-table-body">
                    <tr><td colspan="4" class="text-center">Loading queue...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    // Set the HTML into a field named 'queue_html' (Create this in DocType)
    $(frm.fields_dict.queue_html.wrapper).html(html_content);
}

function fetchQueueList(frm) {
    frappe.call({
        method: "qms.queue_management_system.doctype.queue.queue.get_queue_list",
        args: { department: frm.doc.name },
        callback: function(r) {
            const container = $(frm.fields_dict.queue_html.wrapper).find("#queue-table-body");
            if (r.message && r.message.length > 0) {
                let rows = r.message.map(q => `
                    <tr>
                        <td class="text-center fw-bold">${q.ticket_number}</td>
                        <td class="text-center"><span class="badge border p-1">${q.priority}</span></td>
                        <td class="text-center">${q.status}</td>
                        <td class="text-center">${getActionButtons(q.name, q.status)}</td>
                    </tr>
                `).join("");
                container.html(rows);
            } else {
                container.html('<tr><td colspan="4" class="text-center text-muted">No active tickets</td></tr>');
            }
        }
    });
}

function getActionButtons(ticket_id, status) {
    const actions = {
        "waiting":      [{ n: "call", i: "fa-phone", c: "btn-outline-primary" }],
        "called":       [{ n: "start", i: "fa-play", c: "btn-outline-info" }, { n: "skip", i: "fa-forward", c: "btn-outline-warning" }],
        "being served": [{ n: "complete", i: "fa-check", c: "btn-outline-success" }]
    };

    return (actions[status.toLowerCase()] || []).map(b => `
        <button class="btn ${b.c} btn-sm" onclick="handleQueueAction('${b.n}', '${ticket_id}')">
            <i class="fa ${b.i}"></i>
        </button>
    `).join("");
}

// Global function so onclick can find it
window.handleQueueAction = function(action, ticket_id) {
    frappe.call({
        method: "qms.queue_management_system.doctype.queue.queue.handle_action",
        args: { action: action, ticket_number: ticket_id },
        callback: function() {
            frappe.show_alert({message: __("Action executed"), indicator: 'green'});
        }
    });
};