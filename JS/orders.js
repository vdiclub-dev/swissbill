function getDistance(lat1,lon1,lat2,lon2){

const R = 6371
const dLat = (lat2-lat1)*Math.PI/180
const dLon = (lon2-lon1)*Math.PI/180

const a =
Math.sin(dLat/2)*Math.sin(dLat/2)+
Math.cos(lat1*Math.PI/180)*
Math.cos(lat2*Math.PI/180)*
Math.sin(dLon/2)*Math.sin(dLon/2)

const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

return R*c
}

function calculatePrice() {
  const km = Number(document.getElementById("distance").innerText || 0);
  const type = document.getElementById("package_type").value;

  let price = km * 1.2;

  if (type === "box") price += 10;
  if (type === "palette") price += 20;

  document.getElementById("price").innerText = "CHF " + price.toFixed(2);
}

function calculateTransport() {
  calculateDistance();
}

window.calculateDistance = calculateDistance;
window.calculatePrice = calculatePrice;
window.calculateTransport = calculateTransport;
