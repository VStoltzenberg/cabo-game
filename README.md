# CABO Online 🃏

Ein Live-Multiplayer-Kartenspiel basierend auf CABO. Spielbar im Browser und als iPhone-App (PWA).

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Framer Motion
- **Backend/Auth/DB**: Supabase (PostgreSQL + Realtime + Auth)
- **Deployment**: Vercel (Frontend) + Supabase (Backend)
- **PWA**: Installierbar auf iPhone via Safari

---

## 🚀 Schritt-für-Schritt Deployment (heute Abend)

### Schritt 1 – Supabase Projekt erstellen (10 min)

1. Gehe zu [supabase.com](https://supabase.com) → „Start your project"
2. Neues Projekt erstellen (Name: `cabo-online`, Region: EU)
3. Passwort notieren!
4. Warte bis das Projekt bereit ist (~2 min)
5. Gehe zu **SQL Editor** → Füge den kompletten Inhalt von `supabase/schema.sql` ein → „Run"
6. Gehe zu **Database → Replication → Tables** → Aktiviere `rooms` für Realtime
7. Gehe zu **Project Settings → API**:
   - Kopiere `Project URL` → das ist `VITE_SUPABASE_URL`
   - Kopiere `anon public` Key → das ist `VITE_SUPABASE_ANON_KEY`
8. Gehe zu **Authentication → URL Configuration**:
   - Site URL: `https://dein-projekt.vercel.app` (erst nach Vercel-Deploy anpassen)
   - Redirect URLs: `https://dein-projekt.vercel.app/**`

### Schritt 2 – GitHub Repository (5 min)

```bash
cd cabo-online

# .env Datei lokal anlegen (NICHT committen!)
cp .env.example .env
# Fülle VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY ein

git init
git add .
git commit -m "Initial commit: CABO Online"

# Auf GitHub: Neues Repo erstellen (z.B. cabo-online)
git remote add origin https://github.com/DEIN-USER/cabo-online.git
git branch -M main
git push -u origin main
```

### Schritt 3 – Vercel Deployment (5 min)

1. Gehe zu [vercel.com](https://vercel.com) → „Add New Project"
2. GitHub Repo `cabo-online` importieren
3. Framework: **Vite** (wird automatisch erkannt)
4. **Environment Variables** hinzufügen:
   - `VITE_SUPABASE_URL` = deine Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = dein Supabase Anon Key
5. „Deploy" klicken
6. Nach ~2 min: Deine URL ist z.B. `https://cabo-online.vercel.app`

### Schritt 4 – Supabase URL aktualisieren (2 min)

1. Zurück zu Supabase → **Authentication → URL Configuration**
2. Site URL auf deine Vercel-URL setzen: `https://cabo-online.vercel.app`
3. Redirect URLs: `https://cabo-online.vercel.app/**`

### Schritt 5 – iPhone Installation (1 min)

1. Öffne Safari auf dem iPhone (kein Chrome/Firefox!)
2. Gehe zu `https://cabo-online.vercel.app`
3. Tippe auf **Teilen** (Box mit Pfeil nach oben)
4. Wähle **„Zum Home-Bildschirm"**
5. Fertig! CABO hat jetzt ein App-Icon 🎉

---

## 🎮 Spielanleitung (Kurzversion)

### Vorbereitung
- Jeder Spieler erhält 4 verdeckte Karten
- Schau dir zu Beginn **2 deiner eigenen Karten** an (tippe drauf)
- Drücke „Bereit" wenn du dir die Karten gemerkt hast

### Spielablauf (reihum)
1. **Karte ziehen** – vom Nachziehstapel ODER von der Ablage
2. **Entscheiden**:
   - Gezogene Karte **behalten** → eine eigene Karte damit ersetzen (die ersetzte geht auf die Ablage)
   - Gezogene Karte **abwerfen** → Sonderaktion ausführen (falls 7-12)

### Sonderaktionen (nur bei Karten vom Nachziehstapel)
| Karte | Aktion | Beschreibung |
|-------|--------|--------------|
| 7, 8 | **Peek** 👁️ | Schau dir eine eigene Karte an |
| 9, 10 | **Spy** 🔍 | Schau dir eine Karte des Gegners an |
| 11, 12 | **Swap** 🔄 | Tausche eine eigene mit einer gegnerischen Karte |

### CABO rufen
- Wenn du glaubst die niedrigste Summe zu haben: **CABO!** rufen
- Der Gegner hat noch **einen letzten Zug**
- Dann werden alle Karten aufgedeckt und Punkte gezählt

### Punkte
- Jeder Spieler addiert die Werte seiner Karten
- **CABO-Rufer hat höhere Summe**: +5 Strafpunkte
- **Gleichstand**: CABO-Rufer bekommt +5 Strafpunkte
- Bei genau 100 Punkten: Gesamtpunkte auf 50 reduziert ✨
- **Wer zuerst 100 Punkte erreicht verliert** – niedrigste Summe gewinnt!

### Kartenwerte
```
0  = Einhorn 🦄      7  = Koi 🐟 (Peek)
1  = Blatt 🍂        8  = Oktopus 🐙 (Peek)  
2  = Splash ✨        9  = Mäuse 🐭 (Spy)
3  = Spargel 🌿      10 = Hut 🎩 (Spy)
4  = Vögel 🐦        11 = Fuchs 🦊 (Swap)
5  = Schmetterlinge 🦋 12 = Geo 💎 (Swap)
6  = Spy 🥸          13 = Rakete 🌈
```

---

## 🔧 Lokale Entwicklung

```bash
npm install
cp .env.example .env
# .env befüllen mit Supabase Keys

npm run dev
# → http://localhost:5173
```

---

## 📁 Projektstruktur

```
cabo-online/
├── src/
│   ├── components/
│   │   └── Card.tsx          # Karten-Rendering
│   ├── game/
│   │   └── engine.ts         # Komplette Spiellogik
│   ├── pages/
│   │   ├── Login.tsx         # Anmelden / Registrieren
│   │   ├── Lobby.tsx         # Raum erstellen / beitreten
│   │   └── Game.tsx          # Spielfeld
│   ├── lib/
│   │   └── supabase.ts       # Supabase Client
│   ├── types/
│   │   └── game.ts           # TypeScript Typen
│   ├── App.tsx               # Routing + Auth Guard
│   ├── main.tsx              # Entry Point
│   └── index.css             # Styles
├── supabase/
│   └── schema.sql            # Datenbankschema → In Supabase ausführen
├── .env.example              # Vorlage für Umgebungsvariablen
├── vite.config.ts            # Vite + PWA Konfiguration
└── README.md
```

---

## ⚠️ Wichtige Hinweise

- `.env` Datei **niemals** in Git committen! (bereits in .gitignore)
- Das Spiel ist nur für **privaten Gebrauch** gedacht
- Supabase Free Tier ist für zwei Spieler völlig ausreichend
- Realtime Updates funktionieren über Supabase Postgres Changes

---

## 🐛 Häufige Probleme

**"Supabase URL fehlt"** → `.env` Datei nicht angelegt oder Keys falsch eingefügt

**Realtime funktioniert nicht** → In Supabase: Database → Replication → `rooms` Tabelle aktivieren

**Login funktioniert nicht nach Deployment** → Supabase Authentication → Site URL auf Vercel-Domain setzen

**iPhone App zeigt keine Updates** → Service Worker Cache leeren: Einstellungen → Safari → Verlauf löschen
