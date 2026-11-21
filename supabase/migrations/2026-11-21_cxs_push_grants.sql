-- Les membres connectés doivent pouvoir lire la clé publique VAPID et enregistrer leur abonnement push.
-- Sans ce grant, l'appel rpc renvoie "permission denied for function push_public_key".
revoke all on function public.push_public_key() from public, anon;
revoke all on function public.push_register(text, jsonb) from public, anon;
grant execute on function public.push_public_key() to authenticated;
grant execute on function public.push_register(text, jsonb) to authenticated;
