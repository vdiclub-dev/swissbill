async function addAuditLog(orderId, action, details = {}, actorType = "client") {
  const { data: authData } = await supabase.auth.getUser();
  const actorId = authData?.user?.id || null;

  const { error } = await supabase.from("order_audit_logs").insert({
    order_id: orderId,
    action,
    actor_id: actorId,
    actor_type: actorType,
    details
  });

  if (error) {
    console.error("Erreur audit log:", error);
  }
}
