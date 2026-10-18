# Prihlásenie a komunita: aktivácia na Verceli

Aplikácia používa Supabase Auth a PostgreSQL. Bez konfigurácie ďalej funguje miestny denník; prihlásenie a komunita sa zobrazia ako nepripojené. Žiadne účty ani spoločné aktivity nie sú simulované v produkcii.

## 1. Vytvor projekt

1. Otvor https://supabase.com/dashboard a vytvor projekt (pre európskych hráčov zvoľ región v EÚ).
2. Otvor **SQL Editor → New query**. Spusti celý súbor [202610100001_community.sql](../supabase/migrations/202610100001_community.sql). Spúšťa sa raz v novom projekte. Potom spusti [202610180001_club_attendance.sql](../supabase/migrations/202610180001_club_attendance.sql), ktorý pridá klubové tréningy a dochádzku. V existujúcom projekte s hotovou prvou migráciou spusti iba túto novú migráciu.
3. V **Authentication → Providers → Email** povoľ prihlásenie e-mailom a heslom a potvrdenie e-mailu. Pri verejnej prevádzke nastav vlastný SMTP pre registračné e-maily a obnovu hesla; predvolený e-mailový servis Supabase má obmedzenia pre príjemcov a počet správ.
4. V **Authentication → URL Configuration** nastav **Site URL** na skutočnú adresu aplikácie. Do povolených **Redirect URLs** pridaj túto adresu a lokálnu vývojovú adresu, ak ju používaš. Potvrdzovacie a obnovovacie odkazy sa vracajú na hlavnú obrazovku aplikácie.
5. V **Project Settings → API / API Keys** nájdi URL projektu a **Publishable key** (prípadne starší `anon` kľúč). Nikdy nepouži `secret` ani `service_role` kľúč v prehliadači alebo v premenných začínajúcich `VITE_`.

## 2. Pripoj Vercel

V projekte Vercel otvor **Settings → Environment Variables** a nastav pre Production (a vlastné Preview prostredie, ak ho chceš používať):

| Premenná | Hodnota |
| --- | --- |
| `VITE_SUPABASE_URL` | URL tvojho Supabase projektu |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Verejný publishable/anon kľúč |

Tieto dve hodnoty sú určené pre prehliadač. Vlastnú ochranu dát zabezpečujú RLS pravidlá a oprávnenia z migrácie. Po zmene premenných sprav **Redeploy**. Vite ich vkladá pri zostavení aplikácie.

Na lokálny vývoj vytvor ignorovaný `.env.local` podľa `.env.example`, vlož rovnaké dve premenné a reštartuj Vite. V nastaveniach cloudového vývojového prostredia sú pripravené požiadavky na tieto premenné; ich uloženie nenastavuje premenné vo Verceli.

## 3. Over dva skutočné účty

1. Otvor aplikáciu v dvoch odlišných profiloch prehliadača. Cez ikonu účtu alebo **Viac → Komunita** zaregistruj dva účty a potvrď e-maily.
2. Prihlás oba účty. Nový účet má prázdny denník a vlastnú výbavu. Existujúci miestny denník prenes tlačidlom **Preniesť miestne údaje do účtu**. Prenesené aktivity sa automaticky nezverejnia.
3. V komunite vyhľadaj druhého hráča podľa mena alebo používateľského mena, pošli žiadosť a na druhom účte ju prijmi.
4. Pridaj tréning, označ priateľa, nastav dátum a prípadne začiatok. Zvoľ **Iba priatelia** alebo **Verejná**. Označenie priateľa samo prepne súkromný záznam na viditeľnosť pre priateľov.
5. Druhému účtu sa v **Komunita → Pozvánky** zobrazí aktivita. Až po **Pridať do kalendára** vznikne jeho vlastný kalendárový záznam. Opakované prijatie nevytvorí ďalšiu kópiu.
6. Over súkromnú, priateľskú a verejnú viditeľnosť tretím nepriateľským účtom. Súkromnú poznámku ani fotky nesmie vidieť v komunite alebo pozvánke.
7. Over odhlásenie, opätovné prihlásenie na inom zariadení, potvrdenie e-mailu a obnovu hesla. Pri zmene účtu sa načíta samostatný denník.

## Klubová dochádzka

V **Komunita → Klubové tréningy** organizátor vytvorí termín, miesto, trvanie a cvičenia, určí termín odpovede a pozve prijatých priateľov. Pri tejto aktivite plní úlohu trénera jej organizátor; nejde o globálnu klubovú rolu. Čas tréningu a uzávierky sa zadáva podľa Slovenska (`Europe/Bratislava`).

Pozvaný hráč odpovie **Prídem / Neprídem / Neviem**. Odpoveď sa dá meniť do uzávierky. Organizátor vidí súhrn aj hráčov bez odpovede. Až po skončení tréningu môže označiť **Bol/a / Nebol/a**; skutočná účasť je oddelená od predbežnej odpovede.

Hráč s potvrdenou účasťou použije **Zapísať absolvovaný tréning**. Vznikne súkromný záznam s miestom, dátumom, cvičeniami a trvaním; s aktívnou raketou sa započíta opotrebovanie. Pôvod tréningu bráni opakovanému pridaniu na tom istom účte. Trvanie a súkromné vyhodnotenie sa upravia v denníku. Záloha účtu má stále režim posledného uloženého stavu, preto súbežné úpravy na viacerých zariadeniach nemožno automaticky zlúčiť.

Tabuľky `club_trainings` a `club_training_members` povoľujú čítanie iba organizátorovi a pozvaným. Hráč vidí svoju odpoveď, organizátor celý zoznam. Všetky zápisy prechádzajú databázovými funkciami; potvrdenie dochádzky je povolené iba organizátorovi po konci tréningu. Bez novej migrácie sa zobrazí správa, že dochádzka čaká na aktiváciu.

## Rýchly denník a spoľahlivá synchronizácia

Na hlavnej obrazovke, v denníku a kalendári sa dá zopakovať posledný absolvovaný tréning. Skopíruje sa miesto, cvičenia, spoluhráči a existujúca raketa; nový záznam začína dnes a súkromne, bez minulého vyhodnotenia. Starší plán sa dokončí cez **Absolvované** po jeho skončení. Bez zadaného začiatku sa ponúkne až na konci dňa.

Tri nepovinné otázky pri dokončenej aktivite sa ukladajú súkromne. Najnovší cieľ z tréningu je viditeľný na hlavnej obrazovke aj v novom tréningu. Vyhodnotenie a mená spoluhráčov sa neposielajú do verejného zdieľania.

Stav nad obsahom rozlišuje miestne uloženie, čakanie, ukladanie, úspešnú zálohu a chybu. Nepodarený zápis zostane vo fronte, dá sa zopakovať a po návrate pripojenia sa odošle znova. Plné miestne úložisko má samostatné upozornenie.

V SSTZ a denníku vidíš poslednú úspešnú aktualizáciu, počet nových zápasov pri nej a aktuálnu chybu. Zápas s rovnakým dátumom a súperom ako ručný záznam ponúkne zlúčenie alebo ponechanie oboch. Zlúčenie zachová poznámky, taktickú poznámku aj raketu a použije oficiálny výsledok. Rozhodnutie ponechať oba sa ukladá. Pôvodná aktivita s fotkami a vyhodnotením zostane zachovaná a v denníku sa nezobrazí druhý importovaný riadok.

## Ako sa ukladajú údaje

- `user_data`: súkromná záloha denníka, výbavy a SSTZ údajov. Číta a zapisuje ju iba vlastník. Miestne údaje sú oddelené kľúčom používateľa. Pri probléme so zálohou sa zobrazí možnosť zopakovať uloženie; miestna novšia kópia sa obnoví pri ďalšom prihlásení. Záloha používa posledný uložený stav, nie zlúčenie súčasných úprav z viacerých zariadení.
- `shared_activities`: iba výslovne zdieľané verejné polia. Súkromné poznámky, fotky a údaje výbavy sa sem neodosielajú. Databáza navyše uplatňuje vlastný zoznam povolených polí.
- `friend_requests`: prístup k aktivitám pre priateľov vzniká až po prijatí žiadosti.
- `activity_invitations`: pozvať sa dajú iba prijatí priatelia. Súkromný záznam nemôže mať pozvánky. Zrušenie priateľstva odstráni vzájomné pozvánky a prístup k pôvodným aktivitám pre priateľov. Už prijaté kalendárové kópie zostávajú príjemcovi.
- `calendar_entries`: súkromná kópia prijatej aktivity patrí príjemcovi. Prijatie nezapisuje odohratý tréning, zápas ani opotrebovanie rakety. Zmeny pôvodnej aktivity neprepisujú prijatú kópiu. Zrušenie zdieľania alebo prepnutie na **Len ja** odstráni pozvánky a prístup k pôvodnému záznamu; už prijaté kópie zostanú v kalendári príjemcu.

Všetky tabuľky majú zapnuté RLS. Operácie priateľstva, zdieľania a prijímania pozvánok používajú databázové funkcie s kontrolou prihláseného používateľa. E-maily a heslá spravuje Supabase Auth; verejný profil obsahuje iba meno, používateľské meno a voliteľný klub. Komunita sa obnovuje pri návrate do aplikácie, cez tlačidlo Obnoviť a každú minútu pri otvorenej aplikácii.

## Vývojové kontroly

```sh
npm ci
npx tsc --noEmit
npm test
npm run build
npm run dev
```

`tests/communityDatabase.test.mjs` vykonáva skutočnú migráciu v zabudovanom PostgreSQL (PGlite) a overuje prístup troch účtov, súkromné zálohy, prijatie priateľstva, odobratie prístupu, nezverejnenie súkromných polí a prijímanie pozvánok bez duplikátov. Nevyžaduje Supabase kľúče. E-mailové doručovanie a Supabase Auth treba overiť vo vlastnom nakonfigurovanom projekte podľa postupu vyššie.
