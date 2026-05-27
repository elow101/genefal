export const tutorialsFr = {
  faluchard_create: {
    id: 'faluchard_create',
    title: 'Créer une fiche faluchard',
    goal: 'Ajouter une nouvelle personne dans le bon arbre, sans doublon.',
    where: [
      "Bouton « Fiche d'ajout » (barre du haut, à côté de la recherche).",
      "Ou sur l’accueil : « Ajouter une fiche ».",
    ],
    steps: [
      {
        title: 'Ouvrir le formulaire',
        text: "Clique sur « Fiche d'ajout ». Sur mobile, fais défiler jusqu’au panneau « Fiche faluchard » si besoin.",
        expected: 'Un brouillon local apparaît : il n’est pas encore enregistré.',
      },
      {
        title: 'Remplir les infos essentielles',
        text: 'Renseigne au minimum le nom et (si tu peux) un surnom. Choisis la filière si tu la connais.',
        expected: 'Le bouton « Enregistrer » reste disponible.',
      },
      {
        title: 'Ajouter ville / baptême',
        text: "Ouvre l’onglet « Baptême » puis complète la ville et la date. Si tu n’as pas la date, choisis l’option « Date inconnue ».",
        expected: 'Les infos de baptême sont visibles dans la fiche.',
      },
      {
        title: 'Ajouter la famille (parrains / fillots)',
        text: "Après avoir enregistré la fiche une première fois, ouvre l’onglet « Famille » pour ajouter parrains/marraines, parrains de cœur et fillots.",
        expected: 'Les liens apparaissent dans l’arbre.',
      },
      {
        title: 'Enregistrer',
        text: 'Clique sur « Enregistrer ». Vérifie ensuite le nom affiché dans la sélection et dans le graphe.',
        expected: 'La fiche est créée et sélectionnée.',
      },
    ],
    warnings: [
      'Évite les doublons : cherche d’abord la personne (nom + surnom) avant de créer.',
      'En mode visiteur, certaines modifications peuvent être refusées : utilise « Doléances » pour demander un changement.',
    ],
    troubleshooting: [
      {
        title: 'Je ne vois pas les liens (parrains/fillots)',
        text: 'Ils ne sont disponibles qu’une fois la fiche enregistrée (pas en brouillon).',
      },
      {
        title: 'Je ne peux pas modifier une fiche',
        text: 'Tu es probablement en mode visiteur : passe par Doléances ou connecte-toi en Admin si tu as le mot de passe.',
      },
    ],
  },

  crossed_baptism: {
    id: 'crossed_baptism',
    title: 'Comprendre un baptême croisé / généalogie croisée',
    goal: 'Lire une relation « croisée » et éviter de se perdre dans les liens.',
    where: ['Vue « Arbre » → sélectionne une fiche → utilise le mode Réseau et le halo.'],
    steps: [
      {
        title: 'Ouvrir une fiche concernée',
        text: 'Dans la vue Arbre, touche/clique une personne impliquée.',
        expected: 'La fiche est sélectionnée et le graphe peut être recentré.',
      },
      {
        title: 'Vérifier plusieurs parrains/marraines',
        text: "Dans « Famille », vérifie qu’il y a bien plusieurs parrains/marraines si c’est un croisement.",
        expected: 'Les liens sponsor apparaissent (plusieurs lignes possibles).',
      },
      {
        title: 'Utiliser le mode Réseau',
        text: "Passe en « Mode Réseau » (plus lisible pour les croisements).",
        expected: 'Les liens sont regroupés autour des personnes.',
      },
      {
        title: 'Activer le halo (focus)',
        text: 'Ajuste la « Portée du halo » (Ascendance / Descendance) pour éclairer la branche utile.',
        expected: 'Les nœuds proches restent plus visibles, le reste s’efface légèrement.',
      },
      {
        title: 'Comprendre les chevauchements',
        text: "Sur mobile et sur les graphes denses, certains liens peuvent se superposer : zoome, déplace le graphe et recentre sur la fiche sélectionnée.",
        expected: 'Le croisement devient lisible après zoom + recentrage.',
      },
    ],
    warnings: [
      'Si un lien “semble faux”, vérifie d’abord la fiche (parrains/marraines) avant de conclure à un bug.',
      'Le mode Hiérarchie est moins adapté aux croisements : préfère Réseau.',
    ],
    troubleshooting: [
      {
        title: 'Les liens se mélangent',
        text: 'Réduis la portée du halo (1 ou 2) et recentre sur la fiche sélectionnée.',
      },
    ],
  },

  event_create: {
    id: 'event_create',
    title: 'Créer un événement',
    goal: 'Publier une annonce claire (baptême, adoption, confirmation ou autre) avec la bonne portée.',
    where: ['Vue « Event à venir » → panneau « Créer un événement ».'],
    steps: [
      {
        title: 'Ouvrir la création',
        text: "Va dans « Event à venir ». Le formulaire est disponible même sans région sélectionnée pour créer un événement national.",
        expected: 'Le formulaire de création apparaît.',
      },
      {
        title: 'Choisir le type',
        text: 'Choisis Baptême / Adoption / Confirmation / Cooptage / Autre. Le type influence les champs demandés.',
        expected: 'Les champs « Personnes concernées » s’adaptent.',
      },
      {
        title: 'Choisir la portée',
        text: 'Sélectionne National, Région ou Famille. Un événement national est visible partout. Un événement régional est visible dans la région et ses familles. Un événement famille est visible dans sa famille.',
        expected: 'Les champs de rattachement s’adaptent à la portée choisie.',
      },
      {
        title: 'Date, lieu, description',
        text: 'Renseigne date + heure (obligatoires), lieu (recommandé) et une description courte.',
        expected: 'Le formulaire est prêt à être soumis.',
      },
      {
        title: 'Lien externe et récurrence',
        text: "Tu peux ajouter un lien vers la page officielle de l’événement (optionnel). Tu peux aussi indiquer une récurrence (hebdomadaire, mensuelle, annuelle) quel que soit le type de portée.",
        expected: 'Le lien et la récurrence apparaissent sur l’annonce.',
      },
      {
        title: 'Participants / rattachement',
        text: 'Pour un baptême/adoption/confirmation, ajoute au moins un parrain et les baptisé(s) concernés.',
        expected: 'Le bouton « Créer l’événement » devient actif.',
      },
      {
        title: 'Option “Autre” : demandes de participation',
        text: "Si le type est « Autre », tu peux activer l’option pour autoriser les demandes de participation (si elle est disponible).",
        expected: 'Les visiteurs peuvent demander à participer si activé.',
      },
      {
        title: 'Créer',
        text: 'Clique sur « Créer l’événement ». Note le mot de passe créateur s’il est affiché : il n’apparaît plus ensuite.',
        expected: 'L’annonce apparaît dans la liste, et le mot de passe peut être copié.',
      },
    ],
    warnings: [
      'Une date passée affiche un avertissement : corrige-la avant de publier.',
      'Cooptage : les demandes de participation sont toujours fermées.',
    ],
    troubleshooting: [
      {
        title: 'Je ne peux pas créer',
        text: 'Vérifie les champs obligatoires (titre, date, heure) et les participants selon le type.',
      },
    ],
  },

  event_participation: {
    id: 'event_participation',
    title: 'Participer à un événement',
    goal: 'Suivre un événement et/ou demander à y participer. ',
    where: ["Depuis l'onglet « Events à venir ».", "ou depuis la fiche d'une région/famille."],
    steps: [
      {
        title: 'Suivre les évènements',
        text: "Ouvre une région ou une famille puis ajoute ton mail pour recevoir automatiquement les futurs événements. Les événements nationaux sont visibles sans région sélectionnée.",
        expected: 'La région est maintenant suivie et les événements seront reçus par mail.',
      },
      {
        title: 'Demander une participation',
        text: 'Clique sur « Demander à participer » puis complète les informations demandées. Utilise une adresse mail valide pour pouvoir suivre ta demande.',
        expected: 'La demande est envoyée et pourra être suivie avec cette adresse mail.',
      },
      {
        title: 'Se désabonner',
        text: 'Tu ne souhaites plus recevoir les événements d’une région ? Remplis le mail concerné dans la barre Evenements à venir et clique sur « Se désabonner ». ',
        expected: 'Tu ne recevras plus les événements de cette région, tu recevras un mail de confirmation de désabonnement.',
      },
    ],
    warnings: [
      'Utilise toujours une adresse mail valide : elle permet de suivre ta demande et de recevoir les événements.',
      'Le créateur de l\'événement reste libre d\'accepter ou de refuser les demandes de participation.',
    ],
    troubleshooting: [
      {
        title: 'Je ne reçois pas de mail',
        text: 'Si aucun événement n\'arrive, vérifie les spams et l\'adresse mail saisie. Si aucun mail de confirmation n\'est reçu, contacte un administrateur.',
      },
    ],
  },

  admin_features: {
    id: 'admin_features',
    title: 'Fonctions Admin (régional / général)',
    goal: 'Modérer, corriger et maintenir la généalogie sans actions destructrices.',
    where: ['Bouton « Admin » (barre du haut).'],
    steps: [
      {
        title: 'Se connecter',
        text: "Clique sur « Admin » puis saisis le mot de passe. Sans mot de passe, tu restes en mode visiteur.",
        expected: 'Le statut admin s’affiche (général ou régional).',
      },
      {
        title: 'Modifier / valider',
        text: 'En admin, l’enregistrement d’une fiche applique les changements directement (au lieu d’une demande).',
        expected: 'Les modifications sont persistées après sauvegarde.',
      },
      {
        title: 'Supprimer avec prudence',
        text: 'La suppression demande une confirmation. Vérifie d’abord les doublons et les liens (parrains/fillots).',
        expected: 'La fiche est retirée et ses références dans les relations sont nettoyées.',
      },
      {
        title: 'Gérer les doublons',
        text: 'Utilise les outils de fusion/gestion des doublons (si disponibles) plutôt que supprimer “au hasard”.',
        expected: 'Une seule fiche propre reste, avec les relations conservées.',
      },
      {
        title: 'Droits visiteur vs admin',
        text: "Visiteur : peut proposer, parfois refusé. Admin : applique directement. En cas de doute, passe par « Doléances ».",
        expected: 'Tu sais quoi faire selon ton niveau de droits.',
      },
    ],
    warnings: [
      'Ne supprime pas sans être sûr : une suppression peut casser des branches.',
      'Toujours relire avant d’enregistrer en admin : c’est immédiat.',
    ],
    troubleshooting: [
      {
        title: 'Je ne vois pas les outils admin',
        text: 'Tu n’es pas connecté (ou la session admin n’est pas chargée). Ouvre Admin et reconnecte-toi.',
      },
    ],
  },
}

export const tutorialOrderFr = ['faluchard_create', 'crossed_baptism', 'event_create', 'event_participation', 'admin_features']

export const contextualHintsFr = {
  home: {
    title: 'Bien démarrer',
    text: "Active « Mode tutoriel » pour afficher des aides automatiques. Puis clique sur « Explorer l’arbre » ou « Ajouter une fiche ».",
    suggestedTutorialId: 'faluchard_create',
  },
  tree: {
    title: 'Lire l’arbre',
    text: 'Astuce : en Mode Réseau, utilise le halo + “Recentrer au profil sélectionné” pour comprendre les liens (surtout les croisements).',
    suggestedTutorialId: 'crossed_baptism',
  },
  creatingPerson: {
    title: 'Créer une fiche',
    text: 'Commence par enregistrer la fiche (brouillon → enregistré). Les liens “Famille” deviennent plus simples après.',
    suggestedTutorialId: 'faluchard_create',
  },
  upcoming: {
    title: 'Créer un événement',
    text: 'Choisis le type, puis complète les champs obligatoires. “Autre” peut activer les demandes si tu le souhaites.',
    suggestedTutorialId: 'event_create',
  },
  eventParticipation: {
  title: 'Participer à un événement',
  text: 'Suis une région, demande une participation ou désabonne-toi des notifications.',
  suggestedTutorialId: 'event_participation',
  },
  admin: {
    title: 'Mode admin',
    text: 'En admin, tes modifications sont directes. Vérifie avant de supprimer, et préfère la fusion pour les doublons.',
    suggestedTutorialId: 'admin_features',
  },
}

