let programmes = [];
let fileAttente = []; // Liste plate de toutes les étapes à venir
let indexActuel = 0;

fetch('exercices.json')
    .then(res => res.json())
    .then(data => {
        programmes = data.programmes;
        afficherMenu();
    });

function afficherMenu() {
    const liste = document.getElementById('liste-programmes');
    liste.innerHTML = ""; 
    programmes.forEach(p => {
        const btn = document.createElement('button');
        btn.innerText = p.titre;
        btn.onclick = () => preparerEtDemarrer(p);
        liste.appendChild(btn);
    });
}

function preparerEtDemarrer(p) {
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
        location.reload();
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

    let tempsTotal = etape.duree;
    let tempsRestant = etape.duree;
    
    // Initialisation de la barre à 100%
    progressBar.style.width = "100%";
    display.innerText = tempsRestant;

    const interval = setInterval(() => {
        tempsRestant--;
        display.innerText = tempsRestant;

        // Mise à jour de la barre visuelle
        const pourcentage = (tempsRestant / tempsTotal) * 100;
        progressBar.style.width = pourcentage + "%";

        if (tempsRestant > 0 && tempsRestant <= 3) {
            emettreBip(440, 0.1);
        }
        
        if (tempsRestant <= 0) {
            clearInterval(interval);
            emettreBip(880, 0.3);
            indexActuel++;
            executerEtape();
        }
    }, 1000);
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