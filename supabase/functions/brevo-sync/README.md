# brevo-sync : du site vers Brevo

Chaque e-mail laissé sur le site (calculateur, page d'appel, candidature) est enregistré dans la table `leads`.
Cette fonction ajoute la personne dans la bonne liste Brevo, ce qui lance la séquence de 7 e-mails.
Seules les personnes qui ont coché la case d'accord sont envoyées.

## Mise en route (une fois, environ 15 minutes)

1. **Brevo** : crée les listes « Calculateur » et « Appel » (Contacts → Listes) et note leurs numéros.
   Crée une clé d'API : menu de ton compte → SMTP & API → Clés API → Générer.
2. **Supabase, projet « tb-coaching app »** → Edge Functions → Secrets : ajoute
   - `BREVO_API_KEY` : la clé de l'étape 1
   - `BREVO_LIST_CALCULATEUR` et `BREVO_LIST_APPEL` : les numéros des listes
   - `BREVO_WEBHOOK_SECRET` : une longue phrase au hasard (au moins 32 caractères), que tu n'écris nulle part ailleurs
3. **Déployer la fonction** : `supabase functions deploy brevo-sync --no-verify-jwt`
   (ou demande-moi de le faire ; `--no-verify-jwt` parce que l'appel est protégé par le secret ci-dessus).
4. **Supabase → Database → Webhooks → Create** :
   - Table `leads`, événement **Insert**.
   - Type « Supabase Edge Functions », fonction `brevo-sync`, méthode POST.
   - En-tête HTTP : `x-webhook-secret` = la même phrase qu'à l'étape 2.

Pour vérifier, remplis le calculateur avec ton e-mail : tu dois apparaître dans la liste « Calculateur » de Brevo en quelques secondes.
Sinon, regarde les journaux : Edge Functions → brevo-sync → Logs.

## Ce qui est envoyé à Brevo
E-mail, prénom (`FIRSTNAME`) et, si ces attributs existent dans ton compte, `SOURCE`, `DEMANDE`, `E1RM`, `OBJECTIF` et `DELAI`.
Si Brevo refuse un attribut, la fonction réessaie avec le prénom seul.
