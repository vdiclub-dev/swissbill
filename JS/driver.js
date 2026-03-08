async function updateStatus(orderId,status){

await supabase
.from("orders")
.update({status:status})
.eq("id",orderId)

}
