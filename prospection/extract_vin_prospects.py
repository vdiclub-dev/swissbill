import requests
import pandas as pd
import time
import re

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

HEADERS = {
    "User-Agent": "ColixoProspectionVin/1.0 contact: info@colixo.ch"
}

CANTONS = {
    "Vaud": "46.187,6.027,46.984,7.249",
    "Geneve": "46.120,5.956,46.350,6.331",
    "Fribourg": "46.384,6.747,47.066,7.437",
    "Neuchatel": "46.827,6.431,47.170,7.160",
    "Valais": "45.817,6.770,46.654,8.478",
    "Jura": "47.150,6.800,47.610,7.560",
}

KEYWORDS = ["cave", "domaine", "vigneron", "encaveur", "vin", "winery"]

def build_query(bbox):
    return f"""
    [out:json][timeout:60];
    (
      node["craft"="winery"]({bbox});
      way["craft"="winery"]({bbox});
      relation["craft"="winery"]({bbox});

      node["shop"="wine"]({bbox});
      way["shop"="wine"]({bbox});
      relation["shop"="wine"]({bbox});

      node["amenity"="winery"]({bbox});
      way["amenity"="winery"]({bbox});
      relation["amenity"="winery"]({bbox});

      node["tourism"="wine_cellar"]({bbox});
      way["tourism"="wine_cellar"]({bbox});
      relation["tourism"="wine_cellar"]({bbox});
    );
    out center tags;
    """

def clean(value):
    if not value:
        return ""
    return str(value).strip()

def get_city(tags):
    return (
        tags.get("addr:city")
        or tags.get("is_in:city")
        or tags.get("addr:municipality")
        or ""
    )

def get_address(tags):
    street = tags.get("addr:street", "")
    number = tags.get("addr:housenumber", "")
    return f"{street} {number}".strip()

def classify(tags):
    if tags.get("craft") == "winery":
        return "vin", "domaine_viticole"
    if tags.get("shop") == "wine":
        return "vin", "caviste"
    if tags.get("tourism") == "wine_cellar":
        return "vin", "caveau"
    if tags.get("amenity") == "winery":
        return "vin", "winery"
    return "vin", "autre"

def score_colixo(tags, canton):
    score = 0
    name = tags.get("name", "").lower()

    if tags.get("craft") == "winery":
        score += 30
    if tags.get("shop") == "wine":
        score += 25
    if tags.get("website") or tags.get("contact:website"):
        score += 15
    if tags.get("email") or tags.get("contact:email"):
        score += 15
    if tags.get("phone") or tags.get("contact:phone"):
        score += 10
    if canton in CANTONS:
        score += 10
    if "domaine" in name:
        score += 10
    if "cave" in name:
        score += 10

    return min(score, 100)

def generate_message(name):
    return (
        f"Bonjour, je me permets de vous contacter au nom de Colixo. "
        f"Nous aidons les domaines viticoles, caves et cavistes en Suisse romande "
        f"à organiser leurs livraisons de cartons de vin vers leurs clients, restaurants "
        f"ou points de vente. Votre activité, {name}, semble correspondre à un besoin "
        f"de livraison souple et régulière. Seriez-vous ouvert à un court échange ?"
    )

def fetch_canton(canton, bbox):
    query = build_query(bbox)
    response = requests.post(
        OVERPASS_URL,
        data={"data": query},
        headers=HEADERS,
        timeout=90
    )
    response.raise_for_status()
    return response.json().get("elements", [])

def main():
    rows = []

    for canton, bbox in CANTONS.items():
        print(f"Extraction canton : {canton}")
        try:
            elements = fetch_canton(canton, bbox)
        except Exception as e:
            print(f"Erreur pour {canton}: {e}")
            continue

        for el in elements:
            tags = el.get("tags", {})
            name = clean(tags.get("name"))

            if not name:
                continue

            categorie, sous_categorie = classify(tags)

            lat = el.get("lat") or el.get("center", {}).get("lat")
            lon = el.get("lon") or el.get("center", {}).get("lon")

            website = clean(
                tags.get("website")
                or tags.get("contact:website")
                or tags.get("url")
            )

            email = clean(tags.get("email") or tags.get("contact:email"))
            phone = clean(tags.get("phone") or tags.get("contact:phone"))

            score = score_colixo(tags, canton)

            rows.append({
                "entreprise": name,
                "categorie": categorie,
                "sous_categorie": sous_categorie,
                "ville": clean(get_city(tags)),
                "canton": canton,
                "adresse": clean(get_address(tags)),
                "postcode": clean(tags.get("addr:postcode")),
                "telephone": phone,
                "email": email,
                "site_web": website,
                "latitude": lat,
                "longitude": lon,
                "source": "OpenStreetMap / Overpass",
                "osm_id": f"{el.get('type')}/{el.get('id')}",
                "score_colixo": score,
                "besoin_detecte": "Livraison de cartons de vin, clients privés, restaurants, points de vente",
                "angle_commercial": "Livraison souple en Suisse romande, pics saisonniers, image premium",
                "message_prospection": generate_message(name)
            })

        time.sleep(2)

    df = pd.DataFrame(rows)

    if df.empty:
        print("Aucun prospect trouvé.")
        return

    df = df.drop_duplicates(subset=["entreprise", "ville"], keep="first")
    df = df.sort_values(by="score_colixo", ascending=False)

    output_dir = "/Users/didiergysling/swissbill/prospection"
    csv_path  = f"{output_dir}/prospects_vin_suisse_romande.csv"
    xlsx_path = f"{output_dir}/prospects_vin_suisse_romande.xlsx"

    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"CSV : {csv_path}")

    try:
        df.to_excel(xlsx_path, index=False)
        print(f"XLSX : {xlsx_path}")
    except Exception as e:
        print(f"XLSX non créé : {e}")

    print(f"\n✓ {len(df)} prospects exportés (triés par score Colixo).")

if __name__ == "__main__":
    main()
