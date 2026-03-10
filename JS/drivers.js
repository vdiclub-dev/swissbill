async function loadDrivers(){

const { data } = await supabase
.from("drivers")
.select("*")

data.forEach(driver=>{

L.circleMarker([driver.lat, driver.lng],{
radius:8,
color:"green"
})
.addTo(map)
.bindPopup(`
🚚 ${driver.name}<br>
Véhicule: ${driver.vehicle}
`)

})

}

loadDrivers()
function drawRoute(lat1,lng1,lat2,lng2){

L.polyline([
[lat1,lng1],
[lat2,lng2]
],{
color:"blue",
weight:4
}).addTo(map)

}
