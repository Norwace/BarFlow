# BarFlow – spesifikasjon og status (v0.12.1, 15.10.2026)

## Formål
Eget verktøy for å tegne drikkesystemer som skjema (ikke målestokk), koble sammen utstyr med slanger og få en deleliste.

## Avklarte valg
- **Plattform:** HTML-fil (`OneDrive\Apper by me\BarFlow\BarFlow.html`, ca. 2 MB) som åpnes i Edge/Chrome. Windows-programmet (Electron) finnes fortsatt i v0.2, men bygges bare på nytt ved behov. Samme `.barflow`-filer i begge.
- **Anleggstyper:** øl, postmix og vann.
- **Koblinger:** alle koblinger tegnes som egne symboler og snapper på slangeender og porter.
- **Mest brukt:** grå acetal DMfit i 5/16", 3/8" og 1/2": rette, vinkler, T, Y, U og håndventiler. De ligger øverst i biblioteket som «Standardkoblinger». Resten av katalogen er tilgjengelig under.
- **Bibliotek:** hele DMfit-katalogen 2022 (1476 artikler) og et startsett med utstyr, inkludert luftkompressor. Brukeren kan legge til og endre utstyr i appen.
- **Slanger:** PE-slange (push-fit) og pytonrør.
  - Klikk på en slange for å endre navn, farge, dimensjon og meter i en liten boks.
  - Farger: natur, blå, lyseblå, rød, rosa, svart, grønn, limegrønn, gul, lysegul, hvit, grå, oransje, lilla, brun, lysebrun.
  - Kullsyrevann tegnes turkis med grå prikker.
- **BIB-smaker:** BIB får smak fra en redigerbar liste (standard: Bringebær = rosa, Tyttebær = oransje, Grønn iste = grønn, Sitron = lysegul, Cola = brun, Cola sukkerfri = lysebrun, Pære = lyseblå).
  - Slangene i hele sirup-linja får smaksfargen, bortsett fra slangen i pytonrøret. Den får smaken som innhold.
  - Egen slangefarge går foran.
  - Ulike smaker i samme linje (f.eks. via bagveksler) gir varsel.
  - Smakslista lagres i eget bibliotek og følger med eksport/import.
- **Auto-koblinger:** når slange og port ikke passer direkte, velges riktig DMfit-overgang automatisk (grå acetal først). Den tegnes som et lite symbol ved enden.
  - Navnet viser dimensjon (f.eks. «Rett skjøt 3/8" – 1/2"»). Avkrysning «Koblingsstørrelser» øverst viser det fast på alle koblinger (også de man har lagt inn selv). Ellers vises det ved hover.
  - Klikk på symbolet for å velge Automatisk, Ingen, en rett eller en vinkel.
  - Der det ikke trengs kobling (slange rett i port), vises en stiplet ⊕ når slangen er valgt, så man kan legge på f.eks. vinkel med stamme.
  - Slange mot slange (pytonrør eller to åpne ender) gir alltid skjøt.
- **Fri slangeføring:**
  - Åpne slangeender, og løse slanger uten komponenter.
  - Fritt plasserte bøyer uten kobling.
  - Slangeender kan flyttes mellom porter (når slangen er valgt).
  - En ny slange som slippes på en eksisterende slange gir T-stykke.
  - Koblinger kan dras inn på en slange.
  - Åpen ende mot åpen ende gir skjøt eller reduksjon.
- **Pytonrør:** tykk svart linje. Enkeltslangene stikker ut i hver ende og kan trekkes fritt.
  - 2–10 produktslanger, stripete hvit + farge, hver med innhold (fritekst) og medium.
  - Kjøleloop: 2 × 1/2", én hvit og én svart. Kullsyrevann som standard, kan endres til vann.
- **Sammenheng:** klikk på et element, så lyser alt som er koblet til i sin egen farge (gjennom koblinger, utstyr med interne linjer og pytonrør). Tekst på slanger og koblinger i kretsen vises. Resten tones ned.
  - Klikk på én slange i pytonrør-enden: bare den kretsen. Klikk på selve røret: alt.
- **Klikk:** venstreklikk velger, høyreklikk åpner popup. Høyreklikk på et flervalg gir meny (lagre som blueprint, kopier, dupliser, roter, slett).
- **Popup:** høyreklikk på slange, komponent, pytonrør, strek/boks eller koblingssymbol. Legger seg ved siden av det som ble klikket, og kan dras. Medium kan velges for slanger og komponenter (porter uten fast medium).
- **Retning ut av port:** hver slangeende kan gå rett ut eller i 90° vinkel (opp/ned/venstre/høyre). Vinkelkobling velges automatisk, og en valgt vinkelkobling gir vinkel automatisk.
- **BIB-etikett:** smaken brukes som etikett.
- **Pytonrør-popup:** dimensjon på produktslanger og kjøleloop.
- **Kobling på pytonslange:** slipp kobling fra biblioteket ved slangeenden (snapper og roteres), eller dobbeltklikk slangen og velg.
- **Bibliotek:** kategori velges i editoren eller ved å dra komponenten til en kategori. Dimensjoner velges fra liste. Rekkefølgen på komponenter og kategorier kan dras og lagres i eget bibliotek.
- **Tegning:** strek og boks (hyller, benker, rom) med farge, fyll, stiplet og tekst. Ligger bak slanger og utstyr.
- **Symboler:** tekniske symboler.
- **Varsler:** feil medium eller manglende overgang markeres rødt, men koblingen er tillatt. Hvert varsel kan ignoreres med avkryssing: det forsvinner fra tegningen, men står grått i lista og kan slås på igjen. Varsler vises alltid til å begynne med.
- **Priser:** ikke med.
- **Eksport:** Excel og PDF/utskrift (A3/A4) med tittelfelt. Pytonrør-arket viser innhold og kjølemedium.

- **Blueprints:** valgte deler lagres som ferdig oppsett i eget bibliotek (navn og kategori). Settes inn som løse deler. Slanger ut av utvalget droppes, lengder nullstilles. Smaker, farger, navn, koblingsvalg og bøyer beholdes.

- **Drift-modus:** simulering av flyt. To nivåer: «fylt» (medium står der, f.eks. sirup fra BIB) og «trykk» (gassflaske, vanninntak, kompressor, fat med gass, pumpe med drivgass, kjøler som går). Det strømmer bare med trykk.
  - Utstyr med innganger går bare når alle innganger har trykk (pumpe: drivgass + sirup). Ellers «MANGLER …».
  - Postmixkjøler: vannet renner inn hele tiden når den går og kjøleloopen går rundt.
  - Kilder: BIB, fat, gassflaske, vanninntak, kompressor og kjøleloop.
  - Gjennomløp via interne linker.
  - Omforming: karbonator og kjøler lager kullsyrevann, gassblander, N₂-generator, og fat (øl krever gass).
  - Pumpe krever drivgass.
  - Bagveksler med valgt/aktiv bag og automatisk bytte når bagen er tom.
  - Forbrukere: åpne kraner, tårn-kraner, maskiner og avløp.
  - Lekkasje: åpne slangeender, ledige porter på koblinger og ledige slanger i pytonrør. Ledige porter på utstyr regnes som plugget.
  - Slanger vises som strømmer (animert, med retning), under trykk eller tom.
  - Tilstander lagres i node.data.sim.
- **Koblingsformer:** rett, vinkel, T, U, Y og håndventil uten størrelse (høyreklikkmeny og bibliotek). De får riktig DMfit-kobling (grå acetal først) når de kobles til slange, åpen ende eller port. Til da gir de varsel.
- **Bøyer:** slangen rutes automatisk. Egne bøyer legges til med dobbeltklikk og kan dras. Uten egne bøyer er slangen automatisk.
- **Tekst og status uten å dekke porter:** etiketten legges på første side uten porter (under, høyre, venstre, over). Statusbrikken i drift legges over, til høyre eller venstre (ikke samme side som etiketten), ellers utenfor øvre høyre hjørne. Ved hover blir brikken til bryter.
- **Gass og luft i drift:** slanger med bare gass/luft (CO₂, N₂, blandgass, trykkluft) vises som strømmende så lenge det står trykk fra kilden.
- **Bryter i drift:** hold musa over en komponent for å få en bryter (åpen/stengt, full/tom, på/av, Bag 1/2, én knapp per tårnkran). Vanlig klikk velger bare.
- **Ventil skiller medier:** kuleventil, stengeventil, tilbakeslagsventil og håndventil slår ikke sammen mediet på hver side (analyze i compat.ts, `isMediaBreak`). Brukes f.eks. ved rens: nettvann → ventil → T-stykke på sirup-/sodalinja. Uten ventil gir det fortsatt «Blandede medier». Sidene slås sammen når mediet er det samme (smaken følger med). En side uten eget medium hentes fra nabo bak åpen ventil; ved flere kandidater vinner linja med smak, så den som ikke er vann (`portMedium` i Analysis).
- **Medium i drift:** sim.ts sprer hvert medium fra kildene (gjennom slanger, åpne ventiler, pumper som går, bagveksler med aktiv bag og omforming i utstyr). Slangen tegnes i mediet som er i den (`edgeMedia`, `shownHose` i colors.ts). To medier i samme slange gir rød stiplet slange og varsel under «I drift» (`mixed`). Tilbakeslagsventil er enveis (Inn → Ut).
- **Drift-rolle per utstyr:** kan settes i editoren. Valgene er kilde med/uten trykk, beholder, pumpe, må ha drift, maskin, kran, avløp eller gjennomløp, pluss hvilke innganger som må ha noe for at det skal gå.
- **Portretning:** inn/ut/begge. Tolkes fra portnavn hvis ikke satt, og kan settes i editoren.

## Datamodell
- Komponent: navn, art.nr, produsent, kategori, symbol, størrelse og porter.
- Port: side, posisjon, type (push / stamme / gjenge / slangestuss / slangeende), dimensjon, gjengestandard og kjønn, medium og intern link.
- Slange: navn, type, dimensjon, medium (automatisk eller valgt), farge, lengde, om den telles, knekkpunkter og overstyring av kobling i hver ende.
- Pytonrør: antall, dimensjoner, farger, innhold og medium per slange, kjølemedium, lengde.
- Åpen slangeende: egen liten node i tegningen.
- Strek/boks: egen node (`shape`) med farge, fyll, stiplet, tykkelse og tekst.
- Prosjektfil: `.barflow` (JSON). Brukte komponenter og ignorerte varsler ligger i filen.
- Blueprint: navn, kategori, noder og slanger med relative posisjoner, pytonrør.
- Eget bibliotek: i nettleseren (HTML) eller `%APPDATA%\BarFlow\bibliotek.json` (Windows). Kan eksporteres/importeres.

## Kjente begrensninger
- Dimensjonene i startsett-utstyret er typiske verdier og må justeres til faktisk utstyr.
- DMfit-dataene er lest fra katalogen og kontrollert mot artikkelnumrene. Noen sjeldne familier kan ha forenklet portplassering.
- Regulatorer og gassfordelere i startsettet har nå intern link (for opplysing). Komponenter som allerede ligger i en tegning oppdateres med «Oppdater alle i tegningen» under Flere valg.

## Endringslogg
- **v0.12.1:** versjonsmerke i verktøylinja (BarFlow | v0.12.1, versjon i grønt, hentes fra package.json). Kildekoden legges i GitHub-repoet Norwace/BarFlow med ferdig BarFlow.html i roten.
- **v0.12:**
  - Etikett og status legges på side uten porter.
  - Status og bryter er samme brikke.
  - Gass og trykkluft strømmer alltid når kilden er på.
- **v0.11.1:** smaksfargen følger med gjennom ventiler (også i drift, der det vises smaken til bagen det trekkes fra).
- **v0.11:**
  - Slangene får fargen til mediet som faktisk er i dem i drift.
  - Varsel ved to medier i samme slange.
  - Tilbakeslagsventil er enveis.
  - Ventil uten medium på den ene siden arver fra den andre (ikke grått lenger).
- **v0.10:**
  - Bryter ved hover i drift i stedet for klikk.
  - Ventiler skiller medier (rens med nettvann på sodalinja uten varsel).
  - BIB-pumpe heter nå Pumpe (gamle tegninger og blueprints får nytt navn når de åpnes).
- **v0.9:**
  - Koblingsformer med automatisk størrelse.
  - Enklere bøyer (automatisk rute, egne punkter med dobbeltklikk).
  - Drift-rolle og behov i editoren.
  - Opplysing virker i drift.
  - Lysere trykkluft.
- **v0.8:**
  - Trykklogikk i drift: BIB trenger pumpe, og utstyr står uten gass/vann/luft/sirup.
  - Vann inn i postmixkjøler går hele tiden.
  - Høyreklikk på tomt sted gir innsettingsmeny med favorittslanger.
  - Dra hjørner og rette deler av slangen uten nye bøyer.
  - Delete virker på valgt slange.
  - Jevn animasjon i pytonrør, og tykkere pytonrør.
  - Mørk kant på trykkluft.
  - Utstyr øverst i biblioteket.
- **v0.7.1:** lekkasje og flyt også ut av ledige porter på koblinger og pytonslanger.
- **v0.7:** drift-modus med animasjon, kraner/ventiler, BIB full/tom, bagveksler. Portretning. Stripete pytonslanger, hvit/svart kjøleloop, kullsyrevann som standard.
- **v0.6:** høyreklikk åpner popup (venstreklikk velger), blueprints.
- **v0.5:** popup ved komponenten, BIB-etikett = smak, slange i vinkel ut av port, egen rekkefølge i biblioteket, dimensjon på pytonrør i popup.
- **v0.4:**
  - Bagveksler.
  - BIB-smaker med farge gjennom loopen.
  - Kullsyrevann turkis med grå prikker.
  - Ignorerte varsler står i lista.
  - Koblingsstørrelser på alle koblinger med av/på.
  - Opplysing i egen farge, enkeltslange i pytonrør, tekst vises i opplyst krets.
  - Flyttbar popup med medium.
  - Dimensjonslister og kategorier i editoren, og dra til kategori.
  - Kobling direkte på pytonslange.
- **v0.3:**
  - Kjølemedium (vann/kullsyrevann) og innhold/medium per slange i pytonrør.
  - Varsler kan ignoreres enkeltvis.
  - Auto-koblinger viser dimensjon ved hover, kan klikkes for å velge rett/vinkel/ingen.
  - Skjøt når to åpne ender dras sammen.
  - Opplysing av sammenhengende krets.
  - Fire nye slangefarger.
  - Popup for komponenter (roter, speil, etikett, bytt kobling).
  - Strek og boks.
  - Rettet: bøyer på slanger fulgte ikke med når en kopiert gruppe ble flyttet.
- **v0.2:** popup for slanger, åpne ender, bøyer, automatiske overganger, T ved avgrening, standardkoblinger, luftkompressor, HTML-versjon.
- **v0.1:** første versjon.

## Mulige neste steg
- Flere utstyrsprodusenter og kataloger
- Maler for vanlige oppsett
- Bilde av produktet på komponenter
