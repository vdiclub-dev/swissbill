function calculateTransport(){

let km = Math.floor(Math.random()*80)+10

document.getElementById("distance").innerText = km

calculatePrice()

}



function calculatePrice(){

let km =
Number(document.getElementById("distance").innerText)

let packageType =
document.getElementById("package_type").value

let price = km * 1.20


if(packageType === "palette"){
price += 20
}

document.getElementById("price").innerText =
"CHF " + price.toFixed(2)

}

// type colis
let packageType =
document.getElementById("package_type").value

// vitesse (si tu ajoutes un champ express plus tard)
let speed = "normal"


let price = km * 1.20


// supplément palette
if(packageType === "palette"){
price += 20
}


// supplément express
if(speed === "express"){
price *= 1.3
}


// afficher prix
document.getElementById("price").innerText =
"CHF " + price.toFixed(2)

}
const sbOrders = window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {
  const orderForm = document.getElementById("orderForm");
  const previewPrice = document.getElementById("previewPrice");

  if (!orderForm) return;

  try {
    const session = await requireAuth();
    if (!session) return;

    const profile = await getClientProfile();
    if (!profile) throw new Error("Profil client introuvable.");

    const pricing = await getClientPricing(profile.id);

    const priceFields = [
      "estimated_km",
      "package_type",
      "weight_category",
      "volume_m3",
      "pallet_count",
      "quantity",
      "speed",
      "night_delivery",
      "signature_required",
      "fragile"
    ];

    async function updatePricePreview() {
      const km = document.getElementById("estimated_km").value;
      const packageType = document.getElementById("package_type").value;
      const weightCategory = document.getElementById("weight_category").value;
      const volumeM3 = document.getElementById("volume_m3").value;
      const palletCount = document.getElementById("pallet_count").value;
      const quantity = document.getElementById("quantity").value;
      const speed = document.getElementById("speed").value;
      const nightDelivery = document.getElementById("night_delivery").checked;
      const signatureRequired = document.getElementById("signature_required").checked;
      const fragile = document.getElementById("fragile").checked;

      const price = calculateTransportPrice({
        pricing,
        km,
        packageType,
        weightCategory,
        volumeM3,
        palletCount,
        quantity,
        speed,
        fragile,
        nightDelivery,
        signatureRequired
      });

      previewPrice.textContent = UI.money(price);
    }

    priceFields.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", updatePricePreview);
      el.addEventListener("change", updatePricePreview);
    });

    updatePricePreview();

    orderForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const orderNumber = "ORD-" + Date.now();

      const km = Number(document.getElementById("estimated_km").value || 0);
      const packageType = document.getElementById("package_type").value;
      const weightCategory = document.getElementById("weight_category").value;
      const volumeM3 = Number(document.getElementById("volume_m3").value || 0);
      const palletCount = Number(document.getElementById("pallet_count").value || 0);
      const quantity = Number(document.getElementById("quantity").value || 1);
      const speed = document.getElementById("speed").value;
      const nightDelivery = document.getElementById("night_delivery").checked;
      const signatureRequired = document.getElementById("signature_required").checked;
      const fragile = document.getElementById("fragile").checked;

      const estimatedPrice = calculateTransportPrice({
        pricing,
        km,
        packageType,
        weightCategory,
        volumeM3,
        palletCount,
        quantity,
        speed,
        fragile,
        nightDelivery,
        signatureRequired
      });

      const payload = {
        order_number: orderNumber,
        client_id: profile.id,

        pickup_name: document.getElementById("pickup_name").value.trim(),
        pickup_company: document.getElementById("pickup_company").value.trim(),
        pickup_address: document.getElementById("pickup_address").value.trim(),
        pickup_npa: document.getElementById("pickup_npa").value.trim(),
        pickup_city: document.getElementById("pickup_city").value.trim(),
        pickup_phone: document.getElementById("pickup_phone").value.trim(),

        delivery_name: document.getElementById("delivery_name").value.trim(),
        delivery_company: document.getElementById("delivery_company").value.trim(),
        delivery_address: document.getElementById("delivery_address").value.trim(),
        delivery_npa: document.getElementById("delivery_npa").value.trim(),
        delivery_city: document.getElementById("delivery_city").value.trim(),
        delivery_phone: document.getElementById("delivery_phone").value.trim(),
        delivery_contact: document.getElementById("delivery_contact").value.trim(),

        package_type: packageType,
        weight_category: weightCategory,
        volume_m3: volumeM3,
        pallet_count: palletCount,
        quantity: quantity,

        speed: speed,
        night_delivery: nightDelivery,
        signature_required: signatureRequired,
        fragile: fragile,
        instructions: document.getElementById("instructions").value.trim(),

        estimated_km: km,
        estimated_price: estimatedPrice,
        status: "nouveau"
      };

      const { data, error } = await sbOrders
        .from("orders")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      await sbOrders.from("tracking").insert([{
        order_id: data.id,
        status: "Commande créée",
        location: "Portail client",
        note: "Demande enregistrée par le client"
      }]);

      UI.toast("Transport enregistré avec succès", "success");
      setTimeout(() => {
        window.location.href = "/portal.html";
      }, 1000);
    });
  } catch (err) {
    UI.toast(err.message || "Erreur module transport", "error");
  }
});
async function loadDashboard(){

const { data } = await db
.from("transport_orders")
.select("*")

let enCours = 0
let livres = 0

data.forEach(o => {

if(o.Statut === "livré"){
livres++
}else{
enCours++
}

})

document.getElementById("ordersCount").innerText = enCours
document.getElementById("deliveredCount").innerText = livres

}
async function createOrder(){

const client = document.getElementById("Client").value
const pickup = document.getElementById("pickup_address").value
const delivery = document.getElementById("delivery_address").value
const distance = document.getElementById("Distance").value
const prix = document.getElementById("Prix").value

await db.from("transport_orders").insert([{

Client:client,
pickup_address:pickup,
delivery_address:delivery,
Distance:distance,
Prix:prix,
Statut:"nouveau"

}])

alert("Transport créé")

loadOrders()

}
async function loadOrders(){

const {data} = await db
.from("transport_orders")
.select("*")

const table = document.getElementById("ordersTable")

table.innerHTML=""

data.forEach(o=>{

table.innerHTML+=`
<tr>
<td>${o.Client}</td>
<td>${o.pickup_address}</td>
<td>${o.delivery_address}</td>
<td>${o.Distance}</td>
<td>${o.Prix}</td>
<td>${o.Statut}</td>
</tr>


})

}
f
