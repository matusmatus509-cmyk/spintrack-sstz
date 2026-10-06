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

> **Garancia pravdivosti:** aplikácia nikdy nezobrazuje vymyslené zápasy ani skóre.
> Každý duel, set, súper a tím pochádza výhradne z oficiálneho portálu
> `stolnytenis.info` a výsledok sa krížovo overuje voči oficiálnym súhrnom
> „Úspešnosť – Dvojhry/Štvorhry". Ak sa údaje nezhodujú, aplikácia to
> **prizná** (červený odznak „nepotvrdené"), nič „nedopočíta".

#### Ako dostať do aplikácie svoje reálne zápasy

Server potrebuje prístup na internet (portál je dostupný len odtiaľ). Postup:

```bash
npm install                     # raz
npm run sstz:probe -- 5723      # diagnostika: zistí, ako portál prepína sezónu
npm run sstz:sync -- 5723 --all # stiahne VŠETKY sezóny (2018/19 – 2026/27) a uloží snapshot
npm run dev                     # spustí aplikáciu; tá si snapshot načíta
```

Snapshot sa ukladá do `data/sstz/<id>.json` – dá sa commitnúť do repozitára,
takže aplikácia funguje aj na stroji bez prístupu na portál (vtedy údaje
zobrazuje ako „snapshot" s dátumom stiahnutia).

CLI skončí s návratovým kódom `0` len vtedy, keď všetky stiahnuté sezóny
prejdú overením voči oficiálnym súhrnom.
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
