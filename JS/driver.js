async function updateStatus(id,status){

await supabaseClient
.from("orders")
.update({status:status})
.eq("id",id)

}
