# Exercise Timer

Exercise Timer is a mobile-friendly web app for building and running timed routines for stretching, workouts, and other exercises. Choose French or English in **Settings**. Program and step names stay in their original language.

## Access the app online

App page can be loaded at https://stephane-m.github.io/excercices-timer/ 

## Using the app

- Select **Nouveau programme** to create a routine, or **Modifier** to edit an existing one. A routine can contain one-off steps and groups of steps that repeat a set number of times. Each step has a name, a duration in seconds, and a background color.
- Select **Démarrer** to begin. The app shows the current step, remaining time, a progress bar, and the current round for repeated groups. Audio cues mark the final seconds and the transition to the next step. The app requests that the screen stay awake when the browser supports it.
- Use **Pause** and **Reprendre** to pause and resume, or **Retour à l’accueil** to end the session and return to the program list.
- Select **Supprimer** and confirm to remove a program from the list.

The app comes with three sample routines for back exercises, seated glute stretches, and a one-minute timer split into two 30-second intervals.

## Program storage

The app loads the sample routines from [`exercices.json`](exercices.json). It uses the browser’s `localStorage` to save new routines, edits, and deletions, including changes to the samples. These changes persist across visits in the same browser at the same site address. Programs are stored separately on each device and can be lost if the browser’s site data is cleared.

The app uses HTML, CSS, and vanilla JavaScript. It requires no build step.
