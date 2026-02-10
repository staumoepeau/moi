import * as React from "react";

export function App() {
  const [ticket, setTicket] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const services = [
    { id: "Vehicle Registration", label: "Register Vehicle", icon: "🚗" },
    { id: "Driver License", label: "Driver License", icon: "🪪" },
    { id: "Plates", label: "Number Plates", icon: "🔢" },
    { id: "Fines", label: "Pay Fines", icon: "💰" },
  ];

  const handleServiceSelect = async (serviceName) => {
    setLoading(true);
    try {
      // Updated method path based on your project structure
      const response = await frappe.call({
        method: "moi.api.qms.create_ticket",
        args: { service_name: serviceName },
      });

      if (response.message) {
        setTicket(response.message);
        // Auto-reset the kiosk for the next customer after 6 seconds
        setTimeout(() => setTicket(null), 6000);
      }
    } catch (e) {
      console.error(e);
      frappe.show_alert({
          message: __("Failed to generate ticket. Please contact staff."),
          indicator: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kiosk-screen">
      {/* CSS Injection for Kiosk Mode */}
      <style>
        {`
            .body-sidebar-container.expanded,
            .body-sidebar-placeholder{
                display: none !important;
            }

            header.navbar, .navbar, .page-sidebar, .page-head {
                display: none !important;
            }

            .layout-main-section-wrapper, .page-container {
                padding: 0 !important;
                margin: 0 !important;
            }

            .layout-main-section {
                max-width: 100vw !important;
            }

            /* Kiosk Layout */
            .kiosk-screen {
                width: 100vw;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            .service-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 30px;
                padding: 40px;
                width: 90%;
                max-width: 1000px;
            }

            .service-card {
                background: white;
                border: 3px solid #1a365d;
                border-radius: 0px;
                padding: 50px 20px;
                text-align: center;
                cursor: pointer;
                transition: transform 0.2s, background 0.2s;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }

            .service-card:active {
                transform: scale(0.95);
                background: #ebf8ff;
            }

            .icon { font-size: 5rem; display: block; margin-bottom: 20px; }
            .label { font-size: 2rem; font-weight: bold; color: #1a365d; }

            /* Success State */
            .ticket-print-area {
                text-align: center;
                animation: fadeIn 0.5s ease-in;
            }

            .ticket-number {
                font-size: 12rem;
                font-weight: 900;
                color: #2b6cb0;
                margin: 20px 0;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `}
      </style>

      {!ticket ? (
        <>
          <h1 style={{ fontSize: "4rem", color: "#1a365d", marginBottom: "10px" }}>MOI - DMV</h1>
          <p style={{ fontSize: "1.8rem", color: "#4a5568", marginBottom: "40px" }}>
            {loading ? "Generating your ticket..." : "Select a service to get your number"}
          </p>

          <div className="service-grid">
            {services.map((s) => (
              <div
                key={s.id}
                className="service-card"
                onClick={() => !loading && handleServiceSelect(s.id)}
              >
                <span className="icon">{s.icon}</span>
                <span className="label">{s.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="ticket-print-area">
          <h2 style={{ fontSize: "2.5rem", color: "#2d3748" }}>YOUR TICKET</h2>
          <div className="ticket-number">{ticket}</div>
          <p style={{ fontSize: "2rem", color: "#718096" }}>Please wait in the seating area.</p>
          <button
            className="btn btn-primary btn-lg"
            style={{ marginTop: "40px", padding: "15px 40px", fontSize: "1.2rem" }}
            onClick={() => setTicket(null)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}