# Zestawienia materiałów dla wykonawców

Aplikacja webowa do udostępniania kosztorysów i zestawień materiałów wykonawcom budowlanym.
Admin wgrywa PDF z NormaWExpert, wykonawcy przeglądają dane przez przeglądarkę.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **SQLite** + **better-sqlite3** — baza plikowa `data/database.sqlite`
- **pdf-parse** — ekstrakcja tekstu z PDF
- **Tailwind CSS** — stylowanie
- **bcryptjs** + **jose** — autentykacja JWT w httpOnly cookies
- **Deploy**: LXC Debian 12 na Proxmox + PM2 + Cloudflare Tunnel

## Uruchamianie

```bash
npm run dev      # development: http://localhost:3000
npm run build
npm start        # production
```

Seed admina (pierwsze uruchomienie):
```bash
npx tsx src/scripts/seed.ts
```

## Struktura bazy danych

```
users             id, email, password_hash, name, role ('admin'|'contractor')
projects          id, title, client_name, address, investor, contractor_name, created_at
project_versions  id, project_id, version_number, uploaded_at, notes,
                  total_netto, vat_rate, vat_amount, total_brutto,
                  materials_file_name, estimate_file_name
project_access    project_id, user_id
materials         id, version_id, lp, index_code, name, unit, total_qty, unit_price, total_value
material_depts    id, material_id, dept_number, dept_name, sub_dept_number, sub_dept_name, qty, value
cost_chapters     id, version_id, number, name, order_index, total_netto
cost_items        id, version_id, chapter_id, lp, knr, name, unit, qty, unit_price, total_value_netto
```

## Dwa typy PDF z NormaWExpert

**Typ A — Zestawienie materiałów** (`Materiały_*.pdf`):
- Zawiera sekcję `"Szczegółowe zestawienie materiałów w działach"`
- Materiały pogrupowane wg działów (np. 1. Roboty betonowe, 4.1 Konstrukcja dachu)
- Parser szuka markera sekcji, potem parsuje bloki: Lp. | indeks | nazwa → linie działów → RAZEM

**Typ B — Kosztorys ofertowy** (`R_*.pdf`):
- Zawiera metadane: NAZWA INWESTYCJI, ADRES, INWESTOR, WYKONAWCA, DATA, wartości netto/brutto
- Zawiera pozycje: Lp. | KNR | Opis | j.m. | Ilość | Cena jedn. | Wartość
- Pogrupowane wg rozdziałów (działów)
- Auto-detekcja: szukamy `"KOSZTORYS OFERTOWY"` lub `"Zestawienie materiałów"` w tekście

## Funkcje aplikacji

### Admin
- Login → panel z listą projektów (tytuł, inwestor, data, wartość brutto, wersja)
- Nowy projekt: upload Typ B (metadane) + Typ A (materiały) → podgląd → zapis
- Historia wersji projektu (każdy upload = nowa wersja, stare zostają)
- Zarządzanie dostępem: przypisz wykonawcę(ów) do projektu
- Zarządzanie użytkownikami: dodaj/usuń wykonawcę

### Wykonawca
- Login → lista przypisanych projektów
- Widok projektu — 3 zakładki:
  1. **Materiały** — accordion wg działów: Lp | Nazwa | j.m. | Ilość | Cena | Wartość
  2. **Kalkulator oferty** — checkboxy przy pozycjach, live suma netto/VAT/brutto, przycisk "Drukuj ofertę"
  3. **Porównaj wersje** — diff między wersjami: zielone (dodane), czerwone (usunięte), żółte (zmienione)

### Drukowanie (print CSS)
Format oficjalny KOSZTORYS OFERTOWY:
- Nagłówek z metadanymi projektu
- Tabele rozdziałów z pozycjami
- Podsumowanie netto / VAT / brutto
- Odznaczone pozycje — niewidoczne w druku

## Środowisko (.env.local)

```
JWT_SECRET=<losowy_string_min_32_znaki>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<haslo>
DATABASE_PATH=./data/database.sqlite
```

## Sample PDFy (do testowania parsera)

```
Sample/Materiały_Stołówka_Żelbet_WisłaStart_W.Legierski.pdf  ← Typ A, 41 pozycji
Sample/R_Piwnice_Koniaków_Kolenda_18.03.2026.pdf              ← Typ B, kosztorys ofertowy
```

Weryfikacja: po uploadzie Typ A powinny być 41 materiałów, poprawnie przypisanych do działów (1, 2, 3, 4, 4.1, 4.2, 4.3).

## Deploy (skrót)

Pełna instrukcja: `DEPLOY.md`

1. LXC Debian 12 na Proxmox (2 vCPU, 2GB RAM, 20GB NVMe)
2. Node.js 20 LTS + PM2
3. Cloudflare Tunnel (po zakupie domeny)
4. Backup `data/database.sqlite` → dysk 2TB USB (`/dev/sda1`)

Nie przechowujemy oryginalnych PDFów — tylko sparsowane dane w SQLite.
