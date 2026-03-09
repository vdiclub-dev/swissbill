async function calculateDistance() {
  const start = document.getElementById("pickup_address").value.trim();
  const end = document.getElementById("delivery_address").value.trim();

  if (!start || !end) return;

  const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI4OTQwOGJlOTE1MDQzNjc5NmQ3NzkzOWQ0YjZjODg4IiwiaCI6Im11cm11cjY0In0=";

  try {
    // 1) Géocodage des adresses avec Nominatim
    const geo = async (addr) => {
      const r = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
        encodeURIComponent(addr)
      );
      const d = await r.json();

      if (!d || !d.length) {
        throw new Error("Adresse introuvable : " + addr);
      }

      // OpenRouteService attend [longitude, latitude]
      return [parseFloat(d[0].lon), parseFloat(d[0].lat)];
    };

    const startCoord = await geo(start);
    const endCoord = await geo(end);

    console.log("Départ coord :", startCoord);
    console.log("Arrivée coord :", endCoord);

    // 2) Calcul ROUTIER avec OpenRouteService
    const routeRes = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car",
      {
        method: "POST",
        headers: {
          "Authorization": ORS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coordinates: [startCoord, endCoord]
        })
      }
    );

    const routeData = await routeRes.json();
    console.log("Réponse ORS :", routeData);

    if (!routeData.routes || !routeData.routes.length) {
      throw new Error("Aucune route retournée par OpenRouteService");
    }

    const meters = routeData.routes[0].summary.distance;
    const km = meters / 1000;

    document.getElementById("distance").innerText = km.toFixed(1);

    calculatePrice();
  } catch (e) {
    console.error("Erreur calcul distance :", e);
    alert("Impossible de calculer la distance routière");
  }
}

function calculatePrice(){

const km =
Number(document.getElementById("distance").innerText || 0)

const type =
document.getElementById("package_type").value

let price = km * 1.2

if(type === "box") price += 10
if(type === "palette") price += 20

document.getElementById("price").innerText =
"CHF " + price.toFixed(2)

}

function calculateTransport(){

calculateDistance()

}

window.calculateDistance = calculateDistance
window.calculatePrice = calculatePrice
window.calculateTransport = calculateTransport
