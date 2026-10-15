import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemePreference } from "../context/ThemeContext";

export function ThemePicker() {
  const { preference, setPreference } = useTheme();
  return (
    <section className="theme-settings" aria-labelledby="theme-title">
      <div>
        <h4 id="theme-title">Vzhľad aplikácie</h4>
        <p>Vyber si prostredie, v ktorom sa ti hrá najlepšie.</p>
      </div>
      <div className="theme-options" role="group" aria-label="Farebný režim">
        {(
          [
            { value: "light", label: "Svetlý", Icon: Sun },
            { value: "dark", label: "Tmavý", Icon: Moon },
            { value: "system", label: "Podľa systému", Icon: Monitor },
          ] as const
        ).map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={preference === value}
            onClick={() => setPreference(value as ThemePreference)}
          >
            <span className={`theme-swatch swatch-${value}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              <Icon size={15} />
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
