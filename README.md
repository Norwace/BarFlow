# BarFlow 0.12.1

Tegneprogram for drikkesystemer (øl, postmix og vann). Du drar inn utstyr og koblinger, kobler dem sammen med slanger og får en deleliste.

## Installere

1. Åpne mappa `Installer` og dobbeltklikk `Installer BarFlow.cmd`. Den setter sammen `BarFlow-Setup-0.2.0.exe` av de tre delene (.del0–.del2), sjekker at filen er hel, sletter delene og starter installasjonen.
2. Hvis Windows viser «Windows beskyttet PCen din»: trykk **Mer info** og så **Kjør likevel**. Advarselen kommer fordi programmet ikke er signert.
3. Programmet legger seg i Start-menyen og på skrivebordet. `.barflow`-filer åpnes i BarFlow når du dobbeltklikker dem.

## Hente BarFlow på en annen PC

Alt ligger i GitHub-repoet **Norwace/BarFlow**.

- **Bare programmet:** åpne `BarFlow.html` i repoet og trykk nedlastingsknappen (Download raw file). Dobbeltklikk fila.
- **Alt (kildekode og dokumentasjon):** grønn **Code**-knapp → **Download ZIP**, eller `git clone https://github.com/Norwace/BarFlow.git`.

Versjonen står øverst til venstre i programmet (BarFlow | v0.12.1).

## HTML-versjon (uten installasjon)

`BarFlow.html` er det samme programmet i én fil på ca. 2 MB. Dobbeltklikk fila, så åpnes den i Edge eller Chrome.

- **Lagre / Åpne:** nettleseren spør hvor tegningen skal lagres første gang. Etter det lagrer Ctrl+S rett til samme fil (Edge kan spørre om lov én gang).
- **PDF:** trykk PDF og velg «Lagre som PDF» som skriver.
- **Eget bibliotek:** lagres i nettleseren. Bruk ⋯ ved «+ Nytt utstyr» for å eksportere det til fil eller hente det inn igjen, for eksempel på en annen PC.
- **Tegninger:** samme .barflow-filer som Windows-programmet, så de kan åpnes i begge.
- **Oppdatering:** bytt ut `BarFlow.html` med ny fil.

## Bruk

| Hva | Hvordan |
|---|---|
| Legge inn utstyr eller kobling | Dra fra biblioteket til venstre, eller dobbeltklikk |
| Legge slange | Dra fra en port (prikk) til en annen port. Riktig overgang (reduksjon, skjøt eller gjengeadapter) legges på automatisk |
| Slange med åpen ende | Slipp slangen på et tomt sted. Dra den åpne enden til en port senere |
| Løs slange | Dra «Slange» fra biblioteket inn i tegningen |
| Avgrening | Slipp en ny slange på en eksisterende slange. Da settes det inn et T-stykke |
| Sette kobling inn i en slange | Dra koblingen fra biblioteket inn på slangen (slangen lyser grønt) |
| Kobling på åpen ende | Dra koblingen mot enden, eller dobbeltklikk enden for å velge fra liste |
| Velge | Venstreklikk velger komponent eller slange (og viser hva som henger sammen) |
| Endre slange | Høyreklikk på slangen eller slangeteksten: navn, dimensjon, lengde, medium og farge i en liten boks |
| Endre komponent | Høyreklikk på komponenten: etikett, roter, speil, notat, medium og «Bytt kobling» (rett ↔ vinkel, T ↔ Y) |
| Blueprint | Velg flere deler, høyreklikk på utvalget (eller Ctrl+B) og «Lagre som blueprint». Den havner under Blueprints i biblioteket og dras inn som vanlige deler. Slanger som går ut av utvalget tas ikke med, og lengdene nullstilles |
| Velge kobling i slangeende | Høyreklikk på det lille koblingssymbolet ved porten (tekst med dimensjon vises når du holder over). Velg Automatisk, Ingen, en rett eller en vinkel. Der det ikke trengs kobling vises en stiplet ⊕ når slangen er valgt |
| Skjøte to slanger | Dra en åpen slangeende mot en annen åpen ende. Skjøt eller reduksjon settes inn |
| Se hva som henger sammen | Klikk på en komponent eller slange. Alt som er koblet til lyser i sin egen farge, og tekst på slanger og koblinger vises. Resten tones ned |
| Én slange i pytonrøret | Klikk på slangen i pytonrør-enden: bare den og det den er koblet til lyser. Klikk på den svarte delen for hele røret |
| Kobling på slange i pytonrør | Slipp koblingen fra biblioteket ved slangeenden, eller dobbeltklikk slangen i pytonrør-enden og velg fra lista |
| Pytonrør | Høyreklikk på røret: antall slanger, dimensjoner, kjøleloop (kullsyrevann som standard, eller vann), og farge, innhold og medium per slange. Produktslangene er stripete hvit + farge. Kjøleloopen er én hvit og én svart slange |
| Smak på BIB | Høyreklikk på BIB-en og velg smak. Etiketten blir smaken. Slangene fra BIB får smaksfargen gjennom pumpe, bagveksler, kjøler og fram til kranen. Pytonrør-slangen beholder sin farge, men får smaken som innhold. «Smaker …» for å legge til eller endre |
| Medium | Velg i popupen for slanger og komponenter (gjelder porter uten fast medium) |
| Popup | Legger seg ved siden av komponenten du klikker på. Kan dras i tittellinja |
| Slange i vinkel ut av porten | Velg slangen, høyreklikk på koblingssymbolet (eller ⊕) ved porten og velg «Vinkel opp/ned/venstre/høyre». Vinkelkobling velges automatisk når det finnes. «Rett ut» tar den tilbake |
| Strek og boks | «Strek» eller «Boks» i verktøylinja, trykk og dra. Høyreklikk på kanten for farge, fyll, stiplet og tekst. Dra hjørner/endepunkter for å endre |
| Bøyer | Slangen legger seg automatisk. Dobbeltklikk på slangen der du vil ha en bøy, og dra den. Dobbeltklikk på bøyen fjerner den. Uten egne bøyer går slangen tilbake til automatisk. «Rett ut» fjerner alle |
| Sett inn med høyreklikk | Høyreklikk på tomt sted: favorittslanger, ★-utstyr, koblingsformer (rett, vinkel, T, U, Y, håndventil), blueprints, pytonrør og tekst. Koblingsformene får riktig størrelse når du drar dem inn på en slange, en åpen slangeende eller en port. Lagre en slange som favoritt med «★ Favoritt» i slange-boksen |
| Slette | Velg og trykk Delete |
| Flytte slangeende | Velg slangen og dra enden bort fra porten, til en annen port eller til tomt område |
| Velge kobling selv | Hold Shift når du slipper slangen på tomt område |
| Roter / speil | R / F |
| Slett | Delete. Slanger blir liggende med åpen ende når du sletter en komponent |
| Angre / gjør om | Ctrl+Z / Ctrl+Y |
| Kopier / lim inn / dupliser | Ctrl+C / Ctrl+V / Ctrl+D |
| Velge flere | Dra et rektangel med venstre museknapp på tomt område |
| Flytte visning | Høyre eller midtre museknapp og dra på tomt område, eller mellomrom + dra |
| Blueprints i biblioteket | Dobbeltklikk eller dra inn. ✎ endrer navn, × sletter. Dra for ny rekkefølge eller annen kategori. Lagre over en gammel med «Erstatt» i lagre-dialogen |

Portsymboler: rund = push-fit, firkant = stamme, rombe = gjenger.

Navnet på komponenten legges under den, eller ved siden av hvis det er porter i bunnen, så teksten ikke dekker koblingene.

Rød stiplet slange betyr at dimensjon, medium eller smak ikke passer.

Ventiler og medium:
- Samme medium på begge sider: ventilen er bare en del av linja, og smaken fra BIB følger med videre.
- Forskjellig medium på hver side (kuleventil, stengeventil, tilbakeslagsventil, håndventil): ingen varsel. Eksempel rens: nettvann → ventil → T-stykke inn på sirup-/sodalinja. Kobles vannet rett på T-stykket uten ventil, kommer varselet «Blandede medier».
- Side uten eget medium: får mediet fra ventilen ved siden av (vann → ventil → T-stykke blir blått). Ligger den mellom flere ventiler, vinner linja med smak fra BIB, så den som ikke er vann. En ventil som er stengt i drift gir ikke medium videre. Se fanen **Varsler**. Kryss av «Ignorer» på et varsel for å skjule det i tegningen. Det står fortsatt (grått) i lista og kan slås på igjen.

Kullsyrevann tegnes turkis med grå prikker. «Koblingsstørrelser» øverst viser størrelsen på alle koblinger i tegningen. Når den er av, vises størrelsen når du holder musa over.

## Drift-modus

Trykk **▶ Drift** i verktøylinja for å «skru på» anlegget.

- **Visning:** slanger med bevegelige streker strømmer. Hele farger står under trykk, og blasse slanger er tomme.
- **Startsituasjon:** alle kraner er stengt. Kjøleloopen går når kjøleren er på.
- **Status og bryter:** statusen (FULL, ÅPEN, BAG 1 …) står på en side av komponenten uten porter. Hold musa over komponenten eller statusen, så blir den til en bryter. Klikk bryteren for å endre. Vanlig klikk på komponenten velger den bare.
  - Kran, ventil (kuleventil, stengeventil osv.), CO₂-flaske og vanninntak: åpen/stengt.
  - BIB og fat: full/tom.
  - Kjøler, karbonator, kompressor og N₂-generator: på/av.
  - Bagveksler: Bag 1 / Bag 2. Gul ring viser bagen det faktisk trekkes fra når valgt bag er tom.
  - Øltårn: én knapp per kran (1, 2, 3 …).
- **Medium i slangene:** slangene får fargen til det som faktisk er i dem, med smaksfargen fra BIB-en som trekkes fra. Eksempel rens: nettvann inn på sodalinja med åpen ventil og pumpa stoppet (BIB tom eller drivgass av) – hele linja blir blå. Går to forskjellige medier inn i samme slange (pumpa går og ventilen er åpen), blir slangen rød stiplet med ⚠, og det står under **I drift** i Varsler.
- **Tilbakeslagsventil:** slipper bare gjennom fra Inn til Ut. Med tilbakeslagsventil på vanninntaket kommer ikke sirupen tilbake i vannledningen.
- **Bagveksler:** viser hvilken bag den trekker fra (grønn port og «BAG 1/2»). Blir valgt bag tom, byttes det automatisk til den andre. Høyreklikk viser hvilken BIB som sitter på hver inngang.
- **Trykk:**
  - Det strømmer bare med trykk: fra gassflaske, vanninntak, kompressor, fat med gass, pumpe med drivgass og kjøler som går.
  - BIB gir ikke trykk selv. Sirupen står i slangen, men går først når en pumpe med drivgass trekker den.
- **Utstyr som trenger noe inn:**
  - Kjøler, pumpe, karbonator, N₂-generator, gassblander, fat og maskiner går bare når de får det de trenger.
  - Mangler det noe, står de og viser f.eks. «MANGLER VANN OG GASS».
- **Postmixkjøler:**
  - Med vann og CO₂ og kjøleloopen koblet hele veien rundt går den. Da renner vannet inn hele tiden.
  - Uten vann eller CO₂ står den, kjøleloopen stopper og det lages ikke kullsyrevann.
- **Gass og trykkluft** strømmer hele veien fra kilden så lenge gassflaska, kompressoren osv. er på, også når utstyret de går til står.
- **Lekkasje:** åpne slangeender, ledige porter på koblinger og ledige slanger i pytonrøret blinker rødt når det kommer noe dit. Det strømmer da ut av dem. Ledige porter på utstyr regnes som plugget.
- **Egen oppførsel:** i utstyrseditoren under **Drift** velger du rolle (kilde med/uten trykk, beholder, pumpe, utstyr som må ha drift, maskin, kran, avløp eller bare gjennomløp) og hvilke innganger utstyret må ha for å gå.
- **Opplysing** virker også i drift: klikk på noe for å se kretsen.
- **Portretning:** inn/ut tolkes fra portnavnet («Vann inn», «Sirup ut»). Utstyr du har laget selv kan få retning i kolonnen **Retning** i utstyrseditoren.
- **Lagring:** tilstandene (åpen, tom, på …) lagres i tegningen. «■ Stopp drift» går tilbake til vanlig tegning.

## Bibliotek

Utstyr ligger øverst, så blueprints, favoritter og koblinger.

- **Standardkoblinger:** grå acetal i 5/16", 3/8" og 1/2" (rette, vinkler, T, Y, U, håndventiler og reduksjoner) ligger øverst.
- **Utstyr:** startsett med vanlig utstyr for gass, øl, postmix og vann, inkludert luftkompressor. Juster dimensjonene til det du bruker.
- **Auto-koblinger:** overgangene i slangeendene velges fra DMfit (grå acetal først) og kommer med i delelista. Kan slås av i verktøylinja eller overstyres per slange i sidepanelet.
- **DMfit-koblinger:** 1476 artikler fra DMfit-katalogen 2022, med art.nr, rørdimensjon og gjenger.
- **Nytt utstyr:** «+ Nytt utstyr» øverst i biblioteket. Velg kategori (eller «Ny kategori …»), symbol og porter. Dimensjon velges fra liste («Annen …» for egne verdier).
- **Flytte til kategori:** dra komponenten i biblioteket ned på en kategori, f.eks. Postmix.
- **Rekkefølge:** dra komponenter og kategorier opp eller ned i biblioteket. Standard er alfabetisk for utstyr og katalogrekkefølge (etter dimensjon) for koblinger. «⋯ → Tilbakestill rekkefølge» setter alt tilbake.
- **Bagveksler:** ligger under Postmix (2 × sirup inn nede, 1 × ut oppe).
- **Endre eksisterende:** trykk ✎ på en komponent. Endringer lagres i `%APPDATA%\BarFlow\bibliotek.json`.
- **Favoritter:** ★ legger komponenten øverst i biblioteket og i koblingsvelgeren.

## Utskrift og eksport

- **Excel:** deleliste med fanene Deleliste, Slanger (hver slange fra–til) og Pytonrør.
- **PDF / Skriv ut:** tegning med tittelfelt og fargeforklaring, og deleliste på neste side. Velg A3 eller A4 i fanen Deleliste.
- **Prosjektinfo:** kunde, prosjekt, adresse og dato vises i tittelfeltet.

## Bygge fra kildekode

Krever Node.js 20 eller nyere.

```
npm install
npm run dev          # utvikling i nettleser
npm run build:html   # lager BarFlow-HTML i dist-html/index.html (kopieres til BarFlow.html i roten)
npm run dist:win     # lager installasjonsfil i release/
```
