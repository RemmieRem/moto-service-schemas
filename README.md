# moto-service-schemas

Bibliotheek met onderhoudsschema's per motormodel voor de Android-app **Moto Service Check**.

Voeg je in de app een motor toe op kenteken, dan zoekt de app hier een schema dat past bij merk, type en bouwjaar van die motor. Staat er een, dan krijgt de motor de intervallen uit de handleiding van de fabrikant in plaats van een algemeen schema. Komt er later een schema bij, of wordt een schema verbeterd, dan biedt de app dat zelf aan.

- **Alleen intervallen en bronvermelding.** Handleidingen zelf staan hier nooit; die zijn van de fabrikant.
- **De app stuurt niets hierheen.** Hij downloadt alleen de openbare lijst (`index.json`) en het gekozen schema, en vergelijkt op de telefoon. Er gaat geen kenteken of ander gegeven naar buiten.
- **Geen app-update nodig.** Een nieuw of verbeterd schema is beschikbaar zodra het hier op `main` staat.

## Opbouw

```
index.json              lijst van alle schema's en bij welke motoren ze horen
schemas/<id>.json       één schema per motormodel (formaat moto-service-schema, versie 1)
scripts/controleer.mjs  controle van index en schema's (draait bij elke push)
```

## index.json

```json
{
  "formaat": "moto-service-bibliotheek",
  "versie": 1,
  "schemas": [
    {
      "id": "yamaha-mt07-2021",
      "naam": "Yamaha MT-07 (2021–2024)",
      "merk": "YAMAHA",
      "typen": ["MT07", "MT-07", "MT 07"],
      "bouwjaarVan": 2021,
      "bouwjaarTot": 2024,
      "bestand": "schemas/yamaha-mt07-2021.json",
      "schemaVersie": 1
    }
  ]
}
```

| Veld | Verplicht | Uitleg |
| --- | --- | --- |
| `id` | ja | Uniek, kleine letters, cijfers en streepjes. Verandert nooit: de app onthoudt welk schema een motor gebruikt. |
| `naam` | ja | Zoals de gebruiker het ziet, met bouwjaren. |
| `merk` | ja | Het merk zoals de RDW het noemt (veld `merk`). |
| `typen` | ja | Eén of meer typenamen zoals de RDW ze noemt (veld `handelsbenaming`), plus varianten die je tegenkomt. |
| `bouwjaarVan` | ja | Eerste bouwjaar (jaar van eerste toelating) waarvoor het schema geldt. |
| `bouwjaarTot` | ja | Laatste bouwjaar, of `null` als het nog steeds geldt. |
| `bestand` | ja | Pad naar het schema, relatief aan deze repo. |
| `schemaVersie` | ja | Geheel getal vanaf 1. **Verhoog bij elke inhoudelijke verbetering van het schema**; de app biedt de nieuwe versie dan aan bij motoren die het oude gebruiken. |

## Hoe de app een schema kiest

Deze regel geldt voor de controle hier én voor de app (story #92). Houd ze gelijk.

1. **Normaliseren.** Merk en type worden vergeleken in hoofdletters, zonder accenten en zonder alles wat geen letter of cijfer is. `MT-07`, `mt 07` en `MT07` zijn dus gelijk (`MT07`), net als `Moto Guzzi` en `MOTO-GUZZI` (`MOTOGUZZI`).
2. **Merk** moet gelijk zijn, en **type** moet gelijk zijn aan een van de `typen`.
3. **Bouwjaar** (jaar van eerste toelating bij de RDW) moet tussen `bouwjaarVan` en `bouwjaarTot` liggen, grenzen inbegrepen; `null` als tot-jaar betekent "tot nu". Is het bouwjaar van de motor onbekend, dan tellen alle schema's van dat merk en type mee.
4. Passen er meerdere, dan kiest de gebruiker. Daarom mogen schema's van hetzelfde merk en type **geen overlappende bouwjaren** hebben (de controle bewaakt dat).

## Een schema

Hetzelfde formaat als de import in de app (`moto-service-schema`, versie 1); zie `docs/schema-formaat.md` in de app-repo. Kort:

```json
{
  "formaat": "moto-service-schema",
  "versie": 1,
  "naam": "Yamaha MT-07 (2021–2024)",
  "bron": "Yamaha MT-07 gebruikershandleiding 2021, hoofdstuk Periodiek onderhoud, p. 7-3 t/m 7-6",
  "onderdelen": [
    { "code": "olie", "naam": "Motorolie + oliefilter", "actie": "vervangen", "intervalKm": 10000, "intervalMaanden": 12, "bron": "p. 7-4" }
  ]
}
```

- Gebruik waar het kan de `code` uit het standaardschema van de app (`olie`, `klepspeling`, `remvloeistof`, …), zodat het bij het juiste bestaande onderdeel terechtkomt.
- Elk onderdeel krijgt een `bron` met paginanummer.
- Kilometer- én tijdsinterval ("wat het eerst komt"): vul beide in. Noemt de handleiding er een niet, dan `null`. Niets verzinnen.
- Noemt de handleiding naast vervangen ook een **controle** (bijvoorbeeld bougies: controleren elke 6.000 km, vervangen elke 12.000 km), zet dan `controleKm` en/of `controleMaanden` bij hetzelfde onderdeel. Zelfde regels als `intervalKm` en `intervalMaanden`; beide mogen ontbreken.
- Optioneel: `veiligheidskritisch` (`true` of `false`) en, bij geschatte schema's, `zekerheid` (`"zeker"` of `"waarschijnlijk"`). Bij een schema uit een handleiding laat je `zekerheid` weg.

## Controle

`node scripts/controleer.mjs` controleert alle schema's met dezelfde regels als de import in de app, en de index: bestanden bestaan, id's uniek, verplichte velden, en geen overlappende bouwjaren voor hetzelfde merk en type. Draait automatisch bij elke push en pull request.

## Nieuwe aanvraag

Aanvragen lopen via de product owner, in de app-repo met het issuetemplate **Schema-aanvraag**. Claude maakt het schema volgens de werkwijze in de `CLAUDE.md` van de app-repo en zet het hier neer.
