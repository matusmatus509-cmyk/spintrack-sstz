import { useApp } from "../context/AppContext";
import { matchDay } from "../utils/matchMerge";
export function ImportHealth() {
  const {
    sstzProfile,
    tournamentProfile,
    sstzError,
    tournamentError,
    matchMergeCandidates,
    resolveMatchMerge,
  } = useApp();
  if (!sstzProfile && !tournamentProfile && !matchMergeCandidates.length)
    return null;
  return (
    <section className="practice-panel" aria-label="Stav SSTZ importu">
      <div className="practice-heading">
        <div>
          <span>DÔVERA V ÚDAJE</span>
          <h2>SSTZ a tvoj denník</h2>
        </div>
      </div>
      {[
        ["Ligové zápasy", sstzProfile, sstzError],
        ["Turnajové zápasy", tournamentProfile, tournamentError],
      ].map(([label, raw, error]) => {
        const profile = raw as typeof sstzProfile;
        return profile ? (
          <div className="practice-import" key={String(label)}>
            <strong>{String(label)}</strong>
            <span>
              Posledná úspešná aktualizácia:{" "}
              {new Date(profile.lastSync).toLocaleString("sk-SK")}
            </span>
            <span>
              {profile.lastImportCount ?? "—"} nových zápasov pri poslednom
              importe
            </span>
            {!!error && (
              <p role="alert" className="community-error">
                {String(error)}
              </p>
            )}
          </div>
        ) : null;
      })}
      {matchMergeCandidates.map(({ manual, imported }) => (
        <div className="practice-merge" key={`${manual.id}|${imported.id}`}>
          <strong>Možný duplicitný zápas · {manual.opponentName}</strong>
          <p>
            {matchDay(manual.date)} · ručne {manual.score}, SSTZ{" "}
            {imported.score}
          </p>
          <p>Po zlúčení ostane výsledok zo SSTZ a tvoje poznámky aj raketa.</p>
          <div className="community-actions">
            <button
              className="btn-primary"
              onClick={() => resolveMatchMerge(manual.id, imported.id, true)}
            >
              Zlúčiť a zachovať poznámky
            </button>
            <button
              className="btn-secondary"
              onClick={() => resolveMatchMerge(manual.id, imported.id, false)}
            >
              Sú to dva zápasy
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
