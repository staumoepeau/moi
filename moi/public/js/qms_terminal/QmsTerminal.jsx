import * as React from "react";

export function QmsTerminal() {
  const [services, setServices] = React.useState([]);
  const [ticketData, setTicketData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await frappe.db.get_list("QMS Service", {
          fields: ["service_name", "image", "background_color"],
          filters: { is_active: 1 },
          order_by: "service_name asc"
        });
        setServices(response);
      } catch (e) {
        console.error("Failed to fetch services:", e);
      }
    };
    fetchServices();
  }, []);

  const handleServiceSelect = async (serviceName) => {
    setLoading(true);
    try {
      const response = await frappe.call({
        method: "moi.api.qms.create_ticket",
        args: { service_name: serviceName },
      });

      if (response.message) {
        setTicketData({
          fullNumber: response.message,
          displayNumber: response.message.slice(-3),
          service: serviceName,
          time: new Date().toLocaleString()
        });

        setTimeout(() => {
          window.print();
        }, 500);

        setTimeout(() => setTicketData(null), 8000);
      }
    } catch (e) {
      console.error(e);
      frappe.show_alert({ message: "Error generating ticket", indicator: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Logic for Grid Columns
  const isThreeCol = services.length > 4;
  const gridColumns = isThreeCol ? "repeat(3, 1fr)" : "repeat(2, 1fr)";
  const labelFontSize = isThreeCol ? "1.8rem" : "2.4rem";
  const cardHeight = isThreeCol ? "200px" : "240px";

  const KioskStyles = `
    header.navbar, .navbar, .page-sidebar, .page-head, .body-sidebar-container { display: none !important; }
    .layout-main-section-wrapper, .page-container { padding: 0 !important; margin: 0 !important; }
    .kiosk-screen { 
        width: 100vw; 
        height: 100vh; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        justify-content: center; 
        background: #f8fafc; 
        font-family: sans-serif; 
        overflow: hidden;
    }
    
    .service-grid { 
        display: grid; 
        grid-template-columns: ${gridColumns}; 
        gap: 25px; 
        padding: 20px; 
        width: 95%; 
        max-width: 1200px; 
    }

    .service-card { 
        position: relative; 
        border: 2px solid rgba(0,0,0,0.05); 
        border-radius: 16px; 
        height: ${cardHeight}; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
        overflow: hidden; 
        transition: transform 0.1s ease, box-shadow 0.2s ease; 
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); 
    }

    .service-card:active { transform: scale(0.97); }

    .bg-image-watermark { 
        position: absolute; 
        right: -5%; 
        bottom: -5%; 
        width: 60%; 
        height: auto; 
        opacity: 0.1; 
        pointer-events: none; 
        z-index: 1; 
        filter: grayscale(100%) brightness(0); 
    }

    .label { 
        position: relative; 
        z-index: 2; 
        font-size: ${labelFontSize}; 
        font-weight: 800; 
        color: #1a365d; 
        text-align: center; 
        padding: 0 15px;
        text-shadow: 0 0 10px rgba(255,255,255,0.5); 
    }
    
    .ticket-number { font-size: 15rem; font-weight: 900; color: #2b6cb0; line-height: 1; margin: 10px 0; }
    .masked-prefix { font-size: 3rem; color: #cbd5e0; letter-spacing: 4px; vertical-align: middle; margin-right: 10px; }

    @media print {
        body * { display: none !important; }
        #ticket-print-template { 
            display: block !important; 
            width: 80mm; 
            padding: 10px;
            text-align: center;
            font-family: monospace;
            color: black !important;
        }
        .print-number { font-size: 40pt; font-weight: bold; margin: 10px 0; }
        .print-footer { font-size: 10pt; border-top: 1px dashed black; padding-top: 10px; }
    }

    #ticket-print-template { display: none; }
  `;

  return (
    <div className="kiosk-screen">
      <style>{KioskStyles}</style>

      {/* PRINT TEMPLATE */}
      {ticketData && (
        <div id="ticket-print-template">
            <h2 style={{ margin: 0 }}>MOI QMS</h2>
            <p style={{ fontSize: '14pt', fontWeight: 'bold' }}>{ticketData.service}</p>
            <div className="print-number">#{ticketData.displayNumber}</div>
            <p>Ref: {ticketData.fullNumber}</p>
            <div className="print-footer">
                <p>{ticketData.time}</p>
                <p>Please wait for your number.</p>
            </div>
        </div>
      )}

      {!ticketData ? (
        <>
          <h1 style={{ fontSize: "3.5rem", color: "#1a365d", fontWeight: "900", marginBottom: "40px" }}>
            Please select a service
          </h1>
          <div className="service-grid">
            {services.map((s) => (
              <div
                key={s.service_name}
                className="service-card"
                style={{ backgroundColor: s.background_color || "#ffffff" }} 
                onClick={() => !loading && handleServiceSelect(s.service_name)}
              >
                {s.image && <img src={s.image} className="bg-image-watermark" alt="" />}
                <span className="label">{s.service_name}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s' }}>
          <h2 style={{ fontSize: "2.5rem", color: "#64748b", textTransform: 'uppercase' }}>Your Ticket</h2>
          <div className="ticket-number">
            <span className="masked-prefix">••••</span>
            {ticketData.displayNumber}
          </div>
          <p style={{ fontSize: "1.8rem", color: "#475569", marginBottom: '30px' }}>
            Printing ticket... Please take it from the slot.
          </p>
          <button 
            className="btn btn-primary btn-lg" 
            style={{ padding: '15px 40px', fontSize: '1.5rem', borderRadius: '50px' }}
            onClick={() => setTicketData(null)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}