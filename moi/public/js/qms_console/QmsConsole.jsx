import * as React from "react";

export function QmsConsole() {
  const currentUser = frappe.session.user;
  const currentUserName = frappe.boot.user_info[currentUser]?.fullname || currentUser;

  const [activeTicket, setActiveTicket] = React.useState(null);
  const [counter, setCounter] = React.useState(localStorage.getItem("qms_counter") || "");
  const [service, setService] = React.useState(localStorage.getItem("qms_service") || "");
  const [status, setStatus] = React.useState(localStorage.getItem("qms_status") || "Closed"); // New Status State
  const [countersList, setCountersList] = React.useState([]); 
  const [servicesList, setServicesList] = React.useState([]); 
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const counterRes = await frappe.db.get_list("QMS Counter", {
          fields: ["counter_number"],
          order_by: "counter_number asc"
        });
        setCountersList(counterRes.map(c => c.counter_number).filter(Boolean));

        const serviceRes = await frappe.db.get_list("QMS Service", {
          fields: ["name"],
          filters: { is_active: 1 }, 
          order_by: "name asc"
        });
        setServicesList(serviceRes.map(s => s.name));
      } catch (e) {
        console.error("Failed to fetch data:", e);
      }
    };
    fetchData();
  }, []);

  const ConsoleStyles = `
    header.navbar, .navbar, .page-sidebar, .page-head, .body-sidebar-container { display: none !important; }
    .layout-main-section-wrapper, .page-container { padding: 0 !important; margin: 0 !important; }
    .layout-main-section { max-width: 100vw !important; }
    .officer-screen { width: 100vw; height: 100vh; background: #f4f7f9; font-family: sans-serif; display: flex; flex-direction: column; }
    .top-bar { background: #ccd1d8; color: black; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .main-content { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .card { background: white; border-radius: 1.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.1); padding: 3rem; width: 100%; max-width: 600px; text-align: center; }
    .btn-call { background: #2b6cb0; color: white; font-size: 2rem; font-weight: bold; padding: 2rem 4rem; border: none; border-radius: 1rem; cursor: pointer; }
    .input-group { text-align: left; margin-bottom: 1.5rem; }
    .input-field { width: 100%; padding: 1rem; border: 2px solid #e2e8f0; border-radius: 0.5rem; font-size: 1.2rem; margin-top: 0.5rem; }
    .btn-complete { background: #38a169; color: white; width: 100%; padding: 1.2rem; border: none; border-radius: 0.5rem; font-size: 1.5rem; font-weight: bold; cursor: pointer; }
    select.input-field-small { color: black; padding: 4px; border-radius: 4px; min-width: 100px; border: 1px solid #cbd5e0; cursor: pointer; }
    .top-bar-controls { display: flex; gap: 15px; align-items: center; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
    .status-open { background: #c6f6d5; color: #22543d; }
    .status-break { background: #fefcbf; color: #744210; }
    .status-closed { background: #fed7d7; color: #822727; }
  `;

  // Update Status Logic
  const handleStatusChange = async (newStatus) => {
    if (!counter) return frappe.msgprint("Please select a Counter first");
    
    setLoading(true);
    try {
      await frappe.call({
        method: "moi.api.qms.update_counter_status",
        args: {
          counter_number: counter,
          status: newStatus,
          officer: currentUser
        }
      });
      setStatus(newStatus);
      localStorage.setItem("qms_status", newStatus);
      frappe.show_alert({ message: `Counter is now ${newStatus}`, indicator: newStatus === "Open" ? "green" : "orange" });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCounterChange = async (selectedNumber) => {
    if (!selectedNumber) {
        setCounter("");
        localStorage.removeItem("qms_counter");
        return;
    }
    setCounter(selectedNumber);
    localStorage.setItem("qms_counter", selectedNumber);
  };

  const handleServiceChange = (selectedService) => {
    setService(selectedService);
    if (selectedService) localStorage.setItem("qms_service", selectedService);
    else localStorage.removeItem("qms_service");
  };

  const handleCallNext = async () => {
    if (status !== "Open") return frappe.msgprint("Counter must be OPEN to call customers");
    if (!counter || !service) return frappe.msgprint("Select Counter and Service");
    
    setLoading(true);
    try {
      const res = await frappe.call({
        method: "moi.api.qms.call_next_ticket",
        args: {
          status: "Waiting",
          counter_number: counter,
          service: service,
          officer: currentUser
        }
      });

      if (res.message) {
        const ticketDetail = await frappe.db.get_doc("QMS Ticket", res.message);
        setActiveTicket(ticketDetail);
      } else {
        frappe.msgprint("No customers in queue for this service");
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleComplete = async () => {
    if (!activeTicket.customer_id || !activeTicket.customer_name) {
      return frappe.msgprint("Please enter ID and Name");
    }
    setLoading(true);
    try {
      await frappe.call({
        method: "moi.api.qms.complete_service",
        args: {
          ticket_id: activeTicket.name,
          customer_name: activeTicket.customer_name,
          customer_id: activeTicket.customer_id,
          officer: currentUser
        }
      });
      setActiveTicket(null);
      frappe.show_alert({ message: "Service Completed", indicator: "green" });
    } finally { setLoading(false); }
  };

  return (
    <div className="officer-screen">
      <style>{ConsoleStyles}</style>
      
      <div className="top-bar">
        <div>
          <h3 style={{ margin: 0 }}>Ministry of Infrastructure</h3>
          <div className="user-info">Officer: <strong>{currentUserName}</strong></div>
        </div>
        
        <div className="top-bar-controls">
          {/* Status Dropdown */}
          <div>
            <label style={{ marginRight: "8px" }}>Status:</label>
            <select 
              className={`input-field-small status-badge status-${status.toLowerCase()}`}
              value={status} 
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={loading}
            >
              <option value="Open">Open</option>
              <option value="Break">Break</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div>
            <label style={{ marginRight: "8px" }}>Service:</label>
            <select 
              className="input-field-small"
              value={service} 
              onChange={(e) => handleServiceChange(e.target.value)}
            >
              <option value="">Select Service...</option>
              {servicesList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ marginRight: "8px" }}>Counter:</label>
            <select 
              className="input-field-small"
              value={counter} 
              onChange={(e) => handleCounterChange(e.target.value)}
            >
              <option value="">Select Counter...</option>
              {countersList.map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="main-content">
        {!activeTicket ? (
          <div style={{ textAlign: 'center' }}>
            <button 
                className="btn-call" 
                onClick={handleCallNext} 
                disabled={loading || status !== "Open"}
                style={{ opacity: status === "Open" ? 1 : 0.5 }}
            >
              {loading ? "CALLING..." : "CALL NEXT CUSTOMER"}
            </button>
            {status !== "Open" && (
                <p style={{ marginTop: '1rem', color: '#e53e3e' }}>Set status to <strong>OPEN</strong> to call tickets.</p>
            )}
          </div>
        ) : (
          <div className="card">
            <p style={{ color: '#718096', margin: 0 }}>SERVING TICKET</p>
            <div style={{ fontSize: '1.5rem', color: '#718096' }}>{activeTicket.name}</div>
            <h1 style={{ fontSize: '6rem', margin: '0 0 1rem 0', color: '#2b6cb0' }}>
              #{activeTicket.name.slice(-3)}
            </h1>
                      
            <div className="input-group">
              <label>Citizen Civil ID</label>
              <input 
                className="input-field"
                value={activeTicket.customer_id || ""}
                onChange={(e) => setActiveTicket({ ...activeTicket, customer_id: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Citizen Full Name</label>
              <input 
                className="input-field"
                value={activeTicket.customer_name || ""}
                onChange={(e) => setActiveTicket({ ...activeTicket, customer_name: e.target.value })}
              />
            </div>

            <button className="btn-complete" onClick={handleComplete} disabled={loading}>
              COMPLETE & SAVE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}