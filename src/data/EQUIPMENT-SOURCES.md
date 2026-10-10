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

This includes historical products. It is not a certification of current ITTF approval
and does not establish that every product ever manufactured is present. New or absent
models can be entered manually and appear alongside the bundled list.
