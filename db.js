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
  settings: { name: "" }
};

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    const data = Object.assign(structuredCloneSafe(DEFAULT_DATA), parsed);
    migrateOldRaces(data);
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
