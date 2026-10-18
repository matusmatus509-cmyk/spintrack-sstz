export function PlayerAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("sk");
  const tone = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  return (
    <span
      aria-hidden="true"
      className={`social-avatar avatar-tone-${tone}${large ? " avatar-large" : ""}`}
    >
      {initials || "S"}
    </span>
  );
}
