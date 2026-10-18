import { UserPlus, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useCommunity } from "../context/CommunityContext";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { communityError } from "../views/CommunityView";
import type { ActivityRecord } from "../types";

export function TagActivityFriend({ activity }: { activity: ActivityRecord }) {
  const account = useCommunity();
  const { updateActivity } = useApp();
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);
  if (!account.friends.length) return null;
  const shared = account.ownShares.find((row) => row.local_id === activity.id);
  return (
    <details className="social-share-options">
      <summary>
        <UserPlus size={16} />
        <span>Pozvať priateľa k aktivite</span>
        <ChevronRight size={16} />
      </summary>
      <form
        className="community-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (locked.current) return;
          locked.current = true;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            if (!shared || shared.visibility === "private") {
              await account.publishActivity(
                activity.id,
                { ...activity, visibility: "friends" },
                [recipient],
              );
              updateActivity(activity.id, { visibility: "friends" });
            } else {
              const result = await supabase!.rpc("tag_shared_activity", {
                p_activity: shared.id,
                p_recipient: recipient,
              });
              if (result.error) throw new Error(result.error.message);
              await account.refresh();
            }
            setMessage(
              "Hráč je označený. Aktivitu nájde v Komunita → Pozvánky.",
            );
          } catch (e) {
            setError(communityError(e));
          } finally {
            locked.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          Označiť priateľa
          <select
            required
            value={recipient}
            disabled={busy}
            onChange={(e) => setRecipient(e.target.value)}
          >
            <option value="">Vyber priateľa</option>
            {account.friends.map((friend) => (
              <option key={friend.id} value={friend.id}>
                {friend.display_name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary" disabled={busy || !recipient}>
          {!shared || shared.visibility === "private"
            ? "Zdieľať s priateľmi a označiť"
            : "Označiť v aktivite"}
        </button>
        {message && <small role="status">{message}</small>}
        {error && (
          <small role="alert" className="community-error">
            {error}
          </small>
        )}
      </form>
    </details>
  );
}
