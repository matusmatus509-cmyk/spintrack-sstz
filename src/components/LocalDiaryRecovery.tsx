import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { useCommunity } from "../context/CommunityContext";
import { LOCAL_DIARY_KEY, localRecoverySummary, parseLocalDiary, prepareLocalRecovery } from "../utils/community";
import "./LocalDiaryRecovery.css";

/** Mounted in every account screen, rather than hidden inside account settings. */
export function LocalDiaryRecovery() {
  const account = useCommunity();
  const { exportData, importData } = useApp();
  const [raw, setRaw] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const read = () => {
      try { setRaw(localStorage.getItem(LOCAL_DIARY_KEY)); }
      catch { setError("Miestne úložisko sa nepodarilo otvoriť."); }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("pageshow", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("pageshow", read);
    };
  }, []);
  if (!account.user || !account.dataReady || account.recovering || dismissed) return null;
  const current = JSON.parse(exportData());
  let summary: ReturnType<typeof localRecoverySummary> | null = null;
  let invalid = false;
  if (raw) {
    try { summary = localRecoverySummary(current, parseLocalDiary(raw)); }
    catch { invalid = true; }
  }
  const emptyAccount = !current.activities.length && !current.matches.length &&
    !current.doublesMatches.length && !current.sstzProfile;
  if (restored) return <aside className="diary-recovery" role="status">
    <strong>Pôvodný denník je obnovený v účte.</strong>
    <p>{account.cloudError ? "Údaje sú v tomto zariadení. Uloženie do cloudu sa zatiaľ nepodarilo; zopakuj ho v Komunite." : "Pôvodná miestna kópia zostala zachovaná. Stav uloženia do cloudu nájdeš v Komunite."}</p>
    <button className="text-button" onClick={() => setDismissed(true)}>Rozumiem</button>
  </aside>;
  if (!summary?.available && !invalid && !error) {
    if (!emptyAccount) return null;
    return <details className="diary-recovery">
      <summary>Chýbajú ti údaje spred prihlásenia?</summary>
      <p>Účet má samostatný denník. Pôvodné údaje môžu byť v prehliadači a na adrese, kde si ich zapisoval. Otvor tú istú adresu v pôvodnom prehliadači a prihlás sa; ponúkneme ti prenos.</p>
      <p>Ak si používal staršiu adresu, <a href="https://spintrack-sstz-matusmatus509-5343s-projects.vercel.app/">otvor pôvodnú aplikáciu</a>. Nemaž údaje prehliadača. JSON zálohu môžeš importovať v Nastaveniach.</p>
    </details>;
  }
  const restore = () => {
    setError("");
    try {
      // Re-read both sides at click time; never overwrite records added since render.
      const merged = prepareLocalRecovery(localStorage, account.user!.id, exportData());
      if (!importData(JSON.stringify(merged))) throw new Error("Obnova sa nepodarila. Pôvodná kópia zostala zachovaná.");
      setRestored(true);
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === "QuotaExceededError"
        ? "V úložisku nie je miesto na bezpečnú zálohu. Najprv exportuj denník v Nastaveniach; údaje prehliadača nemaž."
        : cause instanceof Error ? cause.message : "Obnova sa nepodarila.");
    }
  };
  return <aside className="diary-recovery" aria-label="Obnova pôvodného denníka">
    <strong>{invalid ? "Miestnu zálohu sa nepodarilo načítať" : "Našli sme tvoj pôvodný denník v tomto zariadení"}</strong>
    {summary?.available && <>
      <p>V účte chýba: {summary.activities} aktivít, {summary.matches} zápasov{summary.sstz ? " a prepojenie SSTZ" : ""}. Prenesie sa aj dostupná výbava a rozpis.</p>
      <p>Obnov údaje do tohto účtu, ak patria tebe. Existujúce záznamy účtu aj pôvodná miestna kópia zostanú zachované. Prenesené aktivity budú súkromné.</p>
    </>}
    {invalid && <p>Pôvodnú kópiu sme nemenili. Skús importovať svoju JSON zálohu v Nastaveniach.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="community-actions">
      {summary?.available && <button className="btn-primary" onClick={restore}>Obnoviť môj denník do účtu</button>}
      <button className="text-button" onClick={() => setDismissed(true)}>Teraz nie</button>
    </div>
  </aside>;
}
