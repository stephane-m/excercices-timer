const cleProgrammes = 'exercice-timer.programmes';
const cleTheme = 'exercice-timer.theme';
let programmesPreenregistres = [];
const menu = document.getElementById('menu');
const editeur = document.getElementById('editeur');
const formulaire = document.getElementById('formulaire-programme');
const blocs = document.getElementById('blocs');
const messageMenu = document.getElementById('message-menu');
const messageEditeur = document.getElementById('message-editeur');
const boutonNouveau = document.getElementById('nouveau-programme');
let programmeEdite = null;
let fileAttente = []; // Liste plate de toutes les étapes à venir
let indexActuel = 0;
let intervalle = null;
let tempsRestant = 0;

const boutonPause = document.getElementById('pause');
boutonPause.onclick = basculerPause;
document.getElementById('accueil').onclick = retournerAccueil;

boutonNouveau.onclick = () => ouvrirEditeur();
document.getElementById('annuler-edition').onclick = fermerEditeur;
document.getElementById('ajouter-etape').onclick = () => ajouterEtape(blocs).focus();
document.getElementById('ajouter-boucle').onclick = () => ajouterBoucle().focus();
formulaire.onsubmit = enregistrerProgramme;

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
        message.textContent = '';
    } catch {
        message.textContent = 'Le thème est appliqué pour cette visite. Le navigateur a refusé de le mémoriser.';
    }
};

initialiserProgrammes();

async function initialiserProgrammes() {
    try {
        const reponse = await fetch('exercices.json');
        if (!reponse.ok) throw new Error('Chargement des programmes impossible');
        const donnees = await reponse.json();
        programmesPreenregistres = donnees.programmes;
    } catch {
        messageMenu.textContent = 'Les programmes préenregistrés sont indisponibles.';
    }
    afficherMenu();
    boutonNouveau.disabled = false;
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
    const total = programme.structure.reduce((secondes, bloc) => {
        if (bloc.type === 'unique') return secondes + bloc.duree;
        if (bloc.type === 'boucle') {
            return secondes + bloc.repetitions * bloc.etapes.reduce((somme, etape) => somme + etape.duree, 0);
        }
        return secondes;
    }, 0);
    const heures = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const secondes = total % 60;
    return [
        heures ? `${heures} h` : '',
        minutes ? `${minutes} min` : '',
        secondes || !total ? `${secondes} s` : ''
    ].filter(Boolean).join(' ');
}

function afficherMenu() {
    const liste = document.getElementById('liste-programmes');
    const programmes = new Map(programmesPreenregistres.map(p => [p.id, p]));
    try {
        lireProgrammesLocaux().forEach(p => {
            if (p.supprime) programmes.delete(p.id);
            else programmes.set(p.id, p);
        });
    } catch {
        messageMenu.textContent = 'Les programmes enregistrés sur cet appareil sont inaccessibles.';
    }
    liste.replaceChildren();
    programmes.forEach(p => {
        const carte = document.createElement('article');
        carte.className = 'programme';
        const titre = document.createElement('h2');
        titre.textContent = p.titre;
        const duree = document.createElement('p');
        duree.className = 'duree-programme';
        duree.textContent = `Durée totale · ${dureeProgramme(p)}`;
        const actions = document.createElement('div');
        actions.className = 'actions';
        const demarrer = document.createElement('button');
        demarrer.type = 'button';
        demarrer.className = 'principal';
        demarrer.textContent = 'Démarrer';
        demarrer.onclick = () => preparerEtDemarrer(p);
        const modifier = document.createElement('button');
        modifier.type = 'button';
        modifier.textContent = 'Modifier';
        modifier.onclick = () => ouvrirEditeur(p);
        const supprimer = document.createElement('button');
        supprimer.type = 'button';
        supprimer.className = 'danger';
        supprimer.textContent = 'Supprimer';
        supprimer.setAttribute('aria-label', `Supprimer le programme ${p.titre}`);
        supprimer.onclick = () => supprimerProgramme(p);
        actions.append(demarrer, modifier, supprimer);
        carte.append(titre, duree, actions);
        liste.append(carte);
    });
}

function supprimerProgramme(programme) {
    if (!confirm(`Supprimer le programme « ${programme.titre} » ?`)) return;
    try {
        // L’identifiant seul suffit à empêcher un programme fourni de réapparaître.
        sauvegarderProgrammeLocal({ id: programme.id, supprime: true });
    } catch {
        messageMenu.textContent = 'Suppression impossible. Vérifie que le navigateur autorise le stockage local.';
        return;
    }
    messageMenu.textContent = '';
    afficherMenu();
    boutonNouveau.focus();
}

function ouvrirEditeur(programme = null) {
    programmeEdite = programme;
    document.getElementById('titre-editeur').textContent = programme ? 'Modifier le programme' : 'Nouveau programme';
    formulaire.elements.titre.value = programme?.titre ?? '';
    blocs.replaceChildren();
    messageEditeur.textContent = '';
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
        messageEditeur.textContent = 'Donne un nom au programme et à chaque étape, et ajoute au moins une étape par programme et par série.';
        return;
    }
    try {
        const id = programmeEdite?.id ?? `perso-${Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')}`;
        sauvegarderProgrammeLocal({ id, titre, structure });
    } catch {
        messageEditeur.textContent = 'Enregistrement impossible. Vérifie que le navigateur autorise le stockage local.';
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

    // Transformation de la structure complexe en liste simple
    p.structure.forEach(bloc => {
        if (bloc.type === "unique") {
            fileAttente.push(bloc);
        } else if (bloc.type === "boucle") {
            for (let i = 0; i < bloc.repetitions; i++) {
                bloc.etapes.forEach(e => {
                    fileAttente.push({ ...e, cycleInfo: `Série ${i + 1}/${bloc.repetitions}` });
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
        alert("Séance terminée ! Bravo !");
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
        display.innerText = tempsRestant;

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
        boutonPause.innerText = "Pause";
    } else {
        arreterCompteARebours();
        boutonPause.innerText = "Reprendre";
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
