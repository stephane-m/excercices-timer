const cleProgrammes = 'exercice-timer.programmes';
const cleOrdreProgrammes = 'exercice-timer.ordre-programmes';
const cleTheme = 'exercice-timer.theme';
let programmesPreenregistres = [];
const menu = document.getElementById('menu');
const editeur = document.getElementById('editeur');
const formulaire = document.getElementById('formulaire-programme');
const blocs = document.getElementById('blocs');
const messageMenu = document.getElementById('message-menu');
const messageEditeur = document.getElementById('message-editeur');
const boutonNouveau = document.getElementById('nouveau-programme');
const boutonExporter = document.getElementById('exporter-programmes');
const boutonImporter = document.getElementById('importer-programmes');
const fichierProgrammes = document.getElementById('fichier-programmes');
const messageTransfert = document.getElementById('message-transfert');
let programmeEdite = null;
let fileAttente = []; // Liste plate de toutes les étapes à venir
let indexActuel = 0;
let intervalle = null;
let tempsRestant = 0;
let tempsProgrammeRestant = 0;
const affichageTempsProgramme = document.getElementById('temps-programme');

const boutonPause = document.getElementById('pause');
boutonPause.onclick = basculerPause;
document.getElementById('accueil').onclick = retournerAccueil;

boutonNouveau.onclick = () => ouvrirEditeur();
document.getElementById('annuler-edition').onclick = fermerEditeur;
document.getElementById('ajouter-etape').onclick = () => ajouterEtape(blocs).focus();
document.getElementById('ajouter-boucle').onclick = () => ajouterBoucle().focus();
formulaire.onsubmit = enregistrerProgramme;
boutonExporter.onclick = exporterProgrammes;
boutonImporter.onclick = () => fichierProgrammes.click();
fichierProgrammes.onchange = importerProgrammes;

const choixTheme = document.getElementById('theme');
try {
    const themeSauvegarde = localStorage.getItem(cleTheme);
    if (Array.from(choixTheme.options).some(option => option.value === themeSauvegarde)) {
        choixTheme.value = themeSauvegarde;
    }
} catch {
    // Le thème par défaut reste disponible si le stockage est bloqué.
}
document.documentElement.dataset.theme = choixTheme.value;
choixTheme.onchange = () => {
    document.documentElement.dataset.theme = choixTheme.value;
    const message = document.getElementById('message-theme');
    try {
        localStorage.setItem(cleTheme, choixTheme.value);
        effacerMessage(message);
    } catch {
        afficherMessage(message, 'themeErreur');
    }
};

const cleLangue = 'exercice-timer.langue';
const choixLangue = document.getElementById('langue');
try {
    if (localStorage.getItem(cleLangue) === 'en') choixLangue.value = 'en';
} catch {
    // Le français reste disponible lorsque le stockage est inaccessible.
}

function traduire(cle, valeurs = {}) {
    const texte = traductions[cle][choixLangue.value === 'en' ? 1 : 0];
    return texte.replace(/\{(\w+)\}/g, (_, nom) => valeurs[nom]);
}

const messagesActifs = new Map();

function afficherMessage(element, cle, valeurs) {
    messagesActifs.set(element, { cle, valeurs });
    element.textContent = traduire(cle, valeurs);
}

function effacerMessage(element) {
    messagesActifs.delete(element);
    element.textContent = '';
}

function traduireInterface() {
    for (const [element, { cle, valeurs }] of messagesActifs) {
        element.textContent = traduire(cle, valeurs);
    }
    document.documentElement.lang = choixLangue.value;
    for (const racine of [document, ...Array.from(document.querySelectorAll('template'), modele => modele.content)]) {
        racine.querySelectorAll('[data-i18n]').forEach(element => {
            element.textContent = traduire(element.dataset.i18n);
        });
        racine.querySelectorAll('[data-i18n-label]').forEach(element => {
            element.setAttribute('aria-label', traduire(element.dataset.i18nLabel));
        });
    }
}

choixLangue.onchange = () => {
    traduireInterface();
    afficherMenu();
    const message = document.getElementById('message-langue');
    try {
        localStorage.setItem(cleLangue, choixLangue.value);
        effacerMessage(message);
    } catch {
        afficherMessage(message, 'langueErreur');
    }
};

traduireInterface();
initialiserProgrammes();

async function initialiserProgrammes() {
    try {
        const reponse = await fetch('exercices.json');
        if (!reponse.ok) throw new Error('Chargement des programmes impossible');
        const donnees = await reponse.json();
        programmesPreenregistres = donnees.programmes;
    } catch {
        afficherMessage(messageMenu, 'programmesErreur');
    }
    afficherMenu();
    boutonNouveau.disabled = false;
    boutonImporter.disabled = false;
}

function lireProgrammesLocaux() {
    return JSON.parse(localStorage.getItem(cleProgrammes) ?? '[]');
}

function sauvegarderProgrammeLocal(programme) {
    const programmes = new Map(lireProgrammesLocaux().map(p => [p.id, p]));
    programmes.set(programme.id, programme);
    localStorage.setItem(cleProgrammes, JSON.stringify([...programmes.values()]));
}

function dureeProgramme(programme) {
    return programme.structure.reduce((secondes, bloc) => {
        if (bloc.type === 'unique') return secondes + bloc.duree;
        if (bloc.type === 'boucle') {
            return secondes + bloc.repetitions * bloc.etapes.reduce((somme, etape) => somme + etape.duree, 0);
        }
        return secondes;
    }, 0);
}

function formaterDuree(total) {
    const heures = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const secondes = total % 60;
    return [
        heures ? `${heures} h` : '',
        minutes ? `${minutes} min` : '',
        secondes || !total ? `${secondes} s` : ''
    ].filter(Boolean).join(' ');
}

function programmesDisponibles(locaux) {
    const programmes = new Map(programmesPreenregistres.map(p => [p.id, p]));
    locaux.forEach(p => {
        if (p.supprime) programmes.delete(p.id);
        else programmes.set(p.id, p);
    });
    return programmes;
}

function ordonnerProgrammes(programmes) {
    const ordre = new Set();
    try {
        const sauvegarde = JSON.parse(localStorage.getItem(cleOrdreProgrammes) ?? '[]');
        if (Array.isArray(sauvegarde)) sauvegarde.forEach(id => ordre.add(id));
    } catch {
        // Utiliser l’ordre par défaut si la préférence est inaccessible.
    }
    programmes.forEach(p => ordre.add(p.id));
    return [...ordre].filter(id => programmes.has(id));
}

function afficherMenu(focusOrdre) {
    const liste = document.getElementById('liste-programmes');
    let programmes;
    try {
        programmes = programmesDisponibles(lireProgrammesLocaux());
    } catch {
        programmes = programmesDisponibles([]);
        afficherMessage(messageMenu, 'stockageErreur');
    }
    boutonExporter.disabled = programmes.size === 0;
    liste.replaceChildren();
    const ordre = ordonnerProgrammes(programmes);
    ordre.forEach((id, index) => {
        const p = programmes.get(id);
        const carte = document.createElement('article');
        carte.className = 'programme';
        const entete = document.createElement('div');
        entete.className = 'en-tete-programme';
        const titre = document.createElement('h2');
        titre.textContent = p.titre;
        entete.append(titre);
        const duree = document.createElement('p');
        duree.className = 'duree-programme';
        duree.textContent = traduire('dureeTotale', { duree: formaterDuree(dureeProgramme(p)) });
        const actions = document.createElement('div');
        actions.className = 'actions';
        const demarrer = document.createElement('button');
        demarrer.type = 'button';
        demarrer.className = 'principal';
        demarrer.textContent = traduire('demarrer');
        demarrer.onclick = () => preparerEtDemarrer(p);
        const modifier = document.createElement('button');
        modifier.type = 'button';
        modifier.textContent = traduire('modifier');
        modifier.onclick = () => ouvrirEditeur(p);
        const supprimer = document.createElement('button');
        supprimer.type = 'button';
        supprimer.className = 'danger';
        supprimer.textContent = traduire('supprimer');
        supprimer.setAttribute('aria-label', traduire('supprimerProgramme', { nom: p.titre }));
        supprimer.onclick = () => supprimerProgramme(p);
        actions.append(demarrer, modifier, supprimer);
        if (ordre.length > 1) {
            const poignee = document.createElement('button');
            poignee.type = 'button';
            poignee.className = 'poignee-programme';
            poignee.textContent = '↕';
            poignee.setAttribute('aria-label', traduire('deplacer', { nom: p.titre, index: index + 1, total: ordre.length }));
            poignee.setAttribute('aria-description', traduire('deplacerAide'));
            configurerPoignee(poignee, carte, liste, ordre, index);
            entete.append(poignee);
        }
        carte.append(entete, duree, actions);
        liste.append(carte);
        if (focusOrdre === id) entete.querySelector('.poignee-programme')?.focus();
    });
}

function configurerPoignee(poignee, carte, liste, ordre, index) {
    let pointeur = null;
    let animation;
    let positionY;
    let destination = index;
    let repere;
    const autresCartes = () => Array.from(liste.children).filter(element => element !== carte);

    function actualiserDestination() {
        repere?.classList.remove('depot-avant', 'depot-apres');
        const cartes = autresCartes();
        destination = cartes.findIndex(element => {
            const rect = element.getBoundingClientRect();
            return positionY < rect.top + rect.height / 2;
        });
        if (destination === -1) destination = cartes.length;
        repere = destination === index ? null : cartes[destination] ?? cartes.at(-1);
        repere?.classList.add(destination === cartes.length ? 'depot-apres' : 'depot-avant');
    }

    function defiler() {
        const marge = 64;
        if (positionY < marge) window.scrollBy(0, -10);
        else if (positionY > window.innerHeight - marge) window.scrollBy(0, 10);
        actualiserDestination();
        animation = requestAnimationFrame(defiler);
    }

    function terminer() {
        pointeur = null;
        cancelAnimationFrame(animation);
        carte.classList.remove('deplacement');
        repere?.classList.remove('depot-avant', 'depot-apres');
    }

    poignee.onpointerdown = evenement => {
        if (!evenement.isPrimary || evenement.button !== 0) return;
        pointeur = evenement.pointerId;
        positionY = evenement.clientY;
        poignee.setPointerCapture(pointeur);
        carte.classList.add('deplacement');
        animation = requestAnimationFrame(defiler);
    };
    poignee.onpointermove = evenement => {
        if (evenement.pointerId === pointeur) positionY = evenement.clientY;
    };
    poignee.onpointerup = evenement => {
        if (evenement.pointerId !== pointeur) return;
        positionY = evenement.clientY;
        actualiserDestination();
        terminer();
        deplacerProgramme(ordre, index, destination);
    };
    poignee.onlostpointercapture = evenement => {
        if (evenement.pointerId === pointeur) terminer();
    };
    poignee.onkeydown = evenement => {
        if (evenement.key !== 'ArrowUp' && evenement.key !== 'ArrowDown') return;
        evenement.preventDefault();
        deplacerProgramme(ordre, index, index + (evenement.key === 'ArrowUp' ? -1 : 1), true);
    };
}

function deplacerProgramme(ordre, index, destination, garderFocus = false) {
    if (destination === index || destination < 0 || destination >= ordre.length) return;
    const nouvelOrdre = [...ordre];
    const [id] = nouvelOrdre.splice(index, 1);
    nouvelOrdre.splice(destination, 0, id);
    try {
        localStorage.setItem(cleOrdreProgrammes, JSON.stringify(nouvelOrdre));
    } catch {
        afficherMessage(messageMenu, 'ordreErreur');
        return;
    }
    effacerMessage(messageMenu);
    afficherMenu(garderFocus ? id : undefined);
}

function exporterProgrammes() {
    let programmes;
    try {
        programmes = [...programmesDisponibles(lireProgrammesLocaux()).values()];
    } catch {
        afficherMessage(messageTransfert, 'exportErreur');
        return;
    }
    const fichier = new Blob([JSON.stringify({ programmes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(fichier);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = 'exercice-timer-programmes.json';
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    afficherMessage(messageTransfert, 'exportPret');
}

function etapeImportable(etape) {
    return typeof etape?.nom === 'string' && Boolean(etape.nom.trim())
        && Number.isSafeInteger(etape.duree) && etape.duree > 0
        && typeof etape.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(etape.couleur);
}

function programmeImportable(programme) {
    return typeof programme?.id === 'string' && Boolean(programme.id.trim()) && !programme.supprime
        && typeof programme.titre === 'string' && Boolean(programme.titre.trim())
        && Array.isArray(programme.structure) && programme.structure.length > 0
        && programme.structure.every(bloc => {
            if (bloc?.type === 'unique') return etapeImportable(bloc);
            return bloc?.type === 'boucle'
                && Number.isInteger(bloc.repetitions) && bloc.repetitions >= 1 && bloc.repetitions <= 1000
                && Array.isArray(bloc.etapes) && bloc.etapes.length > 0 && bloc.etapes.every(etapeImportable);
        })
        && Number.isSafeInteger(dureeProgramme(programme));
}

async function importerProgrammes() {
    const fichier = fichierProgrammes.files[0];
    if (!fichier) return;
    fichierProgrammes.value = '';
    boutonImporter.disabled = true;
    try {
        const donnees = JSON.parse(await fichier.text());
        const programmes = donnees?.programmes;
        if (!Array.isArray(programmes) || !programmes.length || !programmes.every(programmeImportable)
            || new Set(programmes.map(p => p.id)).size !== programmes.length) {
            afficherMessage(messageTransfert, 'importInvalide');
            return;
        }
        const locaux = new Map(lireProgrammesLocaux().map(p => [p.id, p]));
        const existants = programmesDisponibles([...locaux.values()]);
        const remplacements = programmes.filter(p => existants.has(p.id) && locaux.has(p.id)).length;
        if (remplacements && !confirm(traduire('confirmerImport', { nombre: remplacements }))) {
            afficherMessage(messageTransfert, 'importAnnule');
            return;
        }
        programmes.forEach(p => locaux.set(p.id, p));
        localStorage.setItem(cleProgrammes, JSON.stringify([...locaux.values()]));
        afficherMenu();
        afficherMessage(messageTransfert, programmes.length === 1 ? 'importUn' : 'importPlusieurs', { nombre: programmes.length });
    } catch (erreur) {
        afficherMessage(messageTransfert, erreur instanceof SyntaxError ? 'jsonInvalide' : 'importErreur');
    } finally {
        boutonImporter.disabled = false;
    }
}

function supprimerProgramme(programme) {
    if (!confirm(traduire('confirmerSuppression', { nom: programme.titre }))) return;
    try {
        // L’identifiant seul suffit à empêcher un programme fourni de réapparaître.
        sauvegarderProgrammeLocal({ id: programme.id, supprime: true });
    } catch {
        afficherMessage(messageMenu, 'suppressionErreur');
        return;
    }
    effacerMessage(messageMenu);
    afficherMenu();
    boutonNouveau.focus();
}

function ouvrirEditeur(programme = null) {
    programmeEdite = programme;
    document.getElementById('titre-editeur').textContent = programme ? traduire('modifierProgramme') : traduire('nouveau');
    formulaire.elements.titre.value = programme?.titre ?? '';
    blocs.replaceChildren();
    effacerMessage(messageEditeur);
    if (programme) {
        programme.structure.forEach(bloc => {
            if (bloc.type === 'boucle') ajouterBoucle(bloc);
            else ajouterEtape(blocs, bloc);
        });
    } else {
        ajouterEtape(blocs);
    }
    menu.classList.add('hidden');
    editeur.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function fermerEditeur() {
    editeur.classList.add('hidden');
    menu.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function actualiserBoutonsOrdre(conteneur) {
    for (const bloc of conteneur.children) {
        bloc.querySelector(':scope > .actions > .monter').disabled = !bloc.previousElementSibling;
        bloc.querySelector(':scope > .actions > .descendre').disabled = !bloc.nextElementSibling;
    }
}

function configurerBloc(bloc, conteneur, selecteurSuppression) {
    const monter = bloc.querySelector(':scope > .actions > .monter');
    const descendre = bloc.querySelector(':scope > .actions > .descendre');
    monter.onclick = () => {
        bloc.previousElementSibling.before(bloc);
        actualiserBoutonsOrdre(conteneur);
        (monter.disabled ? descendre : monter).focus();
    };
    descendre.onclick = () => {
        bloc.nextElementSibling.after(bloc);
        actualiserBoutonsOrdre(conteneur);
        (descendre.disabled ? monter : descendre).focus();
    };
    bloc.querySelector(selecteurSuppression).onclick = () => {
        bloc.remove();
        actualiserBoutonsOrdre(conteneur);
    };
    conteneur.append(bloc);
    actualiserBoutonsOrdre(conteneur);
}

function ajouterEtape(conteneur, etape = {}) {
    const bloc = document.getElementById('modele-etape').content.firstElementChild.cloneNode(true);
    const nom = bloc.querySelector('[name="nom"]');
    nom.value = etape.nom ?? '';
    bloc.querySelector('[name="duree"]').value = etape.duree ?? 30;
    bloc.querySelector('[name="couleur"]').value = etape.couleur ?? '#e67e22';
    configurerBloc(bloc, conteneur, '.supprimer');
    return nom;
}

function ajouterBoucle(boucle = { repetitions: 2, etapes: [{}] }) {
    const bloc = document.getElementById('modele-boucle').content.firstElementChild.cloneNode(true);
    const repetitions = bloc.querySelector('[name="repetitions"]');
    const etapes = bloc.querySelector('.etapes');
    repetitions.value = boucle.repetitions;
    boucle.etapes.forEach(etape => ajouterEtape(etapes, etape));
    bloc.querySelector('.ajouter').onclick = () => ajouterEtape(etapes).focus();
    configurerBloc(bloc, blocs, '.supprimer-boucle');
    return repetitions;
}

function lireEtape(bloc) {
    const nom = bloc.querySelector('[name="nom"]').value.trim();
    const duree = bloc.querySelector('[name="duree"]').valueAsNumber;
    const couleur = bloc.querySelector('[name="couleur"]').value;
    return { nom, duree, couleur };
}

function enregistrerProgramme(evenement) {
    evenement.preventDefault();
    const titre = formulaire.elements.titre.value.trim();
    const structure = Array.from(blocs.children, bloc => {
        if (bloc.classList.contains('boucle')) {
            return {
                type: 'boucle',
                repetitions: bloc.querySelector('[name="repetitions"]').valueAsNumber,
                etapes: Array.from(bloc.querySelector('.etapes').children, lireEtape)
            };
        }
        return { type: 'unique', ...lireEtape(bloc) };
    });
    if (!titre || !structure.length || structure.some(bloc =>
        bloc.type === 'boucle' ? !bloc.etapes.length || bloc.etapes.some(etape => !etape.nom) : !bloc.nom
    )) {
        afficherMessage(messageEditeur, 'formulaireInvalide');
        return;
    }
    try {
        const id = programmeEdite?.id ?? `perso-${Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')}`;
        sauvegarderProgrammeLocal({ id, titre, structure });
    } catch {
        afficherMessage(messageEditeur, 'enregistrementErreur');
        return;
    }
    afficherMenu();
    fermerEditeur();
}

let wakeLock = null;

async function maintenirEcranAllume() {
    try {
        // Demande au navigateur de garder l'écran actif
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("L'écran restera allumé !");
            
            // Si l'onglet est réduit puis réouvert, on doit redemander le lock
            document.addEventListener('visibilitychange', async () => {
                if (wakeLock !== null && document.visibilityState === 'visible') {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            });
        }
    } catch (err) {
        console.error(`Erreur Wake Lock: ${err.name}, ${err.message}`);
    }
}

function preparerEtDemarrer(p) {
    maintenirEcranAllume();

    fileAttente = [];
    indexActuel = 0;
    tempsProgrammeRestant = dureeProgramme(p);
    affichageTempsProgramme.textContent = formaterDuree(tempsProgrammeRestant);

    // Transformation de la structure complexe en liste simple
    p.structure.forEach(bloc => {
        if (bloc.type === "unique") {
            fileAttente.push(bloc);
        } else if (bloc.type === "boucle") {
            for (let i = 0; i < bloc.repetitions; i++) {
                bloc.etapes.forEach(e => {
                    fileAttente.push({ ...e, cycleInfo: traduire('serieCompteur', { index: i + 1, total: bloc.repetitions }) });
                });
            }
        }
    });

    document.getElementById('menu').classList.add('hidden');
    document.getElementById('entrainement').classList.remove('hidden');
    executerEtape();
}

function executerEtape() {
    if (indexActuel >= fileAttente.length) {
        alert(traduire('fin'));
        retournerAccueil();
        return;
    }

    const etape = fileAttente[indexActuel];
    const display = document.getElementById('timer');
    const titre = document.getElementById('titre-etape');
    const infos = document.getElementById('infos');
    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('progress-container');

    // Afficher la barre de progression
    progressContainer.classList.remove('hidden');

    document.body.style.backgroundColor = etape.couleur;
    titre.innerText = etape.nom;
    infos.innerText = etape.cycleInfo || "";
    const suivante = fileAttente[indexActuel + 1];
    document.getElementById('etape-suivante').textContent = suivante
        ? traduire('suivante', { nom: suivante.nom })
        : traduire('derniere');

    tempsRestant = etape.duree;
    
    // Initialisation de la barre à 100%
    progressBar.style.width = "100%";
    display.innerText = tempsRestant;
    lancerCompteARebours();
}

function lancerCompteARebours() {
    const display = document.getElementById('timer');
    const progressBar = document.getElementById('progress-bar');
    const tempsTotal = fileAttente[indexActuel].duree;

    intervalle = setInterval(() => {
        tempsRestant--;
        tempsProgrammeRestant--;
        display.innerText = tempsRestant;
        affichageTempsProgramme.textContent = formaterDuree(tempsProgrammeRestant);

        // Mise à jour de la barre visuelle
        const pourcentage = (tempsRestant / tempsTotal) * 100;
        progressBar.style.width = pourcentage + "%";

        if (tempsRestant > 0 && tempsRestant <= 3) {
            emettreBip(440, 0.1);
        }
        
        if (tempsRestant <= 0) {
            arreterCompteARebours();
            emettreBip(880, 0.3);
            indexActuel++;
            executerEtape();
        }
    }, 1000);
}

function arreterCompteARebours() {
    clearInterval(intervalle);
    intervalle = null;
}

function basculerPause() {
    if (intervalle === null) {
        lancerCompteARebours();
        boutonPause.innerText = traduire('pause');
    } else {
        arreterCompteARebours();
        boutonPause.innerText = traduire('reprendre');
    }
}

function retournerAccueil() {
    arreterCompteARebours();
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
    }
    location.reload();
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function emettreBip(frequence = 440, duree = 0.1) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    //oscillator.type = 'square'; // son plus "agressif"
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequence, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Volume à 10%
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duree);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duree);
}
