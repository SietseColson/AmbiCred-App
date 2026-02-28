1. De Stack (De gereedschappen)
Database: Supabase (Kies voor de gratis tier). Hier maak je een tabel credits met kolommen id, naam (text) en saldo (int).

Frontend: HTML5, CSS3 (voor styling) en Vanilla JavaScript (voor de logica).

Hosting: GitHub Pages of Netlify (Gratis & biedt de benodigde HTTPS).

App-status: PWA (Manifest + Service Worker) zodat hij op het startscherm van je vrienden kan.



2. Stappenplan voor de uitvoering
Fase A: Database opzetten
Maak een account op Supabase.

Maak een nieuw project aan.

Ga naar de Table Editor en maak de tabel credits.

Zet de RLS (Row Level Security) uit voor testdoeleinden, of voeg een simpele 'anon' policy toe zodat iedereen kan lezen/schrijven.

Kopieer je Project URL en anon key bij de instellingen.


Fase B: De Code bouwen
index.html: Bevat je tabel, invoervelden voor namen/punten en de <script> tag naar de Supabase JS Library.

app.js: Gebruik fetch of de Supabase client om data op te halen en de DOM bij te werken.

manifest.json: Essentieel om van je site een app te maken (icoon, naam, kleuren).

sw.js: Een (simpele) Service Worker om aan de PWA-eisen te voldoen.


Fase C: Online zetten & Installeren
Upload je bestanden naar GitHub of Netlify.

Open de gegenereerde link (bijv. jouwnaam.github.io/credit-app) op je telefoon.

Op iPhone: Tik op de Deel-knop (vierkant met pijl omhoog) -> Zet op beginscherm.

Op Android: Tik op de drie puntjes -> App installeren.



3. Onthoud deze "Golden Rules"
HTTPS is verplicht: Zonder beveiligde verbinding werkt de "Zet op beginscherm" functie niet als app.

Manifest & Icons: Zorg dat je een icon-192.png en icon-512.png hebt, anders herkent de iPhone het niet als een installeerbare app.

No Python Needed: Je JS praat direct met de Supabase API via de supabase.createClient() functie.



4. Nuttige links voor later
Supabase Quickstart JS – Hoe je de database koppelt.
PWA Manifest Generator – Tool om je manifest.json en iconen makkelijk te maken.