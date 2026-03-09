let programmes = [];
let programmeActuel = null;
let indexEtape = 0;
let cycleActuel = 1;

// 1. Charger les données
fetch('exercices.json')
    .then(res => res.json())
    .then(data => {
        programmes = data.programmes;
        afficherMenu();
    });

function afficherMenu() {
    const liste = document.getElementById('liste-programmes');
    programmes.forEach(p => {
        const btn = document.createElement('button');
        btn.innerText = p.titre;
        btn.onclick = () => demarrerProgramme(p);
        liste.appendChild(btn);
    });
}

function demarrerProgramme(p) {
    programmeActuel = p;
    indexEtape = 0;
    cycleActuel = 1;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('entrainement').classList.remove('hidden');
    lancerEtape();
}

function lancerEtape() {
    const etape = programmeActuel.etapes[indexEtape];
    const display = document.getElementById('timer');
    const titre = document.getElementById('titre-etape');
    const infos = document.getElementById('infos');
    
    document.body.style.backgroundColor = etape.couleur;
    titre.innerText = etape.nom;
    infos.innerText = `Cycle ${cycleActuel} / ${programmeActuel.repetitions}`;

    let temps = etape.duree;
    display.innerText = temps;

    const interval = setInterval(() => {
        temps--;
        display.innerText = temps;

        if (temps <= 0) {
            clearInterval(interval);
            passerALaSuite();
        }
    }, 1000);
}

function passerALaSuite() {
    indexEtape++;
    
    // Si on a fini toutes les étapes d'un cycle
    if (indexEtape >= programmeActuel.etapes.length) {
        if (cycleActuel < programmeActuel.repetitions) {
            indexEtape = 0; // On recommence les étapes
            cycleActuel++;
            lancerEtape();
        } else {
            // Fin du programme
            alert("Bravo ! Séance terminée.");
            location.reload(); 
        }
    } else {
        lancerEtape();
    }
}