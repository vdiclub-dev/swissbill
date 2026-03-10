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
