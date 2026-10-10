# 🏓 SpinTrack SSTZ - Stolnotenisový Denník & Sledovanie Výstroja

Aplikácia inšpirovaná populárnou mobilnou aplikáciou **SpinTrack (SpinBook / RubberApp)**, obohatená o priame živé prepojenie s oficiálnym slovenským stolnotenisovým portálom **SSTZ (stolnytenis.info)**.

---

## 🚀 Rýchle spustenie

Aplikácia beží ako kompletný webový systém (Express backend + React frontend s proxy).

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

V SSTZ Hub vyhľadaj ľubovoľného hráča a pripoj jeho profil. Import automaticky prejde všetky sezóny dostupné na SSTZ a všetky hráčove ligové záložky v každej sezóne: súbežné ligy, družstvá, nadstavby aj kvalifikácie. Na obnovenie použi „Celá kariéra (všetky ligy)“.

Zoznam sezón sa načítava zo SSTZ; nie je obmedzený pevne zadanými rokmi. História zahŕňa dvojhry, štvorhry a kontumácie. Ak niektorú sezónu alebo ligu nemožno stiahnuť alebo sa nepodarí overiť počet zápasov, import vypíše chybu a ponechá predchádzajúcu históriu. Starý snapshot sa neprezentuje ako úspešná živá synchronizácia.

Snapshot ľubovoľného hráča možno obnoviť rovnakým importérom:

```bash
node scripts/generate-snapshot.mjs <SSTZ_ID_HRÁČA>
```

Živé načítanie vyžaduje HTTPS prístup k `www.stolnytenis.info`. V cloudovom prostredí s HTTPS proxy používaj Node 24.5 alebo novší; importér aktivuje podporu systémového proxy pre `fetch`.

## Účty a komunita

Prihlásenie e-mailom, registrácia, obnova hesla, priateľstvá a pozvánky na spoločné aktivity používajú Supabase. Pri aktivitách si vyberieš **Len ja**, **Iba priatelia** alebo **Verejná**; označený priateľ si pozvánku môže pridať do vlastného kalendára. Súkromné poznámky a fotky zostávajú v osobnom denníku.

Na aktiváciu treba vytvoriť Supabase projekt, spustiť databázovú migráciu a nastaviť dve verejné premenné vo Verceli. Postup je v [docs/COMMUNITY-SETUP.md](docs/COMMUNITY-SETUP.md). Bez konfigurácie ďalej funguje miestny denník; prihlásenie a komunita sa nesimulujú.
