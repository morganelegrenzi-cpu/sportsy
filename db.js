/* ============================================================
   db.js - couche de données (localStorage) + configuration sports
   ============================================================ */

const DB_KEY = "suivi_sport_data_v1";

const SPORTS = [
  { id: "course",   name: "Course à pied", icon: "🏃", color: "#FC4C02", distance: true,  elevation: true,  pace: "km",  paceLabel: "/km", trackShoes: true },
  { id: "trail",     name: "Trail",         icon: "⛰️", color: "#8b5e34", distance: true,  elevation: true,  pace: "km",  paceLabel: "/km", trackShoes: true },
  { id: "natation",  name: "Natation",      icon: "🏊", color: "#1c7ed6", distance: true,  elevation: false, pace: "100m", paceLabel: "/100m", distanceUnit: "m" },
  { id: "velo",      name: "Vélo",          icon: "🚴", color: "#2f9e44", distance: true,  elevation: true,  pace: "speed", paceLabel: "km/h" },
  { id: "rando",     name: "Randonnée",     icon: "🥾", color: "#9c6b30", distance: true,  elevation: true,  pace: null, trackShoes: true },
  { id: "muscu",     name: "Muscu / Renfo", icon: "🏋️", color: "#495057", distance: false, elevation: false, pace: null },
  { id: "hyrox",     name: "Hyrox",         icon: "🔥", color: "#e03131", distance: true,  elevation: false, pace: null, trackShoes: true }
];

/* Sports "intégrés" + sports personnalisés créés par l'utilisatrice dans l'appli */
function getAllSports() { return SPORTS.concat((typeof DATA !== "undefined" && DATA.customSports) || []); }
function getSport(id) { return getAllSports().find(s => s.id === id); }

const DEFAULT_DATA = {
  activities: [],   // {id, sport, date:"YYYY-MM-DD", duration(min), distance(km, meters for swim), elevation(m), notes, shoeId, feeling}
  goals: [],        // {id, sport, period:'week'|'year', metric:'distance'|'duration'|'sessions', target, createdAt}
  shoes: [],        // {id, name, initialKm, active}
  races: [],        // (ancien format, conservé pour migration) {id, name, date, sport, distanceLabel}
  courses: [],      // {id, name, sport, status:'wishlist'|'planned'|'done', date, location, distanceLabel, resultTime, notes, photos:[dataURL], wantToRedo}
  challenges: [],   // {id, name, description, items:[{id,label,done,doneDate}]}
  customSports: [], // {id, name, icon, color, distance, elevation, pace, trackShoes}
  steps: [],        // {id, date:"YYYY-MM-DD", count}
  stepGoals: [],    // {id, target, startDate:"YYYY-MM-DD"} — objectif applicable à partir de startDate (jusqu'au prochain changement)
  workoutLogs: [],  // {id, programId, date:"YYYY-MM-DD", durationMin, exercises:[{exerciseId, setsDone, weight, feeling}]}
  weightLogs: [],   // {id, date:"YYYY-MM-DD", weight(kg), duringPeriod:bool, photos:[dataURL], note}
  measurements: [], // {id, date:"YYYY-MM-DD", waist, hips, glutes, thighs, notes} — saisie libre, sans rythme imposé
  roadmaps: [],     // {id, name, targetRace:{name,date,dossard,goalType:'finisher'|'temps',goalTime}, steps:[{id,name,date,dossard,done}], journal:[{id,date,category,text,test,resultat,verdict,photos:[dataURL]}]}
  adventure: { activeIslandId: null, progressKm: {}, unlockBaselineKm: null }, // jeu "Îles d'aventure" : île active choisie + km alloués par île (uniquement quand elle était active) + point de départ (km déjà courus avant de découvrir la carte, pour ne pas débloquer les îles avec l'historique)
  settings: { name: "" }
};

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    const data = Object.assign(structuredCloneSafe(DEFAULT_DATA), parsed);
    migrateOldRaces(data);
    fixInvalidGoalMetrics(data);
    return data;
  } catch (e) {
    console.error("Erreur de lecture des données", e);
    return structuredCloneSafe(DEFAULT_DATA);
  }
}

/* Migre les anciennes "races" (countdown simple du Profil) vers le nouveau modèle "courses" */
function migrateOldRaces(data) {
  if (!data.races || !data.races.length) return;
  if (!data.courses) data.courses = [];
  data.races.forEach(r => {
    const alreadyMigrated = data.courses.some(c => c.migratedFrom === r.id);
    if (alreadyMigrated) return;
    data.courses.push({
      id: uid(),
      migratedFrom: r.id,
      name: r.name,
      sport: r.sport || "course",
      status: "planned",
      date: r.date,
      location: "",
      distanceLabel: r.distanceLabel || "",
      resultTime: "",
      notes: "",
      photos: [],
      wantToRedo: false
    });
  });
  data.races = [];
  saveData(data);
}

/* Corrige les objectifs enregistrés en "distance (km)" pour un sport qui ne suit pas de distance
   (ex : Muscu / Renfo) — ces objectifs sont convertis en "nombre de séances", seule mesure pertinente. */
function fixInvalidGoalMetrics(data) {
  if (!data.goals || !data.goals.length) return;
  const allSports = SPORTS.concat(data.customSports || []);
  let changed = false;
  data.goals.forEach(g => {
    if (!g.sport) return;
    const sp = allSports.find(s => s.id === g.sport);
    if (sp && sp.distance === false && g.metric === "distance") {
      g.metric = "sessions";
      changed = true;
    }
  });
  if (changed) saveData(data);
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function saveData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

let DATA = loadData();

function persist() { saveData(DATA); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Activities ---------- */
function addActivity(activity) {
  activity.id = uid();
  DATA.activities.push(activity);
  DATA.activities.sort((a, b) => a.date.localeCompare(b.date));
  persist();
  return activity;
}
function updateActivity(id, patch) {
  const a = DATA.activities.find(x => x.id === id);
  if (a) Object.assign(a, patch);
  persist();
}
function deleteActivity(id) {
  DATA.activities = DATA.activities.filter(x => x.id !== id);
  persist();
}
function getActivities(filter) {
  let list = DATA.activities;
  if (filter && filter.sport) list = list.filter(a => a.sport === filter.sport);
  if (filter && filter.year) list = list.filter(a => a.date.slice(0, 4) === String(filter.year));
  if (filter && filter.month) list = list.filter(a => a.date.slice(0, 7) === filter.month); // "YYYY-MM"
  return list.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
}

/* ---------- Goals ---------- */
function addGoal(goal) {
  goal.id = uid();
  DATA.goals.push(goal);
  persist();
  return goal;
}
function updateGoal(id, patch) {
  const g = DATA.goals.find(x => x.id === id);
  if (g) Object.assign(g, patch);
  persist();
}
function deleteGoal(id) {
  DATA.goals = DATA.goals.filter(x => x.id !== id);
  persist();
}

/* ---------- Custom sports ---------- */
const CUSTOM_SPORT_PALETTE = ["#7048e8","#0ca678","#f08c00","#1098ad","#c2255c","#5c940d","#e8590c","#5f3dc4"];
function addCustomSport(sport) {
  sport.id = "custom_" + uid();
  sport.custom = true;
  if (!sport.color) sport.color = CUSTOM_SPORT_PALETTE[(DATA.customSports || []).length % CUSTOM_SPORT_PALETTE.length];
  DATA.customSports = DATA.customSports || [];
  DATA.customSports.push(sport);
  persist();
  return sport;
}
function deleteCustomSport(id) {
  DATA.customSports = (DATA.customSports || []).filter(s => s.id !== id);
  persist();
}
function activityCountForSport(sportId) {
  return DATA.activities.filter(a => a.sport === sportId).length;
}

/* ---------- Shoes ---------- */
function addShoe(shoe) {
  shoe.id = uid();
  shoe.active = true;
  DATA.shoes.push(shoe);
  persist();
  return shoe;
}
function updateShoe(id, patch) {
  const s = DATA.shoes.find(x => x.id === id);
  if (s) Object.assign(s, patch);
  persist();
}
function deleteShoe(id) {
  DATA.shoes = DATA.shoes.filter(x => x.id !== id);
  persist();
}
function shoeTotalKm(shoeId) {
  const shoe = DATA.shoes.find(s => s.id === shoeId);
  const base = shoe ? (Number(shoe.initialKm) || 0) : 0;
  const sum = DATA.activities
    .filter(a => a.shoeId === shoeId && a.distance)
    .reduce((t, a) => t + Number(a.distance), 0);
  return base + sum;
}

/* ---------- Courses (races) ---------- */
function addCourse(course) {
  course.id = uid();
  if (!course.photos) course.photos = [];
  DATA.courses.push(course);
  persist();
  return course;
}
function updateCourse(id, patch) {
  const c = DATA.courses.find(x => x.id === id);
  if (c) Object.assign(c, patch);
  persist();
  return c;
}
function deleteCourse(id) {
  DATA.courses = DATA.courses.filter(x => x.id !== id);
  persist();
}
function getCourses(filter) {
  let list = DATA.courses.slice();
  if (filter && filter.status) list = list.filter(c => c.status === filter.status);
  if (filter && filter.wantToRedo) list = list.filter(c => c.status === "done" && c.wantToRedo);
  return list;
}

/* ---------- Challenges ---------- */
function addChallenge(challenge) {
  challenge.id = uid();
  challenge.items = challenge.items || [];
  DATA.challenges.push(challenge);
  persist();
  return challenge;
}
function updateChallenge(id, patch) {
  const c = DATA.challenges.find(x => x.id === id);
  if (c) Object.assign(c, patch);
  persist();
  return c;
}
function deleteChallenge(id) {
  DATA.challenges = DATA.challenges.filter(x => x.id !== id);
  persist();
}
function addChallengeItem(challengeId, label) {
  const c = DATA.challenges.find(x => x.id === challengeId);
  if (!c) return;
  c.items.push({ id: uid(), label, done: false, doneDate: null });
  persist();
}
function addChallengeItemsBulk(challengeId, labels) {
  const c = DATA.challenges.find(x => x.id === challengeId);
  if (!c) return;
  labels.filter(l => l.trim()).forEach(l => c.items.push({ id: uid(), label: l.trim(), done: false, doneDate: null }));
  persist();
}
function toggleChallengeItem(challengeId, itemId) {
  const c = DATA.challenges.find(x => x.id === challengeId);
  if (!c) return;
  const item = c.items.find(i => i.id === itemId);
  if (!item) return;
  item.done = !item.done;
  item.doneDate = item.done ? todayISOSafe() : null;
  persist();
}
function deleteChallengeItem(challengeId, itemId) {
  const c = DATA.challenges.find(x => x.id === challengeId);
  if (!c) return;
  c.items = c.items.filter(i => i.id !== itemId);
  persist();
}
function todayISOSafe() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- Pas quotidiens ---------- */
function setStepsForDay(date, count) {
  const existing = DATA.steps.find(s => s.date === date);
  if (existing) existing.count = count;
  else DATA.steps.push({ id: uid(), date, count });
  persist();
}
function deleteStepsForDay(date) {
  DATA.steps = DATA.steps.filter(s => s.date !== date);
  persist();
}
function getStepsForDay(date) {
  const s = DATA.steps.find(x => x.date === date);
  return s ? s.count : null;
}
function addStepGoal(target, startDate) {
  DATA.stepGoals = DATA.stepGoals || [];
  const existing = DATA.stepGoals.find(g => g.startDate === startDate);
  if (existing) existing.target = Number(target);
  else DATA.stepGoals.push({ id: uid(), target: Number(target), startDate });
  DATA.stepGoals.sort((a, b) => a.startDate.localeCompare(b.startDate));
  persist();
}
function deleteStepGoal(id) {
  DATA.stepGoals = (DATA.stepGoals || []).filter(g => g.id !== id);
  persist();
}
function getStepGoalForDate(date) {
  const applicable = (DATA.stepGoals || []).filter(g => g.startDate <= date);
  if (!applicable.length) return null;
  applicable.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return applicable[0].target;
}

/* ---------- Entraînement (renfo) ---------- */
function addWorkoutLog(log) {
  log.id = uid();
  DATA.workoutLogs = DATA.workoutLogs || [];
  DATA.workoutLogs.push(log);
  persist();
  return log;
}
function deleteWorkoutLog(id) {
  DATA.workoutLogs = (DATA.workoutLogs || []).filter(l => l.id !== id);
  persist();
}
function getWorkoutLogs(filter) {
  let list = (DATA.workoutLogs || []).slice();
  if (filter && filter.programId) list = list.filter(l => l.programId === filter.programId);
  return list.sort((a, b) => b.date.localeCompare(a.date));
}
function lastWorkoutLogForProgram(programId) {
  const list = getWorkoutLogs({ programId });
  return list.length ? list[0] : null;
}

/* ---------- Suivi corporel (poids / mesures) ---------- */
function addWeightLog(entry) {
  entry.id = uid();
  if (!entry.photos) entry.photos = [];
  DATA.weightLogs = DATA.weightLogs || [];
  DATA.weightLogs.push(entry);
  DATA.weightLogs.sort((a, b) => a.date.localeCompare(b.date));
  persist();
  return entry;
}
function updateWeightLog(id, patch) {
  const w = (DATA.weightLogs || []).find(x => x.id === id);
  if (w) Object.assign(w, patch);
  persist();
  return w;
}
function deleteWeightLog(id) {
  DATA.weightLogs = (DATA.weightLogs || []).filter(x => x.id !== id);
  persist();
}
function getWeightLogs() {
  return (DATA.weightLogs || []).slice().sort((a, b) => b.date.localeCompare(a.date));
}
function addMeasurement(entry) {
  entry.id = uid();
  DATA.measurements = DATA.measurements || [];
  DATA.measurements.push(entry);
  DATA.measurements.sort((a, b) => a.date.localeCompare(b.date));
  persist();
  return entry;
}
function deleteMeasurement(id) {
  DATA.measurements = (DATA.measurements || []).filter(x => x.id !== id);
  persist();
}
function getMeasurements() {
  return (DATA.measurements || []).slice().sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- Road to... (roadmaps + journal de bord) ---------- */
function addRoadmap(roadmap) {
  roadmap.id = uid();
  roadmap.steps = roadmap.steps || [];
  roadmap.journal = roadmap.journal || [];
  DATA.roadmaps = DATA.roadmaps || [];
  DATA.roadmaps.push(roadmap);
  persist();
  return roadmap;
}
function updateRoadmap(id, patch) {
  const r = (DATA.roadmaps || []).find(x => x.id === id);
  if (r) Object.assign(r, patch);
  persist();
  return r;
}
function deleteRoadmap(id) {
  DATA.roadmaps = (DATA.roadmaps || []).filter(x => x.id !== id);
  persist();
}
function getRoadmaps() {
  return (DATA.roadmaps || []).slice();
}
function getRoadmap(id) {
  return (DATA.roadmaps || []).find(x => x.id === id);
}
function addRoadmapStep(roadmapId, step) {
  const r = getRoadmap(roadmapId);
  if (!r) return;
  step.id = uid();
  step.done = false;
  r.steps.push(step);
  r.steps.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  persist();
  return step;
}
function updateRoadmapStep(roadmapId, stepId, patch) {
  const r = getRoadmap(roadmapId);
  if (!r) return;
  const s = r.steps.find(x => x.id === stepId);
  if (s) Object.assign(s, patch);
  r.steps.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  persist();
  return s;
}
function deleteRoadmapStep(roadmapId, stepId) {
  const r = getRoadmap(roadmapId);
  if (!r) return;
  r.steps = r.steps.filter(x => x.id !== stepId);
  persist();
}
function addJournalEntry(roadmapId, entry) {
  const r = getRoadmap(roadmapId);
  if (!r) return;
  entry.id = uid();
  if (!entry.photos) entry.photos = [];
  if (!entry.date) entry.date = todayISOSafe();
  r.journal.push(entry);
  r.journal.sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
  persist();
  return entry;
}
function deleteJournalEntry(roadmapId, entryId) {
  const r = getRoadmap(roadmapId);
  if (!r) return;
  r.journal = r.journal.filter(x => x.id !== entryId);
  persist();
}

/* ---------- Îles d'aventure ---------- */
function setActiveIsland(islandId) {
  DATA.adventure = DATA.adventure || { activeIslandId: null, progressKm: {} };
  DATA.adventure.activeIslandId = islandId;
  persist();
}
function addAdventureProgress(islandId, km) {
  if (!islandId || !km || km <= 0) return;
  DATA.adventure = DATA.adventure || { activeIslandId: null, progressKm: {} };
  DATA.adventure.progressKm = DATA.adventure.progressKm || {};
  DATA.adventure.progressKm[islandId] = (DATA.adventure.progressKm[islandId] || 0) + km;
  persist();
}

/* ---------- Export / Import ---------- */
function exportJSON() {
  return JSON.stringify(DATA, null, 2);
}
function importJSON(str) {
  const parsed = JSON.parse(str);
  DATA = Object.assign(structuredCloneSafe(DEFAULT_DATA), parsed);
  persist();
}
function exportCSV() {
  const header = ["date","sport","duree_min","distance","elevation_m","allure_ressenti","chaussure","notes"];
  const rows = DATA.activities.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(a => {
    const shoe = DATA.shoes.find(s => s.id === a.shoeId);
    return [
      a.date, getSport(a.sport) ? getSport(a.sport).name : a.sport,
      a.duration || "", a.distance || "", a.elevation || "",
      a.feeling || "", shoe ? shoe.name : "", (a.notes || "").replace(/[\n,]/g, " ")
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}
