import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { SearchResultRow } from "../types";
import "leaflet/dist/leaflet.css";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

export function SearchMap({
  rows,
  onReserve,
  canReserve,
}: {
  rows: SearchResultRow[];
  onReserve?: (row: SearchResultRow) => void;
  canReserve?: boolean;
}) {
  const points = rows
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      ...r,
      lat: r.lat as number,
      lng: r.lng as number,
    }));

  // Deduplicate markers by pharmacy
  const byPharmacy = new Map<string, typeof points>();
  for (const row of points) {
    const list = byPharmacy.get(row.pharmacyId) ?? [];
    list.push(row);
    byPharmacy.set(row.pharmacyId, list);
  }

  if (points.length === 0) {
    return (
      <div className="card map-empty">
        <p className="muted">No hay coordenadas para mostrar en el mapa.</p>
      </div>
    );
  }

  const center = {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };

  return (
    <div className="card map-wrap">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom={false}
        className="map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points.map((p) => ({ lat: p.lat, lng: p.lng }))} />
        {[...byPharmacy.entries()].map(([pharmacyId, list]) => {
          const first = list[0];
          return (
            <Marker
              key={pharmacyId}
              position={[first.lat, first.lng]}
              icon={markerIcon}
            >
              <Popup>
                <strong>{first.pharmacyName}</strong>
                <div className="muted">CP {first.cp}</div>
                <ul className="map-popup-list">
                  {list.slice(0, 5).map((item) => (
                    <li key={`${item.pharmacyId}-${item.productId}`}>
                      {item.productName}: {item.price.toFixed(2)} € · stock {item.stock}
                      {canReserve && item.stock > 0 && onReserve && (
                        <>
                          {" "}
                          <button type="button" className="btn small" onClick={() => onReserve(item)}>
                            Reservar
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
