/**
 * QmsDisplayRefactored.jsx
 *
 * Refactored version of QmsDisplay using mywhy-ui components
 * Shows how to integrate mywhy-ui into MOI QMS pages
 */

import * as React from "react";
import {
  Button,
  Badge,
  Card,
  Alert,
  Progress,
  Tabs,
  Spinner,
} from "mywhy-ui";

export function QmsDisplayRefactored() {
  const [nowServing, setNowServing] = React.useState({
    ticket: "---",
    counter: "--",
    service: "",
  });
  const [history, setHistory] = React.useState([]);
  const [isStarted, setIsStarted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [queueStats, setQueueStats] = React.useState({
    waiting: 0,
    served: 0,
    total: 0,
  });

  // ── Fetch queue statistics ───────────────────────────────────────
  const fetchQueueStats = async () => {
    setLoading(true);
    try {
      const stats = await frappe.db.get_value("QMS Dashboard", "stats", [
        "waiting_count",
        "served_count",
        "total_count",
      ]);
      setQueueStats({
        waiting: stats.message?.waiting_count || 0,
        served: stats.message?.served_count || 0,
        total: stats.message?.total_count || 0,
      });
    } catch (e) {
      console.error("Queue stats fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Announce ticket ──────────────────────────────────────────────
  const announce = (ticketShort, counterNumber) => {
    // Play chime
    try {
      const audio = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
      );
      audio.play().catch(() => {});
    } catch (_) {}

    // Speak announcement
    setTimeout(() => {
      const msg = `Ticket Number ${ticketShort}, please proceed to Counter ${counterNumber}`;
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(msg);
        window.speechSynthesis.speak(utterance);
      }
    }, 1000);
  };

  // ── Call next ticket ─────────────────────────────────────────────
  const callNextTicket = async () => {
    try {
      const response = await frappe.call({
        method: "moi.api.qms.call_next_ticket",
        async: false,
      });

      if (response.message) {
        const { ticket_number, counter_number, service } = response.message;
        setNowServing({
          ticket: ticket_number,
          counter: counter_number,
          service: service,
        });
        announce(ticket_number, counter_number);

        // Add to history
        setHistory((prev) => [
          {
            ticket: ticket_number,
            counter: counter_number,
            service: service,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev.slice(0, 9), // Keep last 10
        ]);
      }
    } catch (e) {
      console.error("Call ticket failed:", e);
    }
  };

  React.useEffect(() => {
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const progressValue =
    queueStats.total > 0
      ? Math.round((queueStats.served / queueStats.total) * 100)
      : 0;

  return (
    <div className="moi-container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="moi-header">Queue Management Display</h1>
        <p className="text-gray-600">Live queue status and ticket announcements</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-2">Waiting</p>
            <p className="text-3xl font-bold text-blue-600">
              {loading ? <Spinner size="sm" /> : queueStats.waiting}
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-2">Served</p>
            <p className="text-3xl font-bold text-green-600">
              {queueStats.served}
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-2">Total</p>
            <p className="text-3xl font-bold text-gray-800">
              {queueStats.total}
            </p>
          </div>
        </Card>
      </div>

      {/* Now Serving */}
      <Card className="moi-card mb-8 border-2 border-blue-500">
        <div className="p-8 text-center">
          <p className="text-sm text-gray-600 mb-2">NOW SERVING</p>
          <p className="text-6xl font-bold text-blue-600 mb-4">
            {nowServing.ticket}
          </p>
          <p className="text-xl font-semibold text-gray-700 mb-2">
            Counter {nowServing.counter}
          </p>
          <Badge theme="success" className="justify-center">
            {nowServing.service || "---"}
          </Badge>
        </div>
      </Card>

      {/* Action Button */}
      <div className="mb-8">
        <Button
          variant="solid"
          theme="brand"
          size="lg"
          onClick={callNextTicket}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Loading..." : "Call Next Ticket"}
        </Button>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <Progress
          value={progressValue}
          label="Queue Progress"
          showLabel
          theme="brand"
        />
      </div>

      {/* History Tabs */}
      <Tabs
        tabs={[
          {
            label: "Recent Calls",
            value: "recent",
            content: (
              <div className="space-y-2 p-4">
                {history.length > 0 ? (
                  history.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div>
                        <p className="font-semibold text-gray-800">
                          {entry.ticket}
                        </p>
                        <p className="text-sm text-gray-600">{entry.service}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">
                          Counter {entry.counter}
                        </p>
                        <p className="text-sm text-gray-600">{entry.timestamp}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <Alert theme="info">No tickets called yet</Alert>
                )}
              </div>
            ),
          },
          {
            label: "Settings",
            value: "settings",
            content: (
              <div className="p-4">
                <Alert theme="info" title="Settings">
                  Configure queue settings here
                </Alert>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
