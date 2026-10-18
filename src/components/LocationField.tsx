import { useId, useState } from "react";
import { MapPin, Check } from "lucide-react";
import { useApp } from "../context/AppContext";
import { locationKey } from "../utils/locations";
import "./LocationField.css";

export function LocationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { savedLocations } = useApp();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const query = locationKey(value);
  const selected = savedLocations.some((place) => locationKey(place) === query);
  const suggestions = savedLocations.filter(
    (place) => !query || selected || locationKey(place).includes(query),
  );
  const visible = expanded ? suggestions : suggestions.slice(0, 6);
  return (
    <div className="saved-location-field">
      <label htmlFor={id}>
        Miesto
        <input
          id={id}
          value={value}
          maxLength={200}
          autoComplete="off"
          placeholder="Herňa, mesto alebo športová hala"
          onChange={(event) => {
            onChange(event.target.value);
            setExpanded(false);
          }}
        />
      </label>
      {!!visible.length && (
        <>
          <span className="saved-location-label">Už použité miesta</span>
          <div
            className="saved-location-suggestions"
            role="group"
            aria-label="Navrhované miesta"
          >
            {visible.map((place) => (
              <button
                type="button"
                key={locationKey(place)}
                className="saved-location-chip"
                aria-pressed={locationKey(place) === query}
                onClick={() => onChange(place)}
              >
                {locationKey(place) === query ? (
                  <Check size={14} />
                ) : (
                  <MapPin size={14} />
                )}
                <span>{place}</span>
              </button>
            ))}
          </div>
          {suggestions.length > 6 && (
            <button
              type="button"
              className="saved-location-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded
                ? "Zobraziť menej miest"
                : `Ďalšie miesta (${suggestions.length - 6})`}
            </button>
          )}
        </>
      )}
      {value.trim() && !selected && (
        <p className="saved-location-hint">
          Nové miesto si zapamätáme pri uložení.
        </p>
      )}
    </div>
  );
}
