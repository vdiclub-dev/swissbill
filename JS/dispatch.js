async function loadOrdersMap(){

const { data, error } = await supabase
.from("orders")
.select("*")

if(error){
console.error(error)
return
}

data.forEach(order=>{

// coordonnées test Lausanne
const lat = 46.5197
const lng = 6.6323

L.marker([lat,lng])
.addTo(map)
.bindPopup(`
Transport #${order.id}<br>
Destination : ${order.delivery_city}
`)

})

}

loadOrdersMap()
