async function updateStatus(id,status){

await supabaseClient
.from("orders")
.update({status:status})
.eq("id",id)

}
navigator.geolocation.watchPosition(pos=>{

const lat = pos.coords.latitude
const lon = pos.coords.longitude

supabaseClient
.from("vehicles")
.update({
lat:lat,
lon:lon,
updated_at:new Date()
})
.eq("driver_id",driverId)

})
async function startPause(){

await supabaseClient
.from("driver_logs")
.insert({

driver_id:driverId,
type:"pause",
time:new Date()

})

}
