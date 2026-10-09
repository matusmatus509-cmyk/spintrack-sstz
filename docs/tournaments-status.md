# SSTZ tournament imports

Tournament player search and complete match imports use the separate registration IDs published on sstz.sk. They do not share player IDs with stolnytenis.info's league archive.

SSTZ publishes singles, doubles and team event results on the player page. Each imported record keeps the official tournament, date, season, event category, round, opponent, result and score. Where published, doubles partners are retained. Individual set scores and ball points are not present in the player history, so they are not invented.

The backend follows SSTZ's paginated AJAX collection and only returns a successful profile when every page was read and the parsed record count equals SSTZ's official total. Incomplete responses leave saved history intact. Repeated imports replace that player's tournament records, retain match notes, tactics notes and racket assignments, and preserve league and manual matches.
