# Enarea – funksjonsnotat (supplement)

Notater fra planleggingssamtale. Dette er et tillegg til eksisterende app, ikke en full spesifikasjon fra bunnen av.

## 1. Kjernekonsept: Bygningsdel

Appen er bygget rundt konseptet **Bygningsdel**. Brukeren kan opprette egne typer, f.eks.:

- Yttervegg, Yttervegg type 1, Yttervegg type 2
- Vindu type A, Vindu type B
- Ytterdør
- Tak
- Gulv på grunn, Gulv mot friluft, Gulv mot oppvarmet areal, Gulv mot uoppvarmet areal
- Dekke

Brukeren skal fritt kunne opprette nye typer utover disse eksemplene.

### 1a. To lag: bibliotek vs. prosjekt (lagt til etter implementering av bygningsdeltype-biblioteket)

Det globale biblioteket (siden `/bygningsdeltyper`, implementert) fungerer som en **mal** — et sted å definere standardverdier én gang (f.eks. "Yttervegg type 1" med en gitt U-verdi/veggtykkelse).

Inne i et enkelt prosjekt trengs i tillegg en **prosjektspesifikk liste** over hvilke bygningsdeltyper som faktisk er i bruk i akkurat det prosjektet. Denne listen bygges ved å "hente" (importere) typer fra det globale biblioteket:

- Når en type hentes inn i et prosjekt, kopieres verdiene inn som et **uavhengig snapshot** — prosjektets kopi kan justeres videre (f.eks. en litt annen U-verdi for akkurat denne bygningen) uten at det globale biblioteket eller andre prosjekter påvirkes.
- Redigeringsverktøyets vegg-/gulvtype-meny (se punkt 2) skal vise **prosjektets egen liste**, ikke hele det globale biblioteket direkte — brukeren velger først hvilke typer som er relevante for prosjektet, deretter brukes de på konkrete vegger/gulv via redigeringsverktøyet.

## 2. Redigeringsverktøy (annotasjoner)

- Dagens "vegg-verktøy" bør generaliseres til ett **felles verktøy for å redigere alle markeringer/annotasjoner** (ikke bare vegger).
- I dette verktøyet:
  - Klikk på streken til en figur → gjør den til vegg.
  - Klikk på en strek som allerede er markert som vegg → meny dukker opp under veggen der brukeren velger veggtype.
  - Samme mønster skal gjelde for **gulvareal**: velg/endre gulvtype via samme redigeringsverktøy.

## 3. Himmelretning

- Brukeren definerer nord **én gang**, f.eks. ved å rotere et kompass i UI.
- Alle yttervegger får automatisk himmelretning (N, NØ, Ø, SØ, S, SV, V, NV) basert på dette.
- Vinduer og dører **arver** himmelretning fra ytterveggen de sitter på.

### Foreslått algoritme for veggretning

Når en strek markeres som (utvendig) vegg, skal himmelretningen beregnes automatisk ut fra hvilken vei veggens "flate" (normalvektor) peker:

1. For streken A→B: retningsvektor `d = B - A`.
2. To normalkandidater: `n1 = (-d.y, d.x)` og `n2 = (d.y, -d.x)`.
3. Finn bygningens sentroide (gjennomsnitt av alle punkter i polygonet). Ta prikkprodukt mellom hver normalkandidat og `(midtpunkt_på_streken − sentroide)`. Normalen med **positivt** prikkprodukt peker utover — det er den riktige.
   - Denne metoden er valgt fremfor vindingsretning-baserte formler fordi den er robust uansett tegneretning og koordinatsystem (skjerm-Y er ofte snudd ift. matematisk konvensjon).
4. Regn vinkel med `atan2(n.y, n.x)`, juster for nord-offset satt av brukeren, snap til nærmeste av 8 sektorer (45° hver).
5. Cache normalen per veggstrek; regn bare om kompassretningen (offset) på nytt når brukeren roterer nord — ikke hele geometrien.

**Kjent begrensning:** svært konkave bygningsformer (dype innhakk) kan i sjeldne tilfeller gi upresis sentroide-basert normalretning.

## 4. Formål: bindeledd til Simien

Appen skal fungere som **bindeledd mellom oppmerking på PDF (rådata) og energimerkeprogrammet Simien**. Målet er at geometri/typedata tegnet inn i Enarea skal kunne eksporteres til Simien for energiberegning/energimerking.

### Hva Simien trenger (kartlagt via research)

**Per bygningsdel:**
- Areal [m²] per type (yttervegg, tak, gulv, vinduer/dører)
- U-verdi [W/m²K] per type
- Himmelretning (for solinnstråling)
- Normalisert kuldebroverdi [W/m²K]

**På bygningsnivå:**
- Oppvarmet bruksareal (BRA) [m²]
- Oppvarmet luftvolum [m³]
- Lekkasjetall (n50) [1/h]
- Normalisert varmekapasitet [Wh/m²K]

**Tekniske systemer (utenfor bygningskropp, men nødvendig for full beregning):**
- Ventilasjon: luftmengder, temperaturvirkningsgrad varmegjenvinner, SFP
- Oppvarming/kjøling: systemvirkningsgrad (maks 0,98 ved energimerking)
- Internlaster: belysning, teknisk utstyr, personer, varmtvann

**Format:** Fra 2026 kreves Simien PRO (Simien 6 blir ugyldig for energimerking), og innsending til Enova skjer i JSON i stedet for XML.

### Hva som kan hentes fra plantegning vs. må komme fra typebibliotek

**Kan hentes fra geometri i plantegningen:**
- Gulvareal per rom/sone, veggareal (lengde), vindus-/dørareal (hvis dimensjonert)
- Himmelretning (via kompasset)
- Oppvarmet BRA (sum av gulvarealer)
- Rominndeling, hvilke vegger som er yttervegg vs. innervegg
- Antall/plassering av vinduer og dører

**Må komme fra type-bibliotek/manuell input (kan IKKE leses fra selve tegningen):**
- U-verdier
- Lekkasjetall (n50)
- Kuldebroverdi
- Ventilasjonsdata (SFP, gjenvinnervirkningsgrad)
- Systemvirkningsgrad oppvarmingsanlegg

**Foreslått mønster:** Siden brukeren allerede definerer typer (f.eks. "Yttervegg type 1"), bør U-verdi, kuldebroverdi m.m. knyttes til *typen* i et lite bibliotek — alle vegger av den typen arver verdiene automatisk. Samme "arve fra type"-prinsipp som allerede brukes for himmelretning (vindu arver fra vegg).

### Flere verdier som kan utledes med litt tilleggsinfo på typenivå

Med etasjehøyde + vindus-/dørtyper lagt inn:

- **Netto veggareal** = veggens lengde × høyde − sum(vindus-/dørareal på den veggen)
- **Oppvarmet luftvolum** = BRA × himhøyde
- **Total BRA for bygg med flere etasjer**
- **Vindus-/dørareal gruppert per himmelretning** (siden himmelretning allerede arves) — brukes til Simien/TEK-kravet "andel vindus-/dørareal av BRA ≤ 25 %"
- **Kuldebrolengder**: normalisert kuldebroverdi i Simien er i praksis `Σ(Ψ-verdi × lengde)` per kuldebrotype (vegg-tak, vegg-gulv, vindu-omkrets). Kantlengdene finnes allerede i geometrien — trenger bare en Ψ-verdi [W/mK] per kuldebrotype, samme mønster som U-verdi.
- **Kompakthetstall/formfaktor** (uteareal / oppvarmet volum) — nyttig sanity-sjekk mot Simien-resultat

**Viktig fallgruve:** Om plantegningen måler til utvendig kant, senterlinje eller innvendig kant av vegg, påvirker om utregnet areal blir brutto eller netto BRA (Simien/NS3031 har definerte målemetoder). Anbefaling: legg veggtykkelse inn som egenskap på veggtypen (sammen med U-verdi), slik at konvertering mellom målemetoder kan gjøres automatisk.
