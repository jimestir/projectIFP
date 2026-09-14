import { useEffect } from "react";
import type { Pharmacy } from "../types";
import { PharmacyMap } from "./PharmacyMap";

type Props = {
  pharmacy: Pharmacy | null;
  onClose: () => void;
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1631549916768-4f8c1461e0ff?w=800&h=500&fit=crop";

const FALLBACK_DESC =
  "Farmacia local comprometida con la salud de su comunidad. Servicio profesional y atención personalizada.";

export function PharmacyDetailModal({ pharmacy, onClose }: Props) {
  useEffect(() => {
    if (!pharmacy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [pharmacy, onClose]);

  if (!pharmacy) return null;

  const hasCoords = pharmacy.lat != null && pharmacy.lng != null;
  const phones = pharmacy.phone
    ? pharmacy.phone
        .split(/[,;|]/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>

        <div className="pharmacy-modal-img-wrap">
          <img
            src={pharmacy.imageUrl || FALLBACK_IMG}
            alt={`Fachada de ${pharmacy.name}`}
            className="pharmacy-modal-img"
            loading="lazy"
          />
        </div>

        <div className="pharmacy-modal-body">
          <h1>{pharmacy.name}</h1>

          <p className="pharmacy-modal-address">
            {pharmacy.address} · CP {pharmacy.cp}
          </p>

          <section className="pharmacy-modal-section">
            <h2>Sobre nosotros</h2>
            <p>{pharmacy.description || FALLBACK_DESC}</p>
          </section>

          {phones.length > 0 && (
            <section className="pharmacy-modal-section">
              <h2>Contacto</h2>
              <ul className="pharmacy-modal-phones">
                {phones.map((p) => (
                  <li key={p}>
                    <a href={`tel:${p.replace(/\s/g, "")}`}>{p}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="pharmacy-modal-section">
            <h2>Datos</h2>
            <dl className="pharmacy-modal-data">
              <dt>Código postal</dt>
              <dd>{pharmacy.cp}</dd>
              {hasCoords && (
                <>
                  <dt>Coordenadas</dt>
                  <dd className="mono">
                    {pharmacy.lat!.toFixed(4)}, {pharmacy.lng!.toFixed(4)}
                  </dd>
                </>
              )}
            </dl>
          </section>

          {hasCoords && (
            <section className="pharmacy-modal-section">
              <h2>Ubicación</h2>
              <PharmacyMap
                lat={pharmacy.lat!}
                lng={pharmacy.lng!}
                name={pharmacy.name}
                address={pharmacy.address}
              />
              <p className="muted pharmacy-modal-geo-link">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${pharmacy.lat}&mlon=${pharmacy.lng}#map=17/${pharmacy.lat}/${pharmacy.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir en OpenStreetMap
                </a>
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
