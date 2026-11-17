// Chiffres affichés : tous mesurés par nous (modèles) ou tirés d'une source primaire datée (études).
// Vérifiés le 16/11/2026.

export const MODELS = {
  mammo: {
    nom: "Lésion de mammographie",
    tache: "Une lésion déjà repérée par un radiologue : plutôt bénigne ou plutôt maligne ?",
    archi: "EfficientNet-B0 (poids ImageNet de torchvision), affiné sur CBIS-DDSM",
    donnees: "CBIS-DDSM, The Cancer Imaging Archive, CC BY 3.0",
    test: "704 lésions du test officiel (378 masses, 326 calcifications)",
    auc: 0.754, ic: [0.717, 0.791],
    detail: "Masses 0,787 · calcifications 0,725 · sans les 28 patientes aussi présentes à l'entraînement 0,762",
    seuil: 0.2666, sens: 0.717, spec: 0.640,
    poids: "16 Mo",
  },
  pcam: {
    nom: "Imagette de ganglion",
    tache: "Une imagette de 96 × 96 pixels contient-elle du tissu métastatique en son centre ?",
    archi: "Petit réseau résiduel de 1,9 million de paramètres, entraîné de zéro",
    donnees: "PatchCamelyon, issu de CAMELYON16, CC0",
    test: "32 768 imagettes du test officiel",
    auc: 0.955, ic: [0.952, 0.957],
    detail: "Moyenne sur les 8 rotations et symétries de chaque imagette",
    seuil: 0.324, sens: 0.842, spec: 0.953,
    poids: "7,8 Mo",
  },
};

export interface Study { big: string; sub: string; title: string; text: string; cite: string; url: string; img: string }
export const STUDIES: Study[] = [
  {
    big: "+1,4", sub: "cancer trouvé en plus, pour 1 000 femmes dépistées",
    title: "Un second regard sur les mammographies",
    text: "En Suède, 105 934 femmes ont participé à un essai. Avec l'IA pour trier les mammographies, les radiologues ont trouvé 6,4 cancers pour 1 000 femmes, contre 5,0 sans elle. Et ils ont eu presque deux fois moins d'images à relire. L'IA ne décidait jamais seule.",
    cite: "Hernström et al., The Lancet Digital Health, 2025",
    url: "https://doi.org/10.1016/S2589-7500(24)00267-x",
    img: "icon-mammo",
  },
  {
    big: "Comme un expert", sub: "pour repérer des métastases au microscope",
    title: "Un œil qui ne se fatigue pas",
    text: "Lors d'un concours de recherche sur 129 lames de ganglions, le meilleur algorithme a repéré les métastases aussi bien qu'un pathologiste qui avait tout son temps, et mieux que des pathologistes pressés par l'horloge. C'était un test de recherche, pas encore l'hôpital.",
    cite: "Ehteshami Bejnordi et al., JAMA, 2017",
    url: "https://doi.org/10.1001/jama.2017.14585",
    img: "icon-microscope",
  },
  {
    big: "2 regards", sub: "sur chaque mammographie jugée normale, en France",
    title: "Un rôle qui existe déjà",
    text: "Dans le dépistage organisé, chaque mammographie jugée normale est relue par un second radiologue. C'est précisément ce rôle de second regard que les chercheurs testent aujourd'hui avec l'IA.",
    cite: "Institut national du cancer, le dépistage en pratique",
    url: "https://www.cancer.fr/toute-l-information-sur-les-cancers/se-faire-depister/les-depistages/depistage-du-cancer-du-sein/le-depistage-en-pratique",
    img: "icon-ia",
  },
];

export interface Actor { name: string; text: string; url: string; logo?: string }
export const ACTORS: Record<"public" | "associatif" | "prive", { label: string; items: Actor[] }> = {
  public: { label: "Public et hôpitaux", items: [
    { name: "Institut national du cancer (INCa)", logo: "inca.png", text: "L'agence d'expertise de l'État sur le cancer : information, recherche, dépistage.", url: "https://www.cancer.fr/" },
    { name: "Unicancer", logo: "unicancer.svg", text: "Le réseau des 18 centres de lutte contre le cancer et de deux établissements affiliés.", url: "https://www.unicancer.fr/fr/" },
    { name: "Gustave Roussy", logo: "gustave-roussy.svg", text: "Centre de lutte contre le cancer. Son programme PRISM, labellisé en 2023, s'appuie sur des jumeaux numériques créés par IA.", url: "https://www.gustaveroussy.fr/" },
    { name: "Institut Curie", logo: "curie.svg", text: "Centre de recherche et de soins. Son entrepôt de données de santé réunissait environ 360 000 dossiers de patients en 2023.", url: "https://curie.fr/" },
    { name: "Centre Léon Bérard", logo: "leon-berard.svg", text: "Centre de lutte contre le cancer de Lyon, qui mène des projets d'IA en cancérologie financés par France 2030.", url: "https://www.centreleonberard.fr/" },
    { name: "AP-HP, entrepôt de données", logo: "aphp.svg", text: "Les données de santé des 38 hôpitaux de l'AP-HP, réunies de façon sécurisée pour la recherche.", url: "https://eds.aphp.fr/" },
    { name: "Health Data Hub", logo: "health-data-hub.png", text: "La plateforme nationale qui facilite un accès sécurisé aux données de santé pour la recherche.", url: "https://www.health-data-hub.fr/" },
  ]},
  associatif: { label: "Associations", items: [
    { name: "Ligue contre le cancer", logo: "ligue.png", text: "Premier financeur associatif indépendant de la recherche contre le cancer, présente dans toute la France.", url: "https://www.ligue-cancer.net/" },
    { name: "Fondation ARC", logo: "fondation-arc.png", text: "Fondation qui finance la recherche sur le cancer, uniquement grâce aux dons et aux legs.", url: "https://www.fondation-arc.org/" },
  ]},
  prive: { label: "Entreprises", items: [
    { name: "Therapixel", logo: "therapixel.png", text: "Entreprise niçoise qui édite MammoScreen, une IA d'aide à la lecture des mammographies, autorisée aux États-Unis par la FDA.", url: "https://www.therapixel.com/" },
    { name: "Sanofi", logo: "sanofi.svg", text: "Groupe pharmaceutique qui mène des recherches en oncologie, notamment en immuno-oncologie, avec plus d'une douzaine de molécules en développement clinique contre des cancers du sang et des tumeurs solides.", url: "https://www.sanofi.com/fr/notre-science/domaines-therapeutiques/oncologie-recherche-developpement" },
    { name: "Owkin", logo: "owkin.svg", text: "IA appliquée à la recherche en cancérologie, pour comprendre quels patients répondent aux traitements.", url: "https://www.owkin.com/" },
    { name: "Waiv", logo: "waiv.png", text: "Issue d'Owkin, elle développe des tests d'IA sur lames, dont un qui estime le risque de rechute de certains cancers du sein.", url: "https://waiv.com/" },
    { name: "Gleamer", logo: "gleamer.svg", text: "IA d'aide à la lecture des images de radiologie, dont un module pour les lésions du sein en mammographie.", url: "https://www.gleamer.ai/" },
    { name: "Incepto", logo: "incepto.png", text: "Plateforme qui réunit des outils d'IA pour la radiologie et les intègre dans les hôpitaux.", url: "https://incepto-medical.com/" },
  ]},
};

export const SOURCES: { titre: string; items: [string, string][] }[] = [
  { titre: "Données", items: [
    ["CBIS-DDSM, The Cancer Imaging Archive, CC BY 3.0, DOI 10.7937/K9/TCIA.2016.7O02S9CY", "https://www.cancerimagingarchive.net/collection/cbis-ddsm/"],
    ["Lee et al., A curated mammography data set for use in computer-aided detection and diagnosis research, Scientific Data, 2017", "https://doi.org/10.1038/sdata.2017.177"],
    ["CAMELYON16, Radboudumc et UMC Utrecht, CC0, AWS Open Data (lame tumor_091)", "https://registry.opendata.aws/camelyon/"],
    ["PatchCamelyon (CC0), Veeling et al., MICCAI 2018", "https://github.com/basveeling/pcam"],
    ["Litjens et al., 1399 H&E-stained sentinel lymph node sections of breast cancer patients: the CAMELYON dataset, GigaScience, 2018", "https://doi.org/10.1093/gigascience/giy065"],
  ]},
  { titre: "Études et repères médicaux", items: [
    ["Ehteshami Bejnordi et al., JAMA 2017;318(22):2199-2210", "https://doi.org/10.1001/jama.2017.14585"],
    ["Lång et al., essai MASAI, The Lancet Oncology, 2023", "https://doi.org/10.1016/S1470-2045(23)00298-x"],
    ["Hernström et al., essai MASAI, The Lancet Digital Health, 2025", "https://doi.org/10.1016/S2589-7500(24)00267-x"],
    ["Institut national du cancer, Panorama des cancers en France, édition 2026", "https://www.cancer.fr/content/download/141527/file/PANOKFR2026_Panorama%20des%20cancers%202026.pdf"],
    ["Ameli, symptômes du cancer du sein", "https://www.ameli.fr/assure/sante/themes/cancer-sein/symptomes-diagnostic"],
    ["Service-public.fr, dépistage organisé du cancer du sein", "https://www.service-public.gouv.fr/particuliers/actualites/A15216"],
    ["Institut national du cancer, exérèse du ganglion sentinelle", "https://www.cancer.fr/personnes-malades/les-cancers/sein/les-traitements-des-cancers-du-sein/chirurgie-tumorectomie-et-mastectomie/exerese-du-ganglion-sentinelle"],
    ["HAS, classification ACR des images mammographiques", "https://www.has-sante.fr/upload/docs/application/pdf/ACR.pdf"],
    ["Fischer et al., Hematoxylin and eosin staining, CSH Protocols, 2008", "https://doi.org/10.1101/pdb.prot4986"],
  ]},
  { titre: "Limites, à lire", items: [
    ["Outil pédagogique : pas un dispositif médical au sens du règlement (UE) 2017/745, aucun usage clinique.", ""],
    ["Le modèle de mammographie ne voit qu'une lésion déjà délimitée, sur d'anciens films numérisés. Il ne dépiste rien.", ""],
    ["Illustrations générées par IA (GPT Image) à partir de nos consignes ; aucune ne représente une personne ni une image médicale réelle.", ""],
    ["Les poids ImageNet de départ (torchvision) n'ont pas de licence explicite propre ; le modèle de la lame, lui, est entraîné de zéro.", ""],
    ["Scores mesurés le 16/11/2026 sur les parties de test officielles ; seuils choisis sur la validation, jamais sur le test.", ""],
    ["Logiciels : ONNX Runtime Web (MIT), OpenSeadragon (BSD-3), GSAP (licence standard gratuite), Lenis (MIT), PyTorch (BSD-3).", ""],
  ]},
];
