The equipment name catalog is derived from the MIT-licensed TableTennisDB archive:
https://github.com/zerebos/TableTennisDB

Pinned revision: 3ea1f733057e09d9c66e242a2e3b73b81b6464b0.
The license is retained in `licenses/TableTennisDB-MIT.txt`.
The original archive attributes the name lists to Revspin.

The snapshot contains 1,885 rubber models (including pips) and 2,521 blade models
after deduplication, excluding entries without a manufacturer or with irrecoverably
corrupted names. Only manufacturer names, product names and source paths are copied;
reviews, images and performance ratings are not included. Multiword manufacturer
names and reversible encoding issues are normalized by the update script.

Refresh the snapshot with `node scripts/update-equipment-catalog.mjs <revision>`.
Omitting the revision reproduces the pinned source. Use `master` explicitly to check
a newer upstream archive. Check the counts, source license and catalog tests before
publishing a replacement. The resulting catalog is bundled for offline use and does
not depend on an external service while browsing or adding equipment.

The catalogue also bundles the currently approved rubber models from the public ITTF
List of Authorised Racket Coverings export:
https://ittf-admin-api.azurewebsites.net/api/Export/Equipment_RacketCoverings
Only records with `ApprovalStatus: true` and `IsExpired: No` are included. The saved
snapshot date is in `equipmentNames.json`. This is the official source for current
ITTF-authorised rubbers, not a list of every rubber ever manufactured.

ITTF does not publish a corresponding global approval register for blades. Blade names
therefore remain a historical catalogue snapshot and can include discontinued models;
the data cannot establish all blades currently sold worldwide. In addition, the current
Butterfly shop listing is bundled as a separate, dated source snapshot:
https://en.butterfly.tt/blades
Those entries are labeled as listed by Butterfly, not as a complete worldwide list.
Products missing from either bundled list can still be entered manually.

Refresh both source snapshots with `node scripts/update-equipment-catalog.mjs [revision]`.
The script validates that it received a substantial archive and ITTF export plus a
non-empty Butterfly shop listing before replacing the bundled JSON.
