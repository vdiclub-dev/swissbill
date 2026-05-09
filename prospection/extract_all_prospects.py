"""
extract_all_prospects.py — Extraction multi-catégories pour Colixo
Source : OpenStreetMap / Overpass API
Zones  : Suisse romande (VD, GE, FR, NE, VS, JU)
"""

import requests
import pandas as pd
import time
from datetime import datetime

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "ColixoProspection/2.0 contact:info@colixo.ch"}

CANTONS = {
    "Vaud":      "46.187,6.027,46.984,7.249",
    "Geneve":    "46.120,5.956,46.350,6.331",
    "Fribourg":  "46.384,6.747,47.066,7.437",
    "Neuchatel": "46.827,6.431,47.170,7.160",
    "Valais":    "45.817,6.770,46.654,8.478",
    "Jura":      "47.150,6.800,47.610,7.560",
}

# ══════════════════════════════════════════════════════════════════
# CATALOGUE DES CATÉGORIES
# Chaque entrée : tags OSM, scoring, besoin, angle, message
# ══════════════════════════════════════════════════════════════════
CATEGORIES = [

  # ── VIN / VITICULTURE ─────────────────────────────────────────
  {
    "id": "vin",
    "label": "Vin & Viticulture",
    "sous_categories": {
      "craft=winery":       ("domaine_viticole", 30),
      "shop=wine":          ("caviste",          25),
      "amenity=winery":     ("winery",           25),
      "tourism=wine_cellar":("caveau",           20),
    },
    "besoin": "Livraison de cartons de vin vers clients privés, restaurants, points de vente",
    "angle":  "Pics saisonniers (vendanges, fêtes), livraison image premium, J+1 en Suisse romande",
    "message": lambda nom, ville: (
      f"Bonjour, je me permets de vous contacter au nom de Colixo. "
      f"Nous aidons les domaines viticoles et cavistes en Suisse romande à livrer "
      f"leurs cartons de vin vers leurs clients, restaurants ou points de vente. "
      f"Votre activité{f' à {ville}' if ville else ''} correspond exactement à notre cœur de cible. "
      f"Seriez-vous ouvert à un court échange ?"
    ),
  },

  # ── PHARMACIES ────────────────────────────────────────────────
  {
    "id": "pharmacie",
    "label": "Pharmacies & Parapharmacie",
    "sous_categories": {
      "amenity=pharmacy": ("pharmacie", 35),
      "shop=chemist":     ("parapharmacie", 25),
    },
    "besoin": "Livraison urgente de médicaments, réassort entre officines, livraison à domicile",
    "angle":  "Rapidité J+1 ou express, fiabilité, confidentialité, traçabilité complète",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo propose une solution de livraison express adaptée aux pharmacies "
      f"de Suisse romande — réassort entre officines, livraison à domicile de patients, "
      f"ou distribution vers points de vente partenaires. "
      f"Votre pharmacie{f' à {ville}' if ville else ''} pourrait bénéficier d'un service J+1 fiable. "
      f"Seriez-vous disponible pour en discuter ?"
    ),
  },

  # ── FLEURISTES ───────────────────────────────────────────────
  {
    "id": "fleuriste",
    "label": "Fleuristes",
    "sous_categories": {
      "shop=florist": ("fleuriste", 30),
    },
    "besoin": "Livraison de bouquets et compositions florales, délais très courts, produits fragiles",
    "angle":  "Livraison express même jour ou J+1, manipulation soignée, pics fêtes/mariages",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo aide les fleuristes de Suisse romande à livrer leurs créations "
      f"— bouquets, compositions, commandes événementielles — avec soin et rapidité. "
      f"Nous gérons les pics de la Saint-Valentin, fête des Mères ou mariages. "
      f"Votre boutique{f' à {ville}' if ville else ''} nous intéresse. Pouvons-nous échanger ?"
    ),
  },

  # ── BOULANGERIES / PÂTISSERIES ───────────────────────────────
  {
    "id": "boulangerie",
    "label": "Boulangeries & Pâtisseries",
    "sous_categories": {
      "shop=bakery":           ("boulangerie",  28),
      "shop=pastry":           ("patisserie",   28),
      "craft=bakery":          ("boulangerie_artisanale", 28),
      "craft=confectionery":   ("confiserie",  25),
    },
    "besoin": "Distribution de produits frais vers points de vente, hôtels, restaurants, cantines",
    "angle":  "Tournées tôt le matin, respect de la chaîne du froid, livraison B2B multi-points",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo accompagne les artisans boulangers et pâtissiers en Suisse romande "
      f"dans la distribution de leurs produits frais vers leurs points de vente, hôtels ou restaurants. "
      f"Tournées matinales, manipulation soignée, fiabilité quotidienne. "
      f"Votre activité{f' à {ville}' if ville else ''} nous intéresse. Un échange est-il possible ?"
    ),
  },

  # ── TRAITEURS & RESTAURATION ─────────────────────────────────
  {
    "id": "traiteur",
    "label": "Traiteurs & Restauration",
    "sous_categories": {
      "shop=deli":            ("traiteur_epicerie", 25),
      "craft=caterer":        ("traiteur",          30),
      "amenity=restaurant":   ("restaurant",        15),
    },
    "besoin": "Livraison de plats préparés, commandes événementielles, réassort cuisine",
    "angle":  "Livraison dans les délais stricts, maintien température, B2B entreprises",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo propose une solution logistique pour les traiteurs et restaurateurs "
      f"de Suisse romande — livraison de commandes événementielles, distribution B2B, "
      f"réassort entre cuisines. Votre activité{f' à {ville}' if ville else ''} correspond à notre offre. "
      f"Seriez-vous disponible pour un échange ?"
    ),
  },

  # ── ÉPICERIES FINES & ALIMENTATION ───────────────────────────
  {
    "id": "epicerie",
    "label": "Épiceries & Alimentation spécialisée",
    "sous_categories": {
      "shop=greengrocer":      ("primeur",            22),
      "shop=cheese":           ("fromagerie",         28),
      "shop=butcher":          ("boucherie",          25),
      "shop=seafood":          ("poissonnerie",       25),
      "shop=organic":          ("bio",                25),
      "shop=farm":             ("vente_directe",      25),
      "shop=health_food":      ("dietetique",         20),
      "shop=chocolate":        ("chocolaterie",       25),
    },
    "besoin": "Distribution de produits alimentaires frais ou spécialisés, livraison B2B restaurants/détail",
    "angle":  "Chaîne du froid, livraison multi-points, souplesse pour producteurs locaux",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo aide les producteurs et détaillants alimentaires de Suisse romande "
      f"à livrer leurs produits frais ou spécialisés vers leurs clients — restaurants, "
      f"épiceries partenaires, marchés. Votre activité{f' à {ville}' if ville else ''} nous intéresse. "
      f"Un échange est-il possible ?"
    ),
  },

  # ── IMPRIMERIES ──────────────────────────────────────────────
  {
    "id": "imprimerie",
    "label": "Imprimeries & Communication",
    "sous_categories": {
      "craft=printer":          ("imprimerie",        30),
      "shop=copyshop":          ("reprographie",      25),
      "office=advertising_agency": ("agence_comm",   20),
    },
    "besoin": "Livraison urgente de documents, affiches, brochures chez clients ou agences",
    "angle":  "Délais express, manipulation documents fragiles, livraison B2B en ville",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo aide les imprimeries et agences de communication de Suisse romande "
      f"à livrer leurs productions — affiches, brochures, documents — chez leurs clients "
      f"dans les délais. Votre activité{f' à {ville}' if ville else ''} correspond à notre offre. "
      f"Pouvons-nous en discuter ?"
    ),
  },

  # ── MÉDICAL & LABORATOIRES ───────────────────────────────────
  {
    "id": "medical",
    "label": "Médical & Laboratoires",
    "sous_categories": {
      "amenity=clinic":         ("clinique",          30),
      "amenity=doctors":        ("cabinet_medical",   20),
      "amenity=dentist":        ("dentiste",          15),
      "amenity=veterinary":     ("veterinaire",       20),
      "office=optician":        ("opticien",          20),
      "shop=medical_supply":    ("materiel_medical",  30),
      "shop=optician":          ("opticien",          20),
    },
    "besoin": "Transport de prélèvements, matériel médical, ordonnances, consommables",
    "angle":  "Fiabilité absolue, traçabilité, délais J+1 ou express, confidentialité",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo propose une solution logistique sécurisée pour les acteurs médicaux "
      f"de Suisse romande — transport de prélèvements, matériel médical, consommables ou documents. "
      f"Votre structure{f' à {ville}' if ville else ''} pourrait bénéficier d'un service fiable et traçable. "
      f"Seriez-vous disponible pour échanger ?"
    ),
  },

  # ── AUTO & PIÈCES DÉTACHÉES ───────────────────────────────────
  {
    "id": "auto",
    "label": "Automobile & Pièces détachées",
    "sous_categories": {
      "shop=car_parts":         ("pieces_auto",       30),
      "shop=car_repair":        ("garage",            25),
      "shop=tyres":             ("pneumatiques",      25),
      "amenity=car_rental":     ("location_vehicule", 15),
    },
    "besoin": "Livraison urgente de pièces détachées entre garages, fournisseurs et carrossiers",
    "angle":  "Express même jour, livraison inter-garages, réduction immobilisation véhicule",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo aide les garages et distributeurs de pièces auto en Suisse romande "
      f"à livrer en urgence leurs pièces détachées entre points de vente et ateliers. "
      f"Votre activité{f' à {ville}' if ville else ''} correspond à notre offre express. "
      f"Un échange rapide est-il possible ?"
    ),
  },

  # ── BIJOUTERIES & LUXE ───────────────────────────────────────
  {
    "id": "luxe",
    "label": "Bijouteries & Articles de luxe",
    "sous_categories": {
      "shop=jewellery":         ("bijouterie",        30),
      "shop=watches":           ("horlogerie",        30),
      "shop=art":               ("galerie_art",       20),
      "shop=antiques":          ("antiquite",         20),
    },
    "besoin": "Transport sécurisé de bijoux, montres, œuvres d'art, colis haute valeur",
    "angle":  "Discrétion, assurance, traçabilité, livraison sécurisée contre signature",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo propose une solution de livraison sécurisée pour les bijoutiers "
      f"et horlogers de Suisse romande — transport de pièces haute valeur avec traçabilité "
      f"et remise contre signature. Votre activité{f' à {ville}' if ville else ''} nous intéresse. "
      f"Pouvons-nous en discuter ?"
    ),
  },

  # ── INFORMATIQUE & ÉLECTRONIQUE ───────────────────────────────
  {
    "id": "informatique",
    "label": "Informatique & Électronique",
    "sous_categories": {
      "shop=computer":          ("informatique",      25),
      "shop=electronics":       ("electronique",      25),
      "shop=mobile_phone":      ("telephonie",        20),
      "shop=hifi":              ("hifi",              20),
    },
    "besoin": "Livraison de matériel informatique, équipements, SAV, échange de matériel",
    "angle":  "Livraison B2B entreprises, gestion du SAV, traçabilité colis fragiles",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo aide les revendeurs informatiques et électronique de Suisse romande "
      f"à livrer leur matériel auprès d'entreprises clientes, gérer les échanges SAV, "
      f"ou redistribuer entre points de vente. Votre activité{f' à {ville}' if ville else ''} nous intéresse. "
      f"Un échange est-il possible ?"
    ),
  },

  # ── TEXTILE & MODE ───────────────────────────────────────────
  {
    "id": "textile",
    "label": "Textile, Mode & Accessoires",
    "sous_categories": {
      "shop=clothes":           ("mode",              20),
      "shop=shoes":             ("chaussures",        20),
      "shop=fashion_accessories":("accessoires",      20),
      "craft=tailor":           ("couturier",         25),
      "craft=shoemaker":        ("cordonnier",        20),
    },
    "besoin": "Livraison de commandes vers boutiques, retours clients, réassort entre points de vente",
    "angle":  "Livraison B2B multi-boutiques, gestion des retours, souplesse volume",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo aide les acteurs de la mode et du textile en Suisse romande "
      f"à livrer leurs commandes, gérer les retours clients et réapprovisionner "
      f"leurs points de vente. Votre activité{f' à {ville}' if ville else ''} nous intéresse. "
      f"Pouvons-nous échanger ?"
    ),
  },

  # ── COSMÉTIQUES & BEAUTÉ ─────────────────────────────────────
  {
    "id": "beaute",
    "label": "Cosmétiques & Beauté",
    "sous_categories": {
      "shop=cosmetics":         ("cosmetique",        25),
      "shop=beauty":            ("institut_beaute",   20),
      "shop=perfumery":         ("parfumerie",        25),
      "amenity=beauty_salon":   ("salon_beaute",      15),
      "amenity=hairdresser":    ("coiffeur",          10),
    },
    "besoin": "Livraison de produits cosmétiques vers instituts, salons et boutiques",
    "angle":  "Distribution B2B régulière, produits fragiles, livraison multi-points",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo accompagne les acteurs de la beauté et de la cosmétique "
      f"en Suisse romande dans leur distribution B2B — livraison vers instituts, "
      f"salons et boutiques partenaires. Votre activité{f' à {ville}' if ville else ''} nous intéresse. "
      f"Un échange est-il possible ?"
    ),
  },

  # ── SPORT & LOISIRS ──────────────────────────────────────────
  {
    "id": "sport",
    "label": "Sport & Loisirs",
    "sous_categories": {
      "shop=sports":            ("sport",             20),
      "shop=outdoor":           ("outdoor",           20),
      "shop=bicycle":           ("velo",              20),
      "shop=ski":               ("ski",               25),
    },
    "besoin": "Livraison d'équipements sportifs, location, réassort entre points de vente",
    "angle":  "Pics saisonniers (ski hiver, vélo printemps), livraison B2B magasins",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo aide les commerces de sport en Suisse romande à gérer "
      f"leurs livraisons — réassort entre magasins, livraison de commandes web, "
      f"gestion des pics saisonniers. Votre activité{f' à {ville}' if ville else ''} nous intéresse. "
      f"Pouvons-nous en discuter ?"
    ),
  },

  # ── LIBRAIRIES & PAPETERIES ───────────────────────────────────
  {
    "id": "librairie",
    "label": "Librairies & Papeteries",
    "sous_categories": {
      "shop=books":             ("librairie",         22),
      "shop=stationery":        ("papeterie",         22),
      "shop=office_supplies":   ("fournitures_bureau",25),
    },
    "besoin": "Livraison de commandes livres, fournitures de bureau, réassort librairies",
    "angle":  "Livraison B2B entreprises et écoles, gestion des commandes régulières",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo aide les librairies, papeteries et fournisseurs de bureau "
      f"en Suisse romande à livrer leurs commandes auprès d'entreprises, écoles ou clients. "
      f"Votre activité{f' à {ville}' if ville else ''} correspond à notre offre. "
      f"Seriez-vous disponible pour échanger ?"
    ),
  },

  # ── MATÉRIAUX & BTP ──────────────────────────────────────────
  {
    "id": "btp",
    "label": "BTP & Matériaux",
    "sous_categories": {
      "shop=hardware":          ("quincaillerie",     25),
      "shop=doityourself":      ("bricolage",         20),
      "shop=paint":             ("peinture",          25),
      "craft=plumber":          ("plombier",          20),
      "craft=electrician":      ("electricien",       20),
      "craft=carpenter":        ("menuisier",         20),
    },
    "besoin": "Livraison urgente de matériaux sur chantier, réassort artisans",
    "angle":  "Express chantier, livraison multi-sites, réduction arrêts de travail",
    "message": lambda nom, ville: (
      f"Bonjour, Colixo propose une solution logistique pour les artisans et fournisseurs "
      f"BTP en Suisse romande — livraison urgente de matériaux sur chantier, "
      f"réassort entre dépôts. Votre activité{f' à {ville}' if ville else ''} nous intéresse. "
      f"Un échange est-il possible ?"
    ),
  },
]

# ══════════════════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES
# ══════════════════════════════════════════════════════════════════
def clean(v):
    if not v: return ""
    v = str(v).strip()
    return "" if v.lower() in ("nan","none") else v

def get_city(tags):
    return clean(tags.get("addr:city") or tags.get("addr:municipality") or "")

def get_address(tags):
    return (clean(tags.get("addr:street","")) + " " + clean(tags.get("addr:housenumber",""))).strip()

def build_query(bbox, tag_filter):
    key, value = tag_filter.split("=", 1)
    return f"""
[out:json][timeout:60];
(
  node["{key}"="{value}"]({bbox});
  way["{key}"="{value}"]({bbox});
  relation["{key}"="{value}"]({bbox});
);
out center tags;
"""

def fetch(bbox, tag_filter):
    q = build_query(bbox, tag_filter)
    r = requests.post(OVERPASS_URL, data={"data": q}, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.json().get("elements", [])

def score(tags, canton, base_score):
    s = base_score
    s += 10  # canton romand
    if tags.get("website") or tags.get("contact:website"): s += 15
    if tags.get("email")   or tags.get("contact:email"):   s += 15
    if tags.get("phone")   or tags.get("contact:phone"):   s += 10
    return min(s, 100)

# ══════════════════════════════════════════════════════════════════
# EXTRACTION PRINCIPALE
# ══════════════════════════════════════════════════════════════════
def main():
    rows = []
    total_req = sum(len(cat["sous_categories"]) * len(CANTONS) for cat in CATEGORIES)
    done = 0

    for cat in CATEGORIES:
        print(f"\n{'─'*55}")
        print(f"  {cat['label']}")
        print(f"{'─'*55}")

        for tag_filter, (sous_cat, base_sc) in cat["sous_categories"].items():
            for canton, bbox in CANTONS.items():
                done += 1
                print(f"  [{done}/{total_req}] {tag_filter} · {canton}…", end=" ", flush=True)
                try:
                    elements = fetch(bbox, tag_filter)
                    print(f"{len(elements)} résultats")
                except Exception as e:
                    print(f"erreur : {e}")
                    elements = []

                for el in elements:
                    tags = el.get("tags", {})
                    nom  = clean(tags.get("name"))
                    if not nom:
                        continue

                    lat = el.get("lat") or el.get("center", {}).get("lat")
                    lon = el.get("lon") or el.get("center", {}).get("lon")
                    ville = get_city(tags)

                    rows.append({
                        "entreprise":       nom,
                        "categorie":        cat["id"],
                        "label_categorie":  cat["label"],
                        "sous_categorie":   sous_cat,
                        "tag_osm":          tag_filter,
                        "ville":            ville,
                        "canton":           canton,
                        "adresse":          get_address(tags),
                        "postcode":         clean(tags.get("addr:postcode")),
                        "telephone":        clean(tags.get("phone") or tags.get("contact:phone")),
                        "email":            clean(tags.get("email") or tags.get("contact:email")),
                        "site_web":         clean(tags.get("website") or tags.get("contact:website")),
                        "latitude":         lat,
                        "longitude":        lon,
                        "source":           "OpenStreetMap / Overpass",
                        "osm_id":           f"{el.get('type')}/{el.get('id')}",
                        "score_colixo":     score(tags, canton, base_sc),
                        "besoin_detecte":   cat["besoin"],
                        "angle_commercial": cat["angle"],
                        "message_prospection": cat["message"](nom, ville),
                    })

                time.sleep(1.2)  # respecter l'API

    df = pd.DataFrame(rows)
    if df.empty:
        print("\nAucun prospect trouvé.")
        return

    df = df.drop_duplicates(subset=["entreprise", "ville", "categorie"], keep="first")
    df = df.sort_values(by=["categorie", "score_colixo"], ascending=[True, False])

    base = "/Users/didiergysling/swissbill/prospection"
    df.to_csv(f"{base}/prospects_colixo_all.csv", index=False, encoding="utf-8-sig")
    try:
        df.to_excel(f"{base}/prospects_colixo_all.xlsx", index=False)
    except Exception:
        pass

    print(f"\n{'═'*55}")
    print(f"  TOTAL : {len(df)} prospects extraits")
    print(f"{'═'*55}")
    print(df.groupby("label_categorie")["entreprise"].count().sort_values(ascending=False).to_string())
    print(f"\nFichiers : prospects_colixo_all.csv / .xlsx")

if __name__ == "__main__":
    main()
