import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

type LiveEvent = {
  type: string;
  at?: string;
  payload?: unknown;
  pharmacyId?: string;
};

export function LivePage() {
  const { token, user } = useAuth();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "open" | "error" | "closed">(
    "connecting",
  );
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token || user?.role !== "PHARMACY") return;

    const url = `/api/events/pharmacy?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    sourceRef.current = es;

    const push = (type: string, data: unknown) => {
      setEvents((prev) => [{ type, ...(data as object) }, ...prev].slice(0, 40));
    };

    es.onopen = () => setStatus("open");
    es.onerror = () => setStatus("error");

    es.addEventListener("connected", (ev) => {
      try {
        push("connected", JSON.parse((ev as MessageEvent).data));
      } catch {
        push("connected", {});
      }
    });
    es.addEventListener("reservation.created", (ev) => {
      push("reservation.created", JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener("reservation.updated", (ev) => {
      push("reservation.updated", JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener("inventory.updated", (ev) => {
      push("inventory.updated", JSON.parse((ev as MessageEvent).data));
    });

    return () => {
      es.close();
      setStatus("closed");
    };
  }, [token, user?.role]);

  return (
    <section className="stack">
      <h1>Eventos en vivo (SSE)</h1>
      <p className="muted">
        Stream de tu farmacia: reservas e inventario. Estado: <strong>{status}</strong>
      </p>
      <div className="card">
        <ul className="event-list">
          {events.map((ev, idx) => (
            <li key={`${ev.type}-${idx}`}>
              <span className="badge">{ev.type}</span>
              <pre>{JSON.stringify(ev, null, 2)}</pre>
            </li>
          ))}
          {events.length === 0 && <li className="muted">Esperando eventos...</li>}
        </ul>
      </div>
    </section>
  );
}
