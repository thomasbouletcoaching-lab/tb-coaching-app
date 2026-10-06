# E-mails Supabase en français

À coller dans Supabase : **Authentication → Emails → Templates** (projet TB Coaching).
Pour chaque modèle : copier le **Sujet**, puis remplacer tout le **corps** (onglet *Source*) par le contenu du fichier indiqué, et cliquer sur **Save**.

| Modèle Supabase | Sujet | Fichier |
|---|---|---|
| Confirm signup | Confirme ton adresse e-mail · TB my Coach | `emails/confirmation.html` |
| Invite user | Ton espace de coaching est prêt · TB my Coach | `emails/invite.html` |
| Magic link | Ton lien de connexion · TB my Coach | `emails/magic_link.html` |
| Reset password | Choisis ton mot de passe · TB my Coach | `emails/recovery.html` |
| Change email address | Confirme ta nouvelle adresse e-mail · TB my Coach | `emails/email_change.html` |
| Reauthentication | Ton code de vérification · TB my Coach | `emails/reauthentication.html` |

Les variables `{{ .ConfirmationURL }}` et `{{ .Token }}` sont remplacées automatiquement par Supabase : ne pas les modifier.
