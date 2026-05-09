"""
import_all_supabase.py — Importe prospects_colixo_all.csv dans Supabase
"""

import pandas as pd
import requests
import json
import time
from datetime import datetime

SUPABASE_URL = "https://iubbsnntcreneakbdkmv.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

CSV_PATH = "/Users/didiergysling/swissbill/prospection/prospects_colixo_all.csv"
BATCH    = 50

def s(val):
    if val is None: return None
    v = str(val).strip()
    return None if v.lower() in ("nan", "", "none") else v

def score_classe(score):
    if score >= 80: return "hot"
    if score >= 60: return "warm"
    if score >= 40: return "neutral"
    return "cold"

def message_connexion(row):
    entreprise = s(row.get("entreprise")) or "votre entreprise"
    ville      = s(row.get("ville"))
    secteur    = s(row.get("label_categorie")) or "votre secteur"
    loc        = f" à {ville}" if ville else ""
    return (
        f"Bonjour,\n\n"
        f"Je représente Colixo, service de livraison express B2B en Suisse romande. "
        f"Votre activité dans le domaine {secteur}{loc} pourrait bénéficier de notre offre — "
        f"délais J+1, suivi en temps réel, sans engagement.\n\n"
        f"Seriez-vous disponible pour un bref échange cette semaine ?\n\nBien cordialement,\nColixo"
    )

def to_payload(row):
    score  = int(float(row.get("score_colixo") or 0))
    now    = datetime.utcnow().isoformat() + "Z"
    canton = s(row.get("canton")) or ""
    osm    = s(row.get("osm_id")) or ""
    adr    = " ".join(filter(None, [s(row.get("adresse")), s(row.get("postcode"))]))
    parts  = [f"Canton : {canton}" if canton else "",
              f"Catégorie OSM : {s(row.get('tag_osm',''))}" if s(row.get("tag_osm")) else "",
              f"OSM : {osm}" if osm else "",
              f"Adresse : {adr}" if adr else ""]
    notes = " | ".join(p for p in parts if p) or None

    sous_cat = s(row.get("sous_categorie")) or ""
    label    = s(row.get("label_categorie")) or s(row.get("categorie")) or "Autre"
    secteur  = f"{label} / {sous_cat.replace('_',' ').title()}" if sous_cat else label

    return {
        "entreprise":        s(row.get("entreprise")),
        "ville":             s(row.get("ville")),
        "secteur":           secteur,
        "site_web":          s(row.get("site_web")),
        "email":             s(row.get("email")),
        "telephone":         s(row.get("telephone")),
        "besoin_detecte":    s(row.get("besoin_detecte")),
        "angle_commercial":  s(row.get("angle_commercial")),
        "notes":             notes,
        "statut":            "nouveau",
        "score":             score,
        "score_classe":      score_classe(score),
        "message_connexion": message_connexion(row),
        "created_at":        now,
        "updated_at":        now,
    }

def insert_batch(rows):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/prospects",
        headers=HEADERS,
        data=json.dumps(rows),
        timeout=30,
    )
    if r.status_code not in (200, 201):
        print(f"\n  ✗ HTTP {r.status_code} : {r.text[:150]}")
        return 0
    return len(rows)

def main():
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
    print(f"📂 {len(df)} prospects à importer…\n")

    payloads = [to_payload(row) for _, row in df.iterrows()
                if s(row.get("entreprise"))]

    total = len(payloads)
    ok    = 0

    for i in range(0, total, BATCH):
        batch   = payloads[i:i + BATCH]
        fin     = min(i + BATCH, total)
        pct     = int(fin / total * 100)
        print(f"  Lot {fin}/{total} ({pct}%)…", end=" ", flush=True)
        ok += insert_batch(batch)
        print("✓")
        time.sleep(0.4)

    print(f"\n✅ {ok} / {total} prospects insérés dans Supabase.")

if __name__ == "__main__":
    main()
