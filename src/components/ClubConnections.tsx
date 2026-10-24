import { useState } from "react";
import {
  ShieldCheck,
  UserPlus,
  Send,
  Inbox,
  Check,
  X,
  Clock3,
  ArrowUpRight,
} from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";
import { useCommunity } from "../context/CommunityContext";
import type { ClubConnections } from "../hooks/useClubConnections";
const roleLabel = { owner: "Zakladateľ", coach: "Tréner", player: "Hráč" };

export function ClubConnectionStatus({
  connection,
}: {
  connection: ClubConnections;
}) {
  return (
    <>
      {connection.error && (
        <div className="community-error" role="alert">
          <p>{connection.error}</p>
          <button
            className="text-button"
            disabled={connection.loading}
            onClick={() => void connection.refresh()}
          >
            Obnoviť klubové pozvánky
          </button>
        </div>
      )}
      {connection.notice && (
        <p className="community-message" role="status">
          {connection.notice}
        </p>
      )}
    </>
  );
}
export function FriendClubActions({
  playerId,
  profileClub,
  connection,
  openClub,
}: {
  playerId: string;
  profileClub: string;
  connection: ClubConnections;
  openClub: (clubId: string) => void;
}) {
  const [inviteClub, setInviteClub] = useState("");
  const clubs = connection.memberships.filter((m) => m.user_id === playerId);
  const eligible = connection.managed.filter(
    (m) => !clubs.some((c) => c.club_id === m.club_id),
  );
  const selected = eligible.some((m) => m.club_id === inviteClub)
    ? inviteClub
    : eligible[0]?.club_id || "";
  return (
    <div className="friend-club-actions">
      {connection.loading && !clubs.length ? (
        <small>Načítavam kluby…</small>
      ) : (
        !clubs.length && (
          <small className="friend-no-club">
            {profileClub
              ? `Klub v profile: ${profileClub} · zatiaľ bez klubovej skupiny`
              : "Zatiaľ bez klubovej skupiny"}
          </small>
        )
      )}
      {clubs.map((club) => {
        const member = connection.mine.some((m) => m.club_id === club.club_id);
        const pending = connection.actions.find(
          (a) =>
            a.club_id === club.club_id &&
            a.player_id === connection.userId &&
            a.kind === "request" &&
            a.status === "pending",
        );
        const invite = connection.actions.find(
          (a) =>
            a.club_id === club.club_id &&
            a.player_id === connection.userId &&
            a.kind === "invitation" &&
            a.status === "pending",
        );
        return (
          <div className="friend-club-row" key={club.club_id}>
            <span className="friend-club-mark">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>{club.name}</strong>
              <small>
                {roleLabel[club.role]} · {club.member_count} členov
              </small>
            </div>
            {member ? (
              <button
                className="text-button"
                onClick={() => openClub(club.club_id)}
              >
                Otvoriť klub <ArrowUpRight size={14} />
              </button>
            ) : invite ? (
              <button
                className="btn-secondary"
                disabled={connection.busy}
                onClick={() => void connection.respond(invite.id, "accept")}
              >
                Prijať pozvánku
              </button>
            ) : pending ? (
              <span className="club-state">
                <Clock3 size={13} />
                Čaká na prijatie
              </span>
            ) : (
              <button
                className="btn-secondary"
                disabled={connection.busy || connection.loading}
                onClick={() => void connection.request(club.club_id)}
              >
                <UserPlus size={14} />
                Požiadať o prijatie
              </button>
            )}
          </div>
        );
      })}
      {!!eligible.length && (
        <form
          className="friend-club-invite"
          onSubmit={(e) => {
            e.preventDefault();
            void connection.invite(selected, playerId);
          }}
        >
          {eligible.length > 1 ? (
            <label>
              Pozvať do môjho klubu
              <select
                value={selected}
                onChange={(e) => setInviteClub(e.target.value)}
              >
                {eligible.map((m) => (
                  <option key={m.club_id} value={m.club_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <small>
              Pozvať do klubu <strong>{eligible[0].name}</strong>
            </small>
          )}
          <button
            className="text-button"
            disabled={
              connection.busy ||
              connection.loading ||
              connection.actions.some(
                (a) =>
                  a.club_id === selected &&
                  a.player_id === playerId &&
                  a.kind === "invitation" &&
                  a.status === "pending",
              )
            }
          >
            <Send size={14} />
            {connection.actions.some(
              (a) =>
                a.club_id === selected &&
                a.player_id === playerId &&
                a.kind === "invitation" &&
                a.status === "pending",
            )
              ? "Pozvánka odoslaná"
              : "Pozvať priateľa"}
          </button>
        </form>
      )}
    </div>
  );
}
export function ClubInviteForm({
  clubId,
  connection,
}: {
  clubId: string;
  connection: ClubConnections;
}) {
  const { friends } = useCommunity();
  const [player, setPlayer] = useState("");
  const available = friends.filter(
    (f) =>
      !connection.memberships.some(
        (m) => m.club_id === clubId && m.user_id === f.id,
      ),
  );
  const selected = available.some((f) => f.id === player)
    ? player
    : available[0]?.id || "";
  const sent = connection.actions.some(
    (a) =>
      a.club_id === clubId &&
      a.player_id === selected &&
      a.kind === "invitation" &&
      a.status === "pending",
  );
  return (
    <section className="club-direct-invite">
      <div className="club-section-heading">
        <span className="club-inbox-symbol">
          <UserPlus size={20} />
        </span>
        <div>
          <h3>Pozvi svoju partiu</h3>
          <p>Priateľ dostane osobnú pozvánku priamo v aplikácii.</p>
        </div>
      </div>
      {!available.length ? (
        <p className="practice-muted">
          {friends.length
            ? "Všetci tvoji priatelia už sú v tomto klube."
            : "Najprv si pridaj priateľov v sekcii Hráči."}
        </p>
      ) : (
        <form
          className="community-form"
          onSubmit={(e) => {
            e.preventDefault();
            void connection.invite(clubId, selected);
          }}
        >
          <label>
            Vyber priateľa
            <select
              value={selected}
              onChange={(e) => setPlayer(e.target.value)}
            >
              {available.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.display_name} · @{f.handle}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn-primary"
            disabled={connection.busy || connection.loading || sent}
          >
            <Send size={16} />
            {sent ? "Pozvánka odoslaná" : "Poslať pozvánku"}
          </button>
        </form>
      )}
    </section>
  );
}
export function ClubConnectionsPanel({
  connection,
  clubId,
  onlyInvites = false,
}: {
  connection: ClubConnections;
  clubId?: string;
  onlyInvites?: boolean;
}) {
  const all = connection.actions.filter(
    (a) =>
      (!clubId || a.club_id === clubId) &&
      (!onlyInvites ||
        (a.kind === "invitation" && a.player_id === connection.userId)),
  );
  const pending = all.filter((a) => a.status === "pending");
  const incoming = pending.filter((a) => a.can_respond);
  const outgoing = pending.filter((a) => !a.can_respond);
  const history = all.filter((a) => a.status !== "pending").slice(0, 8);
  if (!pending.length && !history.length) return null;
  return (
    <section
      className="club-connection-panel"
      aria-label="Klubové pozvánky a žiadosti"
    >
      <div className="club-section-heading">
        <span className="club-inbox-symbol">
          <Inbox size={20} />
        </span>
        <div>
          <h3>Pozvánky a žiadosti</h3>
          <p>
            {incoming.length
              ? `${incoming.length} čaká na tvoju odpoveď`
              : "Prehľad prijímania do klubov"}
          </p>
        </div>
      </div>
      {[...incoming, ...outgoing].map((a) => (
        <article key={a.id} className="club-connection-card">
          <div className="club-connection-title">
            <PlayerAvatar
              name={a.kind === "request" ? a.player_name : a.actor_name}
            />
            <div>
              <span className="social-eyebrow">
                {a.kind === "request"
                  ? "ŽIADOSŤ O ČLENSTVO"
                  : "OSOBNÁ POZVÁNKA"}
              </span>
              <h4>{a.club_name}</h4>
              <p>
                {a.kind === "request"
                  ? a.player_id === connection.userId
                    ? "Tvoja žiadosť čaká na schválenie."
                    : `${a.player_name} sa chce pridať do klubu.`
                  : a.player_id === connection.userId
                    ? `${a.actor_name} ťa pozýva do klubu.`
                    : `Pozvaný hráč: ${a.player_name}`}
              </p>
            </div>
          </div>
          <div className="club-connection-buttons">
            {a.can_respond && (
              <>
                <button
                  className="btn-primary"
                  disabled={connection.busy}
                  onClick={() => void connection.respond(a.id, "accept")}
                >
                  <Check size={16} />
                  {a.kind === "request" ? "Prijať hráča" : "Prijať pozvánku"}
                </button>
                <button
                  className="btn-secondary"
                  disabled={connection.busy}
                  onClick={() => void connection.respond(a.id, "decline")}
                >
                  <X size={16} />
                  Odmietnuť
                </button>
              </>
            )}
            {a.can_cancel && (
              <button
                className="text-button"
                disabled={connection.busy}
                onClick={() => void connection.respond(a.id, "cancel")}
              >
                Zrušiť {a.kind === "request" ? "žiadosť" : "pozvánku"}
              </button>
            )}
          </div>
        </article>
      ))}
      {!!history.length && (
        <details className="club-connection-history">
          <summary>Vybavené ({history.length})</summary>
          {history.map((a) => (
            <div key={a.id}>
              <span>
                {a.club_name} · {a.player_name}
              </span>
              <small>
                {
                  (
                    {
                      accepted: "Prijaté",
                      declined: "Odmietnuté",
                      cancelled: "Zrušené",
                      pending: "Čaká",
                    } as const
                  )[a.status]
                }
              </small>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
