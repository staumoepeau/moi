import * as React from "react";

export function QmsDisplay() {
  const [nowServing, setNowServing] = React.useState({ ticket: "---", counter: "--" });
  const [history, setHistory] = React.useState([]);
  const [isStarted, setIsStarted] = React.useState(false); // New state for user interaction

  React.useEffect(() => {
    if (!isStarted) return; // Don't attach listener until started


  const handleTicketCalled = (data) => {
    // Extract the last 3 digits for the visual display and voice
    const shortTicket = data.ticket_id.slice(-3);

    // 1. Play chime and voice announcement using the short number
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log("Audio play blocked:", e));

    setTimeout(() => {
      // Tongan announcement using the 3-digit number
      const message = `Ticket Number ${shortTicket} to Counter ${data.counter_number}`;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'en-En';
      window.speechSynthesis.speak(utterance);
    }, 1000);

    // 2. Update UI (Show short version)
    setNowServing(prev => {
      if (prev.ticket !== "---" && prev.ticket !== shortTicket) {
        setHistory(oldHistory => [prev, ...oldHistory].slice(0, 5));
      }
      return { ticket: shortTicket, counter: data.counter_number };
    });
  };

    frappe.realtime.on("ticket_called", handleTicketCalled);

    return () => frappe.realtime.off("ticket_called", handleTicketCalled);
  }, [isStarted]); // Re-run when display is started

  const DisplayStyles = `
    .body-sidebar-container.expanded, .body-sidebar-placeholder { display: none !important; }
    header.navbar, .navbar, .page-sidebar, .page-head { display: none !important; }
    
    /* Option A: Modern Light Blue (Recommended) */
    .display-screen {
        width: 100vw; height: 100vh;
        background: linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%);    
        color: #f5f7fa; /* Dark text for contrast */
        font-family: 'Segoe UI', sans-serif;
        display: flex; overflow: hidden;
    }
        
    /* Start Overlay */
    .overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 9999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .btn-start {
        padding: 2rem 4rem; font-size: 2rem; background: #2b6cb0;
        color: white; border: none; border-radius: 10px; cursor: pointer;
    }

    .main-area { flex: 3; display: flex; flex-direction: column; align-items: center; justify-content: center; border-right: 2px solid #2d3748; }
    .history-area { flex: 1; background: rgba(0,0,0,0.2); padding: 2rem; }
    .label { font-size: 2rem; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.5rem; }
    .big-ticket { font-size: 15rem; font-weight: 900; line-height: 1; color: #f8f9fa; text-shadow: 0 0 30px rgba(99, 179, 237, 0.5); }
    .big-counter { font-size: 6rem; font-weight: bold; background: #2b6cb0; padding: 0.5rem 3rem; border-radius: 1rem; margin-top: 2rem; }
    .history-item { border-bottom: 1px solid #e9edf5; padding: 1rem 0; display: flex; justify-content: space-between; font-size: 2rem; }
  `;

  if (!isStarted) {
    return (
      <div className="overlay">
        <style>{DisplayStyles}</style>
        <h1 style={{marginBottom: '2rem'}}>MOI Public Display System</h1>
        <button className="btn-start" onClick={() => setIsStarted(true)}>
          CLICK TO INITIALIZE DISPLAY
        </button>
        <p style={{marginTop: '1rem', color: '#a0aec0'}}>Required to enable audio notifications</p>
      </div>
    );
  }

  return (
    <div className="display-screen">
      <style>{DisplayStyles}</style>
      
      <div className="main-area">
        <div className="label">Now Serving</div>
        <div className="big-ticket">{nowServing.ticket}</div>
        <div className="label" style={{marginTop: '4rem'}}>Proceed to</div>
        <div className="big-counter">Counter {nowServing.counter}</div>
      </div>

      <div className="history-area">
        <h2 style={{borderBottom: '4px solid #63b3ed', paddingBottom: '1rem'}}>Recent</h2>
        {history.map((item, i) => (
          <div key={i} className="history-item">
            <span style={{color: '#63b3ed'}}>{item.ticket}</span>
            <span style={{fontSize: '1.2rem', color: '#a0aec0'}}>C-{item.counter}</span>
          </div>
        ))}
      </div>
    </div>
  );
}