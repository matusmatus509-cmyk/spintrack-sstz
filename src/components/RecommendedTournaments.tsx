import { useEffect, useRef, useState } from "react";
import {
  CalendarPlus,
  Check,
  ExternalLink,
  RefreshCw,
  Trophy,
  Search,
  ListChecks,
  ArrowRight,
  Info,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import "../views/RecommendedTournaments.css";

interface Category {
  label: string;
  reason: string;
  minimumBirthYear: number | null;
  maximumBirthYear?: number | null;
  ageVerified?: boolean;
  eligibility?: "verified" | "conditional";
  conditions?: string[];
}
interface Tournament {
  id: string;
  title: string;
  date: string;
  url: string;
  registrationUrl: string;
  propositionUrl: string;
  categories: Category[];
}
interface Result {
  player: {
    name: string;
    birthYear: number;
    club: string;
    gender: string | null;
    licenseUntil: string;
  };
  tournaments: Tournament[];
  checkedAt: string;
  catalogueCheckedAt?: string;
  scannedCount?: number;
  pageCount?: number;
  checkedCount: number;
  unavailableCount: number;
  note: string;
}
const searchKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sk")
    .trim();
export function RecommendedTournaments() {
  const { tournamentProfile, activities, addActivity } = useApp();
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  const previousPlayer = useRef<string>();
  useEffect(() => {
    const changed = previousPlayer.current !== tournamentProfile?.id;
    previousPlayer.current = tournamentProfile?.id;
    if (changed) {
      setData(null);
      setSelection({});
      setQuery("");
      setOnlyNew(false);
    }
    setError("");
    setNotice("");
    if (!tournamentProfile) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      controller.abort();
      setError(
        "SSTZ nestihlo overiť turnaje do 15 sekúnd. Skús obnoviť zoznam.",
      );
      setLoading(false);
    }, 14500);
    fetch(
      `/api/sstz/tournaments/recommendations/${encodeURIComponent(tournamentProfile.id)}${refresh ? "?refresh=1" : ""}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Turnaje sa nepodarilo načítať.");
        if (
          !result.player ||
          !Array.isArray(result.tournaments) ||
          result.tournaments.some(
            (event: Tournament) =>
              !Array.isArray(event.categories) || !event.categories.length,
          )
        )
          throw new Error("SSTZ vrátilo neúplné odporúčania.");
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Turnaje sa nepodarilo načítať.",
          );
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [tournamentProfile?.id, refresh]);
  const savedFor = (id: string) =>
    activities.find((activity) => activity.sourceEventId === id);
  const events = (data?.tournaments || []).filter(
    (event) =>
      (!onlyNew || !savedFor(event.id)) &&
      searchKey(
        `${event.title} ${event.categories.map((category) => category.label).join(" ")}`,
      ).includes(searchKey(query)),
  );
  const add = (event: Tournament) => {
    if (savedFor(event.id)) return;
    const category =
      event.categories.find((value) => value.label === selection[event.id]) ||
      event.categories[0];
    addActivity({
      category: "turnaj",
      planned: true,
      date: event.date,
      durationMinutes: 0,
      focusDrills: [],
      title: event.title,
      eventCategory: category.label,
      sourceEventId: event.id,
      location: "",
      publicNote: "",
      privateNote: event.url,
      visibility: "private",
      addEquipmentWear: false,
    });
    setNotice(`${event.title} je v kalendári. Prihlásenie dokonči na SSTZ.`);
  };
  return (
    <section
      className="recommendations-panel"
      aria-labelledby="recommended-tournaments-title"
      aria-busy={loading}
    >
      <header className="recommendations-heading">
        <div className="recommendations-title">
          <span className="recommendations-icon">
            <Trophy size={23} />
          </span>
          <div>
            <span className="eyebrow">NÁJDI SVOJU ĎALŠIU VÝZVU</span>
            <h2 id="recommended-tournaments-title">Turnaje pre teba</h2>
          </div>
        </div>
        {tournamentProfile && (
          <button
            type="button"
            className="recommendations-refresh"
            aria-label="Obnoviť odporúčané turnaje"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <RefreshCw size={18} className={loading ? "sync-spinner" : ""} />
          </button>
        )}
      </header>
      <p className="recommendations-intro">
        Pozrieme iba nadchádzajúce turnaje SSTZ. Pri vhodných kategóriách
        uvedieme aj regionálne a ďalšie podmienky účasti.
      </p>
      {!tournamentProfile && (
        <div className="recommendations-empty">
          <span className="recommendations-empty-icon">
            <Trophy size={26} />
          </span>
          <h3>Najprv spoznajme tvoj profil</h3>
          <p>
            Pripoj svoj profil SSTZ nižšie. Jedným importom načítame ligy aj
            turnaje a podľa ročníka nájdeme tvoje možnosti.
          </p>
          <a href="#tournament-search-title">
            Nájsť môj SSTZ profil <ArrowRight size={16} />
          </a>
        </div>
      )}
      {loading && (
        <div className="recommendations-loading" role="status">
          <RefreshCw size={19} className="sync-spinner" />
          <div>
            <strong>
              {data
                ? "Aktualizujem nadchádzajúce turnaje…"
                : "Hľadám tvoje turnaje…"}
            </strong>
            <p>
              Overujem kategórie a propozície nadchádzajúcich turnajov.
              Načítanie trvá najviac 15 sekúnd.
            </p>
          </div>
        </div>
      )}
      {error && (
        <div role="alert" className="recommendations-error">
          <p>{error}</p>
          {data && <p>Zobrazené zostávajú posledné načítané výsledky.</p>}
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Skúsiť znova
          </button>
        </div>
      )}
      {notice && (
        <p className="recommendations-notice" role="status">
          <Check size={18} />
          {notice}
        </p>
      )}
      {data && (
        <>
          <div className="recommendations-profile">
            <strong>{data.player.name}</strong>
            <span>
              Ročník {data.player.birthYear}
              {data.player.club ? ` · ${data.player.club}` : ""}
            </span>
          </div>
          <div
            className="recommendations-scan"
            aria-label="Rozsah kontroly turnajov"
          >
            <div>
              <strong>
                {(data.scannedCount ?? data.checkedCount).toLocaleString(
                  "sk-SK",
                )}
              </strong>
              <span>nadchádzajúcich turnajov</span>
            </div>
            <div>
              <strong>
                {Math.max(0, data.checkedCount - data.unavailableCount)}
              </strong>
              <span>overených</span>
            </div>
            <div>
              <strong>{data.tournaments.length}</strong>
              <span>vhodných pre teba</span>
            </div>
          </div>
          {data.unavailableCount > 0 && (
            <p className="recommendations-warning">
              Pri {data.unavailableCount} turnajoch sa nepodarilo overiť všetky
              údaje. Medzi odporúčaniami sa zatiaľ nezobrazujú.
            </p>
          )}
          {!data.tournaments.length && (
            <div className="recommendations-empty">
              <h3>Momentálne bez overeného vhodného turnaja</h3>
              <p>
                {!data.player.gender
                  ? "V profile sa nepodarilo overiť súťažné pohlavie."
                  : !data.player.licenseUntil
                    ? "V profile chýba platnosť licencie."
                    : "V aktuálnom zozname nemáme potvrdenú otvorenú kategóriu, ktorá spĺňa tvoje podmienky účasti."}
              </p>
              <p>Nové termíny môžeš skontrolovať obnovením zoznamu.</p>
            </div>
          )}
          {!!data.tournaments.length && (
            <>
              <div className="recommendations-results-heading">
                <h3>
                  Možnosti pre teba <span>{data.tournaments.length}</span>
                </h3>
                <small>Od najbližšieho termínu</small>
              </div>
              <label className="recommendations-search">
                <Search size={17} />
                <input
                  aria-label="Hľadať v odporúčaných turnajoch"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Názov turnaja alebo kategória"
                />
              </label>
              <label className="recommendations-toggle">
                <input
                  type="checkbox"
                  checked={onlyNew}
                  onChange={(event) => setOnlyNew(event.target.checked)}
                />
                Iba turnaje, ktoré ešte nemám v kalendári
              </label>
              {!events.length && (
                <div className="recommendations-empty">
                  <h3>Pre tento výber nič nemáme</h3>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setQuery("");
                      setOnlyNew(false);
                    }}
                  >
                    Zobraziť všetky vhodné turnaje
                  </button>
                </div>
              )}
            </>
          )}
          <div className="recommendations-grid">
            {events.map((event) => {
              const saved = savedFor(event.id);
              const chosen =
                saved?.eventCategory ||
                selection[event.id] ||
                event.categories[0].label;
              const category = event.categories.find(
                (value) => value.label === chosen,
              );
              const date = new Date(`${event.date}T12:00:00`);
              return (
                <article className="recommended-tournament" key={event.id}>
                  <div className="recommended-card-heading">
                    <time className="recommended-date" dateTime={event.date}>
                      <strong>{date.getDate()}</strong>
                      <span>
                        {date.toLocaleDateString("sk-SK", { month: "short" })}
                      </span>
                      <small>{date.getFullYear()}</small>
                    </time>
                    <div>
                      <span
                        className={`recommended-label ${category?.eligibility === "conditional" ? "recommended-conditional" : ""}`}
                      >
                        {category?.eligibility === "conditional" ? (
                          <Info size={13} />
                        ) : (
                          <Check size={13} />
                        )}
                        {category?.eligibility === "conditional"
                          ? category.ageVerified === false
                            ? "Over vek a podmienky účasti"
                            : "Vhodný ročník · over podmienky"
                          : "Overená vhodná kategória"}
                      </span>
                      <h3>{event.title}</h3>
                      <span className="recommended-weekday">
                        {date.toLocaleDateString("sk-SK", { weekday: "long" })}
                      </span>
                    </div>
                  </div>
                  <label className="recommended-category">
                    Vyber svoju kategóriu
                    <select
                      aria-label={`Kategória: ${event.title}`}
                      value={chosen}
                      disabled={!!saved}
                      onChange={(change) =>
                        setSelection((previous) => ({
                          ...previous,
                          [event.id]: change.target.value,
                        }))
                      }
                    >
                      {saved?.eventCategory && !category && (
                        <option>{saved.eventCategory}</option>
                      )}
                      {event.categories.map((value) => (
                        <option key={value.label}>{value.label}</option>
                      ))}
                    </select>
                  </label>
                  <p className="recommended-chosen-category">{chosen}</p>
                  {category && (
                    <p className="recommended-eligibility">
                      {category.ageVerified === false
                        ? "Vekové podmienky si over v propozíciách"
                        : category.minimumBirthYear !== null &&
                            category.maximumBirthYear != null
                          ? `Ročníky ${category.minimumBirthYear} – ${category.maximumBirthYear}`
                          : category.maximumBirthYear != null
                            ? `Ročník ${category.maximumBirthYear} a starší`
                            : category.minimumBirthYear !== null
                              ? `Ročník ${category.minimumBirthYear} a mladší`
                              : "Bez vekového obmedzenia"}{" "}
                      · overená licencia
                    </p>
                  )}
                  {!!category?.conditions?.length && (
                    <div className="recommended-conditions">
                      <strong>Podmienky účasti</strong>
                      <ul>
                        {category.conditions.map((condition) => (
                          <li key={condition}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="recommended-actions">
                    <button
                      type="button"
                      disabled={!!saved}
                      onClick={() => add(event)}
                    >
                      {saved ? <Check size={17} /> : <CalendarPlus size={17} />}{" "}
                      {saved ? "V kalendári" : "Pridať do kalendára"}
                    </button>
                    <a
                      href={event.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Prihlásiť na SSTZ <ExternalLink size={14} />
                    </a>
                    <a
                      href={event.propositionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Propozície <ExternalLink size={13} />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
          <details className="recommendations-details">
            <summary>
              <ListChecks size={17} />
              Ako vyberáme turnaje
            </summary>
            <p>{data.note}</p>
          </details>
          <p className="recommendations-footnote">
            Zoznam overený{" "}
            {new Date(data.catalogueCheckedAt || data.checkedAt).toLocaleString(
              "sk-SK",
            )}
            {data.pageCount ? ` · ${data.pageCount} strán SSTZ` : ""}.{" "}
            <a
              href="https://turnaje.sstz.sk/turnaje"
              target="_blank"
              rel="noopener noreferrer"
            >
              Celý zoznam na SSTZ <ExternalLink size={12} />
            </a>
          </p>
        </>
      )}
    </section>
  );
}
