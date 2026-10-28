import React, { useState } from "react";
import { Users, Search, Check } from "lucide-react";
interface Friend {
  id: string;
  display_name: string;
  handle: string;
}
export function TrainingPeople({
  names,
  onNames,
  selected,
  onSelected,
  friends,
  labels,
  loggedIn,
}: {
  names: string;
  onNames: (value: string) => void;
  selected: string[];
  onSelected: (ids: string[]) => void;
  friends: Friend[];
  labels: Record<string, string>;
  loggedIn: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const visible = friends.filter((f) =>
    normalize(`${f.display_name} ${f.handle}`).includes(normalize(query)),
  );
  return (
    <section className="activity-section training-people">
      <div className="training-people-heading">
        <span>
          <Users size={21} />
        </span>
        <div>
          <h3>Súperi alebo spoluhráči</h3>
          <p>S kým si dnes zlepšoval svoju hru?</p>
        </div>
      </div>
      <label>
        Napísať meno
        <input
          value={names}
          onChange={(e) => onNames(e.target.value)}
          placeholder="Napr. Martin, Peter…"
          maxLength={300}
        />
        <small className="activity-hint">
          Môžeš zapísať aj ľudí, ktorí nemajú účet.
        </small>
      </label>
      {!!selected.length && (
        <div
          className="training-people-selected"
          aria-label="Označení spoluhráči"
        >
          {selected.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() =>
                onSelected(selected.filter((value) => value !== id))
              }
              aria-label={`Odobrať ${friends.find((f) => f.id === id)?.display_name || labels[id] || "hráča"}`}
            >
              {friends.find((f) => f.id === id)?.display_name ||
                labels[id] ||
                "Uložený hráč"}{" "}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      {loggedIn && friends.length > 0 ? (
        <>
          <label className="training-people-search">
            <span>
              <Search size={16} /> Vybrať priateľov
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hľadať podľa mena alebo prezývky"
            />
          </label>
          <div className="training-people-list">
            {visible.map((friend) => (
              <button
                type="button"
                key={friend.id}
                aria-pressed={selected.includes(friend.id)}
                onClick={() =>
                  onSelected(
                    selected.includes(friend.id)
                      ? selected.filter((id) => id !== friend.id)
                      : [...selected, friend.id],
                  )
                }
              >
                <span className="training-person-avatar">
                  {friend.display_name.slice(0, 1)}
                </span>
                <span>
                  <strong>{friend.display_name}</strong>
                  <small>@{friend.handle}</small>
                </span>
                <span className="training-person-check">
                  {selected.includes(friend.id) && <Check size={16} />}
                </span>
              </button>
            ))}
            {!visible.length && (
              <p className="activity-hint">Žiadny priateľ sa nenašiel.</p>
            )}
          </div>
        </>
      ) : (
        <p className="activity-hint">
          {loggedIn
            ? "Priateľov si pridáš v Komunita → Priatelia."
            : "Po prihlásení môžeš vyberať aj svojich priateľov."}
        </p>
      )}
      <p className="activity-hint">
        Označenie je súčasťou tvojho denníka. Samo neodošle pozvánku ani
        nezdieľa tréning.
      </p>
    </section>
  );
}
