# Odporúčané turnaje SSTZ

Sekcia **Turnaje → Odporúčané turnaje** používa pripojený profil z `www.sstz.sk/hraci/<id>`. Turnajové registračné ID sa líši od ligového ID na stolnytenis.info. Profil sa pripája existujúcim vyhľadávaním v sekcii Turnaje.

Serverový endpoint `GET /api/sstz/tournaments/recommendations/:id` načíta aktuálny rok narodenia, klub a platnosť licencie z profilu, súťažné pohlavie z jeho oficiálnych rebríčkov, zoznam z `turnaje.sstz.sk/turnaje`, detaily kategórií a HTML/PDF propozície. Výsledok zahŕňa zdrojové odkazy, čas kontroly, počet overovaných turnajov a počet nedostupných detailov. Zoznam turnajov a propozície sa uchovávajú päť minút; profil sa overuje pri každom načítaní. Časová zóna je Europe/Bratislava.

Odporúčajú sa iba nadchádzajúce turnaje s aktívnym odkazom na registráciu, vhodnou kategóriou dvojhry, overiteľným pohlavím a licenciou platnou v deň podujatia. Účasť musí byť otvorená (OPEN) alebo výslovne povolená hráčom s platným registračným preukazom v propozíciách. Uzavreté krajské, oblastné, školské, majstrovské a nominačné podujatia sa bez potvrdenia ďalších podmienok neodporúčajú. Príslušnosť ku kraju sa neodhaduje z názvu mesta ani klubu. Regionálne turnaje OPEN môžu byť odporúčané aj hráčovi z iného kraja.

Vekové hranice uvedené v propozíciách majú prednosť. Pre sezónu 2026/27 sú overené ročníky: najmladší žiaci 2016+, mladší 2014+, starší 2012+, dorast 2008+. Zdroj: [oficiálne propozície PSPM 2026/27](https://turnaje.sstz.sk/data/files/propozicie_1pspm_pstz-2026_27-2000-1791564739.pdf). Po 30. júni 2027 táto náhradná tabuľka prestane platiť; bez výslovnej hranice v propozíciách sa kategória neodporučí. Neznáme vekové kategórie a podujatia s neoverenými kvalifikačnými alebo rebríčkovými podmienkami sa nezobrazujú. Ide o konzervatívny výber, nie úplný zoznam všetkých podujatí, na ktoré by hráč mohol mať nárok.

**Pridať do kalendára** vytvorí súkromnú naplánovanú aktivitu s vybranou kategóriou a odkazom na zdroj. Identita turnaja zabráni opakovanému pridaniu. Nevzniká odohraný zápas, tréningový čas ani opotrebovanie rakety. Registráciu dokončuje hráč cez samostatný odkaz na SSTZ.

Kontroly: `npm test`, `npx tsc --noEmit`, `npm run build`. Testy pokrývajú ročník 2011, presné hranice, odmietnutie uzavretých regionálnych podujatí, pohlavie, platnosť licencie, uzavreté registrácie, prednosť propozícií a chýbajúce údaje. PDF číta serverová knižnica pdfjs-dist; odporúčané prostredie Node 24.
