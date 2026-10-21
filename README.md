# 🏓 SpinTrack SSTZ - Stolnotenisový Denník & Sledovanie Výstroja

Aplikácia inšpirovaná populárnou mobilnou aplikáciou **SpinTrack (SpinBook / RubberApp)**, obohatená o priame živé prepojenie s oficiálnym slovenským stolnotenisovým portálom **SSTZ (stolnytenis.info)**.

---

## 🚀 Rýchle spustenie

Aplikácia beží ako kompletný webový systém (Express backend + React frontend s proxy).

Nová inštalácia začína prázdna: bez tréningov, zápasov, rakiet a poťahov. Záznamy pribudnú až po vlastnom zápise alebo výslovnom importe; existujúce uložené údaje zostávajú zachované. Aj reset vyprázdni denník a výbavu bez ukážkových dát.

### 1. Spustenie aplikácie (produkčný server):
```bash
npm start
```
Aplikácia bude dostupná na: **`http://localhost:3001`**

### 2. Spustenie vývojového prostredia (s Hot Module Reloading):
```bash
npm run dev
```
- Backend API beží na: `http://localhost:3001`
- Vite frontend beží na: `http://localhost:5173`

---

## 🌟 Kľúčové Funkcie

### 1. 🏓 Sledovanie Výbavy & Poťahov (SpinTrack Core)
- **Kompletné zostavy rakiet (Racket Setups):**
  - Kombinovanie dreva (Blade) + poťahu na forehand (FH) + poťahu na backhand (BH).
  - Výber rúčky (FL, ST, AN, CPEN), počtu vrstiev a materiálov (drevo + ALC/Carbon).
  - Označenie aktívnej hernej rakety.
- **Merač opotrebovania poťahov (Rubber Wear & Health Tracking):**
  - Každý poťah má vizuálny ukazovateľ zdravia (100% -> 0%).
  - Počítadlo odohraných hodín pri stole.
  - Varovné upozornenie pri dosiahnutí kritickej hranice (cca 60–80 hodín), kedy poťah stráca grip, rotáciu a dynamiku.
  - Tlačidlo na vynulovanie hodín pri nalepení nového poťahu.
- **Katalóg vybavenia & Porovnávač (Side-by-Side Comparison):**
  - Databáza svetových poťahov (Butterfly Dignics 09C, Tenergy 05, Rozena, DHS Hurricane 3 Neo, Tibhar Evolution MX-P, Yasaka Rakza 7/Z, Nittaku Fastarc G-1, Donic Bluefire, Andro Rasanter, Victas atď.).
  - Porovnanie dvoch poťahov vedľa seba (Rýchlosť, Rotácia, Kontrola, Životnosť).
  - Pridanie do výbavy jedným klikom.
- **Gear Performance Index (GPI):**
  - Výpočet úspešnosti a indexu výkonnosti pre každú tvoju zostavu.

### 2. 🇸🇰 Prepojenie so Slovenským zväzom (SSTZ / StolnyTenis.info)
- **Všetkých 126 slovenských líg z 39 regiónov:**
  - Republikové súťaže SSTZ (Extraliga, 1. liga Západ/Východ, mládež), krajské zväzy (KSTZ Bratislava, Trnava, Nitra, Trenčín, Banská Bystrica, Žilina, VSSTZ) aj okresné/oblastné zväzy (ObSTZ / OSTZ).
  - Živé oficiálne ligové tabuľky (poradie, Z, V, R, P, skóre, body) a kompletné rozpisy zápasov s prepojením na oficiálny zápis.
- **Import celej kariéry (všetky minulé sezóny od 2018/19):**
  - Možnosť stiahnuť nielen aktuálnu sezónu, ale aj všetky historické sezóny a súťaže (Základné časti, Play-off, skupiny o umiestnenie).
  - Presné skóre setov (`3:0, 3:1`), jednotlivé body po setoch (`11:8, 11:7`) a oficiálna úspešnosť.

### 3. 🎯 Databáza Súperov & Taktický Skauting
- **Kompletný register súperov:**
  - Automatické generovanie databázy zo všetkých odohraných zápasov z minulých i súčasných líg.
  - Evidencia dominantnej ruky (Pravák / Ľavák / Neznáme).
  - Evidencia poťahov: Forehand & Backhand (Soft, Tráva, Sendvič, Anti-spin, Iné) s presným modelom poťahu.
  - Herný štýl (Útočník topspinár, Klasický obranca, Moderný obranca, Blokár pri stole, Allround).
  - Taktické poznámky k súperovi ("Čo na neho platí", slabiny, servis).
- **Vzájomná Head-to-Head bilancia & archív duelov:**
  - Zoznam úplne všetkých zápasov odohraných proti konkrétnemu súperovi.
  - Detailný rozpis bodov v každom sete.
  - Možnosť zapísať a uložiť taktickú poznámku ku každému konkrétnemu zápasu ("Čo si vedel hrať / čo fungovalo").

### 4. 📅 Kalendár & Rozpis Zápasov Tímu
- **Výber ligy a družstva:**
  - Možnosť jedným klikom naimportovať do kalendára rozpis svojho tímu alebo kompletnú súťaž.
  - Filtre: *Všetky*, *Nadchádzajúce*, *Odohrané*, *Doma*, *Vonku*.
  - Priame prepojenie na oficiálny zápis (protokol) stretnutia na SSTZ.
  - Možnosť zaznamenať svoj individuálny výsledok z ligového duelu do denníka.

### 5. ⏱️ Tréningový Denník & Live Stopky
- **Live Tréningové Stopky:**
  - Digitálny časovač s možnosťou spustiť, pozastaviť a uložiť tréning.
  - **Automatické započítanie času:** Odohrané minúty sa automaticky pripočítajú k poťahom na aktívnej rakete!
- **Kategorizácia tréningov:**
  - Typy: *Bežný tréning*, *Zápasy*, *Multiball*, *Nácvik podaní*, *Kondícia*.
  - Špecifické tagy cvičení (#topspin, #príjem, #falkenberg, #bloky, #práca nôh).
  - Hodnotenie intenzity (1 až 5 hviezdičiek).

### 6. 🏆 Štatistiky, Úrovne (XP) & Odznaky
- Herný systém postupu na vyššie úrovne na základe tréningových hodín a výhier.
- Zberateľské odznaky (Začiatočník, 10h pri stole, Majster rotácie 50h, SSTZ Reprezentant, Správca poťahov, Elitná úspešnosť 70%+).

### 7. 💾 Lokálna pamäť & Zálohovanie
- Údaje sú bezpečne ukladané v prehliadači (offline-first).
- Export a import JSON zálohy v sekcii Nastavenia.


## Import celej kariéry SSTZ

V sekcii **SSTZ** alebo **Turnaje** zadaj meno do spoločného vyhľadávania a vyber **Importovať ligy aj turnaje**. Jeden výber načíta ligové aj turnajové dvojhry a štvorhry zo všetkých dostupných sezón. Rovnaký formulár obnoví obe histórie tlačidlom **Obnoviť všetky zápasy**. Nie je potrebné samostatne pripájať turnajový profil.

Identifikátory na sstz.sk a stolnytenis.info sa nesmú zamieňať. Výsledky sa spoja iba pri jednoznačnej zhode celého mena na oboch zdrojoch. Pri menovcoch si používateľ vyberie ligový profil v tom istom formulári; aplikácia nevyberie prvý výsledok automaticky. Ak hráč existuje iba v jednom zdroji, formulár to uvedie a ponúkne import dostupnej histórie. Výpadok vyhľadávania sa neprezentuje ako chýbajúci profil.

Obe histórie sa načítajú a overia pred uložením. Ak niektorý požadovaný zdroj zlyhá alebo vráti neúplné údaje, zostanú obe pôvodné histórie zachované. Opakovaný import zachováva vlastné poznámky, raketu a ručné zápisy. Priebeh importu ostáva viditeľný aj po prepnutí sekcie. Odpojenie zruší obe prepojenia, ale nevymaže históriu. Import celej kariéry môže trvať dlhšie; samostatné odporúčania nadchádzajúcich turnajov majú naďalej vlastný limit 15 sekúnd.

Zoznam sezón sa načítava zo SSTZ; nie je obmedzený pevne zadanými rokmi. História zahŕňa dvojhry, štvorhry a kontumácie. Ak niektorú sezónu alebo ligu nemožno stiahnuť alebo sa nepodarí overiť počet zápasov, import vypíše chybu a ponechá predchádzajúcu históriu. Starý snapshot sa neprezentuje ako úspešná živá synchronizácia.

Snapshot ľubovoľného hráča možno obnoviť rovnakým importérom:

```bash
node scripts/generate-snapshot.mjs <SSTZ_ID_HRÁČA>
```

Živé načítanie vyžaduje HTTPS prístup k `www.stolnytenis.info`. V cloudovom prostredí s HTTPS proxy používaj Node 24.5 alebo novší; importér aktivuje podporu systémového proxy pre `fetch`.

## Účty a komunita

Prihlásenie e-mailom, registrácia, obnova hesla, priateľstvá a pozvánky na spoločné aktivity používajú Supabase. Pri aktivitách si vyberieš **Len ja**, **Iba priatelia** alebo **Verejná**; označený priateľ si pozvánku môže pridať do vlastného kalendára. Súkromné poznámky a fotky zostávajú v osobnom denníku.

Produkčný projekt je pripojený k Supabase, komunitná migrácia je aplikovaná a Vercel má nastavené obe verejné premenné. Pre registrácie mimo tímu projektu ešte treba dokončiť vlastné SMTP s overenou odosielacou doménou. Stav nasadenia a postup sú v [docs/COMMUNITY-SETUP.md](docs/COMMUNITY-SETUP.md). Príkaz `npm run check:community` overí živé API bez zápisu dát alebo odosielania e-mailov. Bez konfigurácie ďalej funguje miestny denník; prihlásenie a komunita sa nesimulujú.

Aktivity a zápasové histórie sa radia podľa dátumu konania, potom podľa dostupného času začiatku. Čas zápisu ani importu poradie neurčuje. Dátumy zo SSTZ (`DD.MM.RRRR`) a ISO formáty sa porovnávajú spoločne; záznamy bez známeho dátumu sú na konci a import im nevymýšľa dnešný dátum.

## Vzhľad aplikácie

V hornej lište prepínaš svetlý a tmavý režim ikonou slnka alebo mesiaca. V **Nastavenia → Vzhľad aplikácie** môžeš vybrať aj **Podľa systému**. Voľba sa uchováva v danom prehliadači, synchronizuje medzi jeho kartami a aplikuje ešte pred vykreslením aplikácie.

Prehľad obsahuje výsledky, najbližší neodohraný zápas od dnešného dňa, kondíciu poťahov a posledné dokončené aktivity. Na mobile sú ostatné sekcie v menu **Viac**, kde sa dajú vyhľadať aj bez diakritiky. Písmo Plus Jakarta Sans je súčasťou aplikácie vrátane slovenských znakov a licencie v `licenses/PlusJakartaSans-OFL.txt`.

Úvodný prehľad zobrazuje najbližšie tri plánované aktivity a ligové zápasy, stav výstroja a rýchle odkazy. Sekcia **Tvoja hra v číslach** umožňuje prepínať posledných 7, 30 alebo 90 dní: stĺpce zobrazujú čas dokončených tréningov, výber stĺpca odhalí presný čas a počet tréningov. Zápasová forma zahŕňa dvojhry aj štvorhry v zvolenom období. Plánované a budúce tréningy sa do grafu nezapočítavajú.

Aplikácia používa výhradne mobilné rozloženie so šírkou najviac 480 px. Spodná navigácia zostáva vo všetkých sekciách; stredné tlačidlo **Pridať** otvorí zápis aktivity. SSTZ a ďalšie sekcie nájdeš v **Viac**. Formuláre majú dotykové ovládanie, minimálne 16 px písmo a panely rešpektujú bezpečné okraje displeja.

Mobilný domov má kompaktný súhrn, program, rozbaľovaciu výstroj s kondíciou FH/BH a posledné aktivity pred podrobnými grafmi. Horná lišta zobrazuje aktuálnu sekciu s návratom na prehľad. Plávajúca spodná navigácia necháva hlavné akcie dostupné palcom.

Odporúčané turnaje kontrolujú iba nadchádzajúce termíny zo SSTZ: číta sa úvodná sekcia budúcich turnajov a pri hranici minulých turnajov sa stránkovanie zastaví. Počet v aplikácii zahŕňa len nadchádzajúce turnaje, archív sa neprehľadáva. Vhodné overené výsledky nemajú pevný limit a dajú sa vyhľadávať a filtrovať podľa uloženia v kalendári. Server má spoločný 14-sekundový limit pre profil, zoznam, kategórie aj propozície; klient ukončí čakanie po 14,5 sekundy. Pri výpadku alebo prekročení limitu sa zobrazí chyba a zachovajú sa predchádzajúce výsledky, neúplnosť sa neprezentuje ako úplný zoznam. Zdieľaná päťminútová cache a súbežné overovanie skracujú načítanie; obnovenie vynúti novú kontrolu.

Kluby majú rýchle akcie na tréning, zdieľanie a pozvanie hráčov podľa oprávnení. Rozpis zvýrazňuje najbližší tréning; dochádzka umožňuje hľadanie podľa názvu, miesta a ISO dátumu a po skončení oddeľuje skutočnú účasť od RSVP. Komunita zobrazuje súčasne čakajúce pozvánky aj žiadosti o priateľstvo a umožňuje hľadať v načítaných aktivitách.

Odporúčania vyhodnocujú kategórie z aktuálnych detailov a propozícií všetkých nadchádzajúcich turnajov, bez výnimky podľa názvu turnaja alebo konkrétneho hráča. Platí to pre chlapcov aj dievčatá, štandardné vekové skupiny, číselné kategórie U a zverejnené ročníkové rozsahy. Pri ďalšej sezóne sa štandardné hranice posunú podľa dátumu turnaja; explicitné propozície majú prednosť. Regionálne podmienky a rebríčkové limity pri štarte mladších hráčov sa čítajú z pravidiel príslušného turnaja. Neznáma veková hranica alebo nepotvrdený kraj sa jasne označí ako podmienka na overenie. Nové kategórie sa objavia pri obnovení alebo po obnovení päťminútovej cache; každý profil sa posudzuje samostatne. Kontroly pohlavia, licencie, uzávierky a limit 15 sekúnd zostávajú platné.

## Mesačné a ročné zhrnutia

Sekcia **Viac → Zhrnutia** obsahuje všetky ukončené mesiace od prvej zaznamenanej aktivity a ukončené roky. Nové zhrnutie sa pri otvorení aplikácie ponúkne v samostatnej zatvárateľnej kartičke; v januári aj predchádzajúci rok. Po zatvorení sa znova automaticky neotvára. Hlavný prehľad neobsahuje kartičky ani odkaz na zhrnutia; archív je dostupný cez Viac → Zhrnutia. Stav prezretia sa ukladá s denníkom. Hranice období používajú časové pásmo Europe/Bratislava.

Kartičky obsahujú skutočný zapísaný čas dokončených tréningov, dvojhry aj štvorhry, výhry, prehry, ligové zápasy, počet pomenovaných líg, turnaje, aktívne dni a tréningový graf. Prepojená aktivita a jej zápas sa nepočítajú dvakrát. Plánované aktivity sú vylúčené. Archív sa ukladá s dátami denníka (aj v exporte a pri synchronizácii účtu); pri načítaní alebo oprave histórie sa prepočíta z pôvodných záznamov. Prázdne mesiace medzi aktívnymi obdobiami zostávajú dostupné.
