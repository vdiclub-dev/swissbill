async function createOrder(data){

const { error } = await supabase
.from("orders")
.insert([
{
client_id: data.client_id,
pickup_address: data.pickup,
delivery_address: data.delivery,
product_type: data.type,
weight: data.weight,
status: "pending"
}
])

if(error){
alert("Erreur création transport")
}else{
alert("Transport enregistré")
}
}
