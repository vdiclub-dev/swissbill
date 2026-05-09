"""
import_supabase.py — Importe prospects_vin_suisse_romande.csv dans Supabase (table prospects)
"""

import pandas as pd
import requests
import json
import time
from datetime import datetime

# ── Credentials Supabase ──────────────────────────────────────────
SUPABASE_URL  = "https://iubbsnntcreneakbdkmv.supabase.co"
SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

CSV_PATH = "/Users/didiergysling/swissbill/prospection/prospects_vin_suisse_romande.csv"
BATCH    = 50   # lignes par requête

# ── Score Colixo → classe ─────────────────────────────────────────
def score_classe(score):
    if score >= 80: return "hot"
    if score >= 60: return "warm"
    if score >= 40: return "neutral"
    return "cold"

# ── Message connexion LinkedIn / email générique ──────────────────
def message_connexion(row):
    entreprise = row.get("entreprise") or "votre entreprise"
    ville      = f" à {row['ville']}" if row.get("ville") else ""
    return (
        f"Bonjour,\n\n"
        f"Je représente Colixo, service de livraison express B2B en Suisse romande. "
        f"Votre activité dans le domaine vin / viticulture{ville} pourrait bénéficier de notre offre — "
        f"délais J+1, suivi en temps réel, sans engagement.\n\n"
        f"Seriez-vous disponible pour un bref échange cette semaine ?\n\n"
        f"Bien cordialement,\nColixo"
    )

def message_email(row):
    entreprise = row.get("entreprise") or "votre domaine"
    return (
        f"Objet : Livraison de vos cartons de vin en Suisse romande\n\n"
        f"Madame, Monsieur,\n\n"
        f"Je me permets de vous contacter au nom de Colixo, prestataire logistique spécialisé "
        f"dans la livraison de cartons en Suisse romande.\n\n"
        f"{entreprise} correspond exactement à notre cœur de cible : domaines viticoles, caves "
        f"et cavistes souhaitant livrer leurs clients, restaurants ou points de vente de manière "
        f"souple et régulière.\n\n"
        f"Nos atouts : réactivité J+1, suivi en temps réel, tarifs adaptés aux volumes viticoles.\n\n"
        f"Seriez-vous disponible pour un court échange ?\n\n"
        f"Cordialement,\nColixo — info@colixo.ch"
    )

# ── Nettoyage valeur (gère NaN pandas) ───────────────────────────
def s(val):
    if val is None: return None
    v = str(val).strip()
    return None if v.lower() in ("nan", "", "none") else v

# ── Transformer une ligne CSV → payload Supabase ──────────────────
def to_payload(row):
    score = int(float(row.get("score_colixo") or 0))
    now   = datetime.utcnow().isoformat() + "Z"

    canton = s(row.get("canton")) or ""
    osm_id = s(row.get("osm_id")) or ""
    adresse = " ".join(filter(None, [s(row.get("adresse")), s(row.get("postcode"))]))
    notes_parts = [f"Canton : {canton}" if canton else "",
                   f"OSM : {osm_id}"     if osm_id  else "",
                   f"Adresse : {adresse}" if adresse else ""]
    notes = " | ".join(p for p in notes_parts if p) or None

    sous_cat = s(row.get("sous_categorie")) or ""

    p = {
        "entreprise":        s(row.get("entreprise")),
        "ville":             s(row.get("ville")),
        "secteur":           f"Vin / {sous_cat.replace('_', ' ').title()}" if sous_cat else "Vin",
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
    return p

# ── Insertion par batch ───────────────────────────────────────────
def insert_batch(rows):
    url = f"{SUPABASE_URL}/rest/v1/prospects"
    resp = requests.post(url, headers=HEADERS, data=json.dumps(rows), timeout=30)
    if resp.status_code not in (200, 201):
        print(f"  ✗ Erreur HTTP {resp.status_code} : {resp.text[:200]}")
        return False
    return True

# ── Main ──────────────────────────────────────────────────────────
def main():
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
    print(f"📂 {len(df)} prospects à importer…\n")

    payloads = [to_payload(row) for _, row in df.iterrows()
                if (row.get("entreprise") or "").strip()]

    total = len(payloads)
    ok = 0

    for i in range(0, total, BATCH):
        batch = payloads[i:i + BATCH]
        num_fin = min(i + BATCH, total)
        print(f"  Lot {i+1}–{num_fin} / {total}…", end=" ", flush=True)
        if insert_batch(batch):
            ok += len(batch)
            print("✓")
        time.sleep(0.5)

    print(f"\n✅ {ok} / {total} prospects insérés dans Supabase.")

if __name__ == "__main__":
    main()
