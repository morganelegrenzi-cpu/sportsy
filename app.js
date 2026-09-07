/* ============================================================
   app.js — logique de l'application, pages, graphiques, modales
   ============================================================ */

/* ---------------- STATE ---------------- */
const state = {
  page: "accueil",
  statsSport: null,
  statsRangeAll: false,
  bilanTab: "mensuel",
  bilanMonth: monthKey(new Date()),
  bilanYear: new Date().getFullYear(),
  bilanSport: null,
  objTab: "week",
  coursesTab: "mescourses",
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  entrainementView: "list",
  entrainementProgramId: null,
  roadmapDetailId: null,
  adventureIslandId: null
};
const charts = {};

/* ---------------- DATE HELPERS ---------------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function todayISO() { return toISODate(new Date()); }
function mondayOf(date) { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d; }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function addWeeks(date, n) { return addDays(date, n * 7); }
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; }
function monthKey(date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`; }
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MOIS_ABR = ["JAN","FÉV","MAR","AVR","MAI","JUIN","JUIL","AOÛT","SEP","OCT","NOV","DÉC"];
const JOURS = ["L","M","M","J","V","S","D"];

/* ---------------- FORMAT HELPERS ---------------- */
function fmtKm(km) {
  if (km == null || isNaN(km)) return "0 km";
  const r = Math.round(km * 10) / 10;
  return r.toLocaleString("fr-FR", { minimumFractionDigits: r % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 }) + " km";
}
function fmtNum(n, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtDuration(min) {
  min = Number(min) || 0;
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h} h ${pad2(m)}`;
  return `${m} min`;
}
function fmtDurationPrecise(minFloat) {
  const totalSeconds = Math.round((Number(minFloat) || 0) * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}
function fmtElevation(m) { return `${Math.round(Number(m) || 0)} m`; }
function distanceKm(a) {
  const sp = getSport(a.sport);
  if (!sp || !sp.distance) return 0;
  if (sp.distanceUnit === "m") return (Number(a.distance) || 0) / 1000;
  return Number(a.distance) || 0;
}
function distanceDisplay(a) {
  const sp = getSport(a.sport);
  if (!sp || !sp.distance) return null;
  if (sp.distanceUnit === "m") {
    const m = Number(a.distance) || 0;
    return m >= 1000 ? fmtKm(m / 1000) : `${Math.round(m)} m`;
  }
  return fmtKm(Number(a.distance) || 0);
}
function fmtPaceForActivity(a) {
  const sp = getSport(a.sport);
  const km = distanceKm(a);
  const min = Number(a.duration) || 0;
  if (!sp || !sp.pace || !min) return null;
  if (sp.pace === "km") {
    if (!km) return null;
    const paceMin = min / km;
    const m = Math.floor(paceMin), s = Math.round((paceMin - m) * 60);
    return `${m}:${pad2(s)} /km`;
  }
  if (sp.pace === "speed") {
    if (!km) return null;
    return `${(km / (min / 60)).toFixed(1)} km/h`;
  }
  if (sp.pace === "100m") {
    const meters = Number(a.distance) || 0;
    if (!meters) return null;
    const per100 = (min * 60) / (meters / 100);
    const m = Math.floor(per100 / 60), s = Math.round(per100 % 60);
    return `${m}:${pad2(s)} /100m`;
  }
  return null;
}

/* ---------------- COMPUTE ---------------- */
function activitiesInRange(sportId, start, end) {
  const s = toISODate(start), e = toISODate(end);
  return DATA.activities.filter(a => (!sportId || a.sport === sportId) && a.date >= s && a.date <= e);
}
function weeklySeries(sportId, numWeeks) {
  const endMonday = mondayOf(new Date());
  const weeks = [];
  for (let i = numWeeks - 1; i >= 0; i--) {
    const wStart = addWeeks(endMonday, -i);
    const wEnd = addDays(wStart, 6);
    const acts = activitiesInRange(sportId, wStart, wEnd);
    const km = acts.reduce((t, a) => t + distanceKm(a), 0);
    weeks.push({ start: wStart, km: Math.round(km * 10) / 10 });
  }
  return weeks;
}
function computeStreak() {
  let cursor = mondayOf(new Date());
  let count = 0, isFirst = true;
  let rangeStartWeek = cursor;
  const rangeEnd = addDays(cursor, 6);
  for (let i = 0; i < 600; i++) {
    const wEnd = addDays(cursor, 6);
    const has = activitiesInRange(null, cursor, wEnd).length > 0;
    if (has) { count++; rangeStartWeek = cursor; }
    else if (!isFirst) break;
    cursor = addWeeks(cursor, -1);
    isFirst = false;
  }
  const activities = activitiesInRange(null, rangeStartWeek, rangeEnd).length;
  return { weeks: count, activities };
}
function aggregateBySport(list) {
  const res = {};
  getAllSports().forEach(s => res[s.id] = { sessions: 0, distance: 0, duration: 0, elevation: 0 });
  list.forEach(a => {
    const b = res[a.sport]; if (!b) return;
    b.sessions++; b.duration += Number(a.duration) || 0;
    b.distance += distanceKm(a); b.elevation += Number(a.elevation) || 0;
  });
  return res;
}
function totalsAll(list) {
  return list.reduce((acc, a) => {
    acc.sessions++; acc.duration += Number(a.duration) || 0;
    acc.distance += distanceKm(a); acc.elevation += Number(a.elevation) || 0;
    return acc;
  }, { sessions: 0, duration: 0, distance: 0, elevation: 0 });
}
function bestEfforts(sportId) {
  const acts = getActivities({ sport: sportId });
  if (!acts.length) return null;
  const sp = getSport(sportId);
  let longest = null, mostElev = null, longestDuration = null, bestPaceAct = null, bestPaceVal = null, bestSpeedVal = null;
  acts.forEach(a => {
    const dKm = distanceKm(a);
    if (sp.distance && (!longest || dKm > distanceKm(longest))) longest = a;
    if (sp.elevation && (!mostElev || (Number(a.elevation) || 0) > (Number(mostElev.elevation) || 0))) mostElev = a;
    if (!longestDuration || (Number(a.duration) || 0) > (Number(longestDuration.duration) || 0)) longestDuration = a;
    if (sp.pace === "km" && dKm >= 1 && a.duration) {
      const pace = a.duration / dKm;
      if (bestPaceVal == null || pace < bestPaceVal) { bestPaceVal = pace; bestPaceAct = a; }
    }
    if (sp.pace === "speed" && dKm > 0 && a.duration) {
      const speed = dKm / (a.duration / 60);
      if (bestSpeedVal == null || speed > bestSpeedVal) { bestSpeedVal = speed; bestPaceAct = a; }
    }
    if (sp.pace === "100m" && a.distance > 0 && a.duration) {
      const per100 = (a.duration * 60) / (a.distance / 100);
      if (bestPaceVal == null || per100 < bestPaceVal) { bestPaceVal = per100; bestPaceAct = a; }
    }
  });
  return { longest, mostElev, longestDuration, bestPaceAct };
}
const RUNNING_COMBO = "__running__";
const RUNNING_COMBO_SPORTS = ["course", "trail"];
function goalCurrentValue(goal) {
  const now = new Date();
  let start, end;
  if (goal.period === "week") { start = mondayOf(now); end = addDays(start, 6); }
  else { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31); }
  const acts = goal.sport === RUNNING_COMBO
    ? activitiesInRange(null, start, end).filter(a => RUNNING_COMBO_SPORTS.includes(a.sport))
    : activitiesInRange(goal.sport || null, start, end);
  if (goal.metric === "sessions") return acts.length;
  if (goal.metric === "duration") return acts.reduce((t, a) => t + (Number(a.duration) || 0), 0) / 60;
  return acts.reduce((t, a) => t + distanceKm(a), 0);
}
function goalUnitLabel(metric) { return metric === "sessions" ? "séances" : metric === "duration" ? "h" : "km"; }
function goalSportLabel(g) {
  if (g.sport === RUNNING_COMBO) return { icon: "🏃", name: "Running (CAP + Trail)" };
  if (!g.sport) return { icon: "🎯", name: "Tous sports" };
  const sp = getSport(g.sport);
  return sp ? { icon: sp.icon, name: sp.name } : { icon: "🎯", name: g.sport };
}

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  bindNav();
  document.getElementById("addActivityBtn").addEventListener("click", () => openActivityModal());
  document.addEventListener("click", handleGlobalClick);
  document.addEventListener("submit", handleGlobalSubmit);
  document.addEventListener("change", handleGlobalChange);
  if (!state.statsSport) state.statsSport = "course";
  render();
  registerSW();
});

function bindNav() {
  document.querySelectorAll(".navbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".navbtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.page = btn.dataset.page;
      render();
    });
  });
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

/* ---------------- RENDER ROOT ---------------- */
function render() {
  const main = document.getElementById("main");
  const titles = { accueil: "Mon Suivi Sport", stats: "Statistiques", objectifs: "Objectifs", courses: "Courses", aventure: "Îles d'aventure", entrainement: "Renfo", bilans: "Bilans", profil: "Profil" };
  document.getElementById("topbarTitle").textContent = titles[state.page] || "Mon Suivi Sport";
  let html = "";
  if (state.page === "accueil") html = renderAccueil();
  else if (state.page === "stats") html = renderStats();
  else if (state.page === "objectifs") html = renderObjectifs();
  else if (state.page === "courses") html = renderCourses();
  else if (state.page === "aventure") html = renderAventure();
  else if (state.page === "entrainement") html = renderEntrainement();
  else if (state.page === "bilans") html = renderBilans();
  else if (state.page === "profil") html = renderProfil();
  main.innerHTML = html;
  afterRender();
}

function afterRender() {
  if (state.page === "accueil") mountAccueilChart();
  if (state.page === "stats") mountStatsChart();
  if (state.page === "bilans" && state.bilanTab === "annuel") mountBilanYearChart();
  if (state.page === "bilans" && state.bilanTab === "mensuel") mountBilanMonthChart();
  if (state.page === "objectifs" && state.objTab === "steps") mountStepsChart();
  if (state.page === "aventure") mountAdventureIslandPath();
}

/* ================= ACCUEIL ================= */
function renderAccueil() {
  const streak = computeStreak();
  const weekStart = mondayOf(new Date()), weekEnd = addDays(weekStart, 6);
  const weekActs = activitiesInRange(null, weekStart, weekEnd);
  const weekTotals = totalsAll(weekActs);
  const weekGoals = DATA.goals.filter(g => g.period === "week");

  const recent = getActivities({}).slice(0, 40);
  const groups = {};
  recent.forEach(a => {
    const key = a.date.slice(0, 7);
    (groups[key] = groups[key] || []).push(a);
  });
  const monthKeys = Object.keys(groups).sort().reverse();

  let goalsHtml = "";
  if (weekGoals.length) {
    goalsHtml = `<div class="section-title">Objectifs de la semaine</div><div class="card">` +
      weekGoals.map(g => goalRowMini(g)).join("") + `</div>`;
  }

  let activitiesHtml = "";
  if (!recent.length) {
    activitiesHtml = `<div class="empty-state"><div class="emoji">🏁</div>Aucune activité pour l'instant.<br>Appuie sur + pour ajouter ta première séance !</div>`;
  } else {
    activitiesHtml = monthKeys.map(mk => {
      const [y, m] = mk.split("-").map(Number);
      const list = groups[mk];
      const tot = totalsAll(list);
      return `<div class="month-group-title">${MOIS[m-1]} ${y} <span class="sub">${fmtKm(tot.distance)} · ${list.length} séances</span></div>` +
        `<div class="card">` + list.map(activityRow).join("") + `</div>`;
    }).join("");
  }

  return `
    <div class="card" data-action="open-calendar" style="cursor:pointer">
      <div class="streak-row">
        <div><div class="big">🔥 ${streak.weeks}</div><div class="lbl">semaine${streak.weeks>1?"s":""} d'affilée</div></div>
        <div><div class="big">${weekActs.length}</div><div class="lbl">séances cette semaine</div></div>
        <div><div class="big">${fmtKm(weekTotals.distance)}</div><div class="lbl">cette semaine</div></div>
      </div>
      <canvas id="chart-accueil" height="140"></canvas>
      <div style="text-align:center;margin-top:8px;"><span class="link">Voir le calendrier du mois →</span></div>
    </div>
    ${goalsHtml}
    <button class="fab-add" data-action="add-activity">+ Ajouter une activité</button>
    ${activitiesHtml}
  `;
}

function goalRowMini(g) {
  const label = goalSportLabel(g);
  const current = goalCurrentValue(g);
  const currentDisp = g.metric === "duration" ? fmtNum(current, 1) : g.metric === "sessions" ? current : fmtNum(current, 1);
  const pct = Math.min(100, Math.round((current / g.target) * 100)) || 0;
  return `<div class="goal-card">
    <div class="goal-head">
      <div class="name">${label.icon} ${label.name}</div>
    </div>
    <div class="progress-bar-bg"><div class="progress-bar-fill ${pct>=100?'over':''}" style="width:${pct}%"></div></div>
    <div class="goal-foot"><span>${currentDisp} / ${g.target} ${goalUnitLabel(g.metric)}</span><span>${pct}%</span></div>
  </div>`;
}

function activityRow(a) {
  const sp = getSport(a.sport);
  const d = parseISO(a.date);
  const dateLabel = `${d.getDate()} ${MOIS_ABR[d.getMonth()]}`;
  const dist = distanceDisplay(a);
  const pace = fmtPaceForActivity(a);
  return `<div class="activity-item" data-action="open-activity" data-id="${a.id}">
    <div class="activity-icon">${sp ? sp.icon : "❔"}</div>
    <div class="activity-info">
      <div class="activity-title">${sp ? sp.name : a.sport}</div>
      <div class="activity-sub">${dateLabel} · ${fmtDurationPrecise(a.duration)}${pace ? " · " + pace : ""}</div>
    </div>
    <div class="activity-metrics">
      ${dist ? `<div class="main">${dist}</div>` : ""}
      ${a.elevation ? `<div>${fmtElevation(a.elevation)} D+</div>` : ""}
    </div>
  </div>`;
}

function mountAccueilChart() {
  const canvas = document.getElementById("chart-accueil");
  if (!canvas) return;
  const weeks = weeklySeries(null, 16);
  renderLineChart("chart-accueil", weeks.map(w => `${w.start.getDate()}/${w.start.getMonth()+1}`), [
    { label: "km / semaine (tous sports)", data: weeks.map(w => w.km), color: "#FC4C02" }
  ]);
}

/* ================= CALENDAR MODAL ================= */
function openCalendarModal() {
  renderCalendarModal();
}
function buildMonthGridHTML(y, m) {
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const actsByDay = {};
  DATA.activities.forEach(a => { (actsByDay[a.date] = actsByDay[a.date] || []).push(a); });

  let cells = "";
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toISODate(new Date(y, m, d));
    const acts = actsByDay[dateStr];
    const isToday = dateStr === todayISO();
    const isFuture = dateStr > todayISO();
    let cls = "cal-day";
    if (isToday) cls += " today";
    if (isFuture) cls += " future";
    let content = d;
    if (acts && acts.length) {
      cls += " active";
      content = acts.length === 1 ? getSport(acts[0].sport).icon : acts.length;
    }
    cells += `<div class="${cls}">${content}</div>`;
  }
  return `<div class="cal-grid">${JOURS.map(j => `<div class="cal-dow">${j}</div>`).join("")}${cells}</div>`;
}
function renderCalendarModal() {
  const cm = state.calendarMonth;
  const y = cm.getFullYear(), m = cm.getMonth();
  const streak = computeStreak();
  const gridHtml = buildMonthGridHTML(y, m);

  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>${MOIS[m]} ${y}</h2>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="month-nav">
        <button data-action="cal-prev">‹</button>
        <div class="label">Série en cours</div>
        <button data-action="cal-next">›</button>
      </div>
      <div class="streak-row">
        <div><div class="big">🔥 ${streak.weeks}</div><div class="lbl">Semaines</div></div>
        <div><div class="big">${streak.activities}</div><div class="lbl">Activités</div></div>
      </div>
      ${gridHtml}
    </div>
  </div>`;
  mountModal(html);
}

/* ================= STATS ================= */
function renderStats() {
  const sportId = state.statsSport;
  const sp = getSport(sportId);
  const now = new Date();

  const weekStart = mondayOf(now), weekEnd = addDays(weekStart, 6);
  const weekTot = aggForSport(activitiesInRange(sportId, weekStart, weekEnd));

  const yearStart = new Date(now.getFullYear(), 0, 1), yearEnd = new Date(now.getFullYear(), 11, 31);
  const yearTot = aggForSport(activitiesInRange(sportId, yearStart, yearEnd));

  const allTot = aggForSport(getActivities({ sport: sportId }));

  const be = bestEfforts(sportId);

  const recent = getActivities({ sport: sportId }).slice(0, 8);

  return `
  <div class="sport-tabs">
    ${getAllSports().map(s => `<div class="sport-tab ${s.id===sportId?'active':''}" data-action="select-sport" data-sport="${s.id}">${s.icon} ${s.name}</div>`).join("")}
  </div>

  <div class="section-title">Cette semaine</div>
  <div class="card">
    <div class="stat-grid">
      ${sp.distance ? statBox("Distance", fmtKm(weekTot.distance)) : statBox("Séances", weekTot.sessions)}
      ${statBox("Temps", fmtDuration(weekTot.duration))}
      ${sp.elevation ? statBox("Dénivelé", fmtElevation(weekTot.elevation)) : statBox("Séances", weekTot.sessions)}
    </div>
  </div>

  <div class="section-title">Évolution (km / semaine)</div>
  <div class="card">
    <canvas id="chart-stats-weekly" height="160"></canvas>
    <div style="text-align:center;margin-top:8px;">
      <span class="link" data-action="toggle-range">${state.statsRangeAll ? "Afficher 6 derniers mois" : "Afficher tout l'historique"}</span>
    </div>
  </div>

  <div class="section-title">Depuis le début de l'année</div>
  <div class="card">
    ${statRow("Séances", yearTot.sessions)}
    ${sp.distance ? statRow("Distance", fmtKm(yearTot.distance)) : ""}
    ${statRow("Temps", fmtDuration(yearTot.duration))}
    ${sp.elevation ? statRow("Dénivelé +", fmtElevation(yearTot.elevation)) : ""}
  </div>

  <div class="section-title">Depuis toujours</div>
  <div class="card">
    ${statRow("Séances", allTot.sessions)}
    ${sp.distance ? statRow("Distance", fmtKm(allTot.distance)) : ""}
    ${statRow("Temps", fmtDuration(allTot.duration))}
    ${sp.elevation ? statRow("Dénivelé +", fmtElevation(allTot.elevation)) : ""}
  </div>

  ${be ? `<div class="section-title">Meilleurs efforts</div><div class="card">
    ${sp.distance && be.longest ? statRow("Plus longue distance", `${distanceDisplay(be.longest)} <span style='color:var(--text-muted);font-weight:400'>· ${fmtDateShort(be.longest.date)}</span>`) : ""}
    ${be.bestPaceAct ? statRow(sp.pace==="speed" ? "Meilleure vitesse" : "Meilleure allure", `${fmtPaceForActivity(be.bestPaceAct)} <span style='color:var(--text-muted);font-weight:400'>· ${fmtDateShort(be.bestPaceAct.date)}</span>`) : ""}
    ${sp.elevation && be.mostElev && be.mostElev.elevation ? statRow("Plus gros dénivelé", `${fmtElevation(be.mostElev.elevation)} <span style='color:var(--text-muted);font-weight:400'>· ${fmtDateShort(be.mostElev.date)}</span>`) : ""}
    ${be.longestDuration ? statRow("Plus longue séance", `${fmtDurationPrecise(be.longestDuration.duration)} <span style='color:var(--text-muted);font-weight:400'>· ${fmtDateShort(be.longestDuration.date)}</span>`) : ""}
  </div>` : ""}

  <div class="section-title">Activités récentes</div>
  ${recent.length ? `<div class="card">${recent.map(activityRow).join("")}</div>` : `<div class="empty-state"><div class="emoji">${sp.icon}</div>Pas encore d'activité en ${sp.name.toLowerCase()}.</div>`}
  `;
}
function aggForSport(list) {
  return list.reduce((acc, a) => {
    acc.sessions++; acc.duration += Number(a.duration) || 0;
    acc.distance += distanceKm(a); acc.elevation += Number(a.elevation) || 0;
    return acc;
  }, { sessions: 0, duration: 0, distance: 0, elevation: 0 });
}
function statBox(label, value) { return `<div class="stat-box"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`; }
function statRow(label, value) { return `<div class="stat-row"><div class="label">${label}</div><div class="value">${value}</div></div>`; }
function fmtDateShort(iso) { const d = parseISO(iso); return `${d.getDate()} ${MOIS_ABR[d.getMonth()]} ${d.getFullYear()}`; }

function mountStatsChart() {
  const canvas = document.getElementById("chart-stats-weekly");
  if (!canvas) return;
  const numWeeks = state.statsRangeAll ? weeksSinceFirstActivity() : 26;
  const weeks = weeklySeries(state.statsSport, Math.max(numWeeks, 4));
  renderLineChart("chart-stats-weekly", weeks.map(w => `${w.start.getDate()}/${w.start.getMonth()+1}`), [
    { label: "km", data: weeks.map(w => w.km), color: getSport(state.statsSport).color }
  ]);
}
function weeksSinceFirstActivity() {
  if (!DATA.activities.length) return 12;
  const first = DATA.activities.reduce((min, a) => a.date < min ? a.date : min, DATA.activities[0].date);
  const diff = Math.ceil((new Date() - parseISO(first)) / (7 * 24 * 3600 * 1000));
  return Math.max(diff + 1, 4);
}

/* ================= OBJECTIFS ================= */
function renderObjectifs() {
  if (state.objTab === "steps") {
    return `
    <div class="sport-tabs">
      <div class="sport-tab" data-action="obj-tab" data-tab="week">Hebdomadaires</div>
      <div class="sport-tab" data-action="obj-tab" data-tab="year">Annuels</div>
      <div class="sport-tab active" data-action="obj-tab" data-tab="steps">👣 Pas quotidiens</div>
    </div>
    ${renderStepsTab()}
    `;
  }
  const goals = DATA.goals.filter(g => g.period === state.objTab);
  return `
  <div class="sport-tabs">
    <div class="sport-tab ${state.objTab==='week'?'active':''}" data-action="obj-tab" data-tab="week">Hebdomadaires</div>
    <div class="sport-tab ${state.objTab==='year'?'active':''}" data-action="obj-tab" data-tab="year">Annuels</div>
    <div class="sport-tab" data-action="obj-tab" data-tab="steps">👣 Pas quotidiens</div>
  </div>
  <button class="fab-add" data-action="add-goal">+ Ajouter un objectif</button>
  ${goals.length ? goals.map(goalCardFull).join("") : `<div class="empty-state"><div class="emoji">🎯</div>Aucun objectif ${state.objTab==='week'?'hebdomadaire':'annuel'} pour l'instant.</div>`}
  `;
}

/* ---- Pas quotidiens ---- */
function renderStepsTab() {
  const todayGoal = getStepGoalForDate(todayISO());
  const currentStreak = computeCurrentStepsStreak();
  const days = [];
  for (let i = 0; i < 14; i++) days.push(toISODate(addDays(new Date(), -i)));
  const rows = days.map(d => {
    const count = getStepsForDay(d);
    const goal = getStepGoalForDate(d);
    const met = count != null && goal != null && count >= goal;
    return `<div class="stat-row" data-action="edit-steps-day" data-date="${d}" style="cursor:pointer">
      <div class="label">${fmtDateShort(d)}${goal != null ? ` <span style="color:var(--text-muted);font-weight:400;font-size:11px;">(objectif : ${fmtNum(goal)})</span>` : ""}</div>
      <div class="value">${count != null ? `${fmtNum(count)} pas ${goal != null ? (met ? "✅" : "❌") : ""}` : "—"}</div>
    </div>`;
  }).join("");
  const goalHistory = (DATA.stepGoals || []).slice().sort((a, b) => b.startDate.localeCompare(a.startDate));
  const historyRows = goalHistory.map(g => `<div class="stat-row">
    <div class="label">Depuis le ${fmtDateShort(g.startDate)}</div>
    <div class="value">${fmtNum(g.target)} pas/jour <button data-action="delete-step-goal" data-id="${g.id}" style="border:none;background:none;color:var(--text-muted);margin-left:6px;">🗑️</button></div>
  </div>`).join("");

  return `
  <div class="card">
    <div class="stat-row"><div class="label">🎯 Objectif actuel</div><div class="value">${todayGoal != null ? `${fmtNum(todayGoal)} pas / jour` : "Pas encore défini"}</div></div>
    <div class="stat-row"><div class="label">🔥 Streak actuelle</div><div class="value">${currentStreak > 0 ? `${currentStreak} jour${currentStreak > 1 ? "s" : ""} d'affilée` : "—"}</div></div>
    <button class="btn btn-outline btn-block" data-action="add-step-goal" style="margin-top:10px;">🎯 Définir / changer l'objectif</button>
  </div>
  <button class="fab-add" data-action="add-steps-day">+ Enregistrer mes pas du jour</button>
  <div class="section-title">Évolution (14 derniers jours)</div>
  <div class="card"><canvas id="chart-steps" height="160"></canvas></div>
  <div class="section-title">Derniers jours</div>
  <div class="card">${rows}</div>
  ${goalHistory.length ? `<div class="section-title">Historique de l'objectif</div><div class="card">${historyRows}</div>` : ""}
  `;
}
function mountStepsChart() {
  const canvas = document.getElementById("chart-steps");
  if (!canvas) return;
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(toISODate(addDays(new Date(), -i)));
  const labels = days.map(d => { const dd = parseISO(d); return `${dd.getDate()}/${dd.getMonth()+1}`; });
  const stepsData = days.map(d => getStepsForDay(d) || 0);
  const goalData = days.map(d => getStepGoalForDate(d));
  if (charts["chart-steps"]) charts["chart-steps"].destroy();
  const ctx = canvas.getContext("2d");
  charts["chart-steps"] = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        { type: "bar", label: "Pas", data: stepsData, backgroundColor: "#FC4C02", borderRadius: 4 },
        { type: "line", label: "Objectif", data: goalData, borderColor: "#495057", borderDash: [5, 4], pointRadius: 0, borderWidth: 2, fill: false, spanGaps: true }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 10 } },
        y: { beginAtZero: true, ticks: { font: { size: 10 } } }
      }
    }
  });
}
function computeCurrentStepsStreak() {
  let cursor = new Date();
  const todayIso = toISODate(cursor);
  const todayCount = getStepsForDay(todayIso);
  const todayGoal = getStepGoalForDate(todayIso);
  if (todayCount != null) {
    if (todayGoal == null || todayCount < todayGoal) return 0;
  }
  // si les pas du jour ne sont pas encore saisis, on ne casse pas la streak : on part d'hier
  cursor = addDays(cursor, -1);
  let streak = (todayCount != null) ? 1 : 0;
  while (true) {
    const iso = toISODate(cursor);
    const count = getStepsForDay(iso);
    const goal = getStepGoalForDate(iso);
    if (count != null && goal != null && count >= goal) {
      streak++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}
function computeLongestStepsGoalStreak() {
  if (!DATA.steps.length) return 0;
  const sorted = DATA.steps.map(s => s.date).sort();
  let cursor = parseISO(sorted[0]);
  const today = new Date();
  let best = 0, cur = 0;
  while (cursor <= today) {
    const iso = toISODate(cursor);
    const count = getStepsForDay(iso);
    const goal = getStepGoalForDate(iso);
    if (count != null && goal != null && count >= goal) { cur++; best = Math.max(best, cur); } else { cur = 0; }
    cursor = addDays(cursor, 1);
  }
  return best;
}
function goalCardFull(g) {
  const label = goalSportLabel(g);
  const current = goalCurrentValue(g);
  const currentDisp = fmtNum(current, g.metric === "sessions" ? 0 : 1);
  const pct = Math.min(100, Math.round((current / g.target) * 100)) || 0;
  return `<div class="card goal-card">
    <div class="goal-head">
      <div class="name">${label.icon} ${label.name}</div>
      <div class="actions">
        <button data-action="edit-goal" data-id="${g.id}">✏️</button>
        <button data-action="delete-goal" data-id="${g.id}">🗑️</button>
      </div>
    </div>
    <div class="progress-bar-bg"><div class="progress-bar-fill ${pct>=100?'over':''}" style="width:${pct}%"></div></div>
    <div class="goal-foot"><span>${currentDisp} / ${g.target} ${goalUnitLabel(g.metric)}</span><span>${pct}%</span></div>
  </div>`;
}

/* ================= BILANS ================= */
function renderBilans() {
  return `
  <div class="sport-tabs">
    <div class="sport-tab ${state.bilanTab==='mensuel'?'active':''}" data-action="bilan-tab" data-tab="mensuel">Bilan mensuel</div>
    <div class="sport-tab ${state.bilanTab==='annuel'?'active':''}" data-action="bilan-tab" data-tab="annuel">Bilan annuel</div>
  </div>
  ${state.bilanTab === "mensuel" ? renderBilanMensuel() : renderBilanAnnuel()}
  `;
}

function renderBilanMensuel() {
  const [y, m] = state.bilanMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1), end = new Date(y, m, 0);
  const prevStart = new Date(y, m - 2, 1), prevEnd = new Date(y, m - 1, 0);

  const acts = activitiesInRange(null, start, end);
  const prevActs = activitiesInRange(null, prevStart, prevEnd);
  const bySport = aggregateBySport(acts);
  const prevBySport = aggregateBySport(prevActs);
  const tot = totalsAll(acts);
  const prevTot = totalsAll(prevActs);

  const rows = getAllSports().filter(s => bySport[s.id].sessions > 0 || prevBySport[s.id].sessions > 0).map(s => {
    const cur = bySport[s.id], prev = prevBySport[s.id];
    const diff = cur.distance - prev.distance;
    const diffLabel = prev.distance > 0 ? `${diff >= 0 ? "+" : ""}${fmtNum(diff,1)} km vs mois dernier` : "";
    return `<div class="stat-row">
      <div class="label">${s.icon} ${s.name}</div>
      <div class="value">${s.distance ? fmtKm(cur.distance) : cur.sessions + " séances"} ${diffLabel ? `<div style="font-size:11px;font-weight:600" class="${diff>=0?'diff-pos':'diff-neg'}">${diffLabel}</div>` : ""}</div>
    </div>`;
  }).join("");

  return `
  <div class="month-nav">
    <button data-action="bilan-prev-month">‹</button>
    <div class="label">${MOIS[m-1]} ${y}</div>
    <button data-action="bilan-next-month">›</button>
  </div>
  <div class="card">
    <div class="stat-grid">
      ${statBox("Séances", tot.sessions)}
      ${statBox("Distance", fmtKm(tot.distance))}
      ${statBox("Temps", fmtDuration(tot.duration))}
    </div>
  </div>
  <button class="btn btn-primary btn-block" data-action="open-monthly-recap" data-year="${y}" data-month="${m}" style="margin-top:2px;margin-bottom:14px;">🎥 Récap vidéo du mois</button>
  <div class="section-title">Par sport</div>
  <div class="card">${rows || `<div class="empty-state">Aucune activité ce mois-ci.</div>`}</div>

  <div class="section-title">Km par jour</div>
  <div class="card"><canvas id="chart-bilan-month" height="160"></canvas></div>

  <div class="section-title">Vue d'ensemble du mois</div>
  <div class="card">${buildMonthGridHTML(y, m - 1)}</div>
  `;
}

function renderBilanAnnuel() {
  const y = state.bilanYear;
  const start = new Date(y, 0, 1), end = new Date(y, 11, 31);
  const now = new Date();
  const ytdEnd = (y === now.getFullYear()) ? now : end;

  const acts = activitiesInRange(null, start, ytdEnd);
  const prevYtdEnd = new Date(y - 1, ytdEnd.getMonth(), ytdEnd.getDate());
  const prevActs = activitiesInRange(null, new Date(y - 1, 0, 1), prevYtdEnd);

  const tot = totalsAll(acts);
  const prevTot = totalsAll(prevActs);
  const bySport = aggregateBySport(acts);

  const diffDistance = tot.distance - prevTot.distance;
  const diffPct = prevTot.distance > 0 ? Math.round((diffDistance / prevTot.distance) * 100) : null;

  const rows = getAllSports().filter(s => bySport[s.id].sessions > 0).sort((a,b)=>bySport[b.id].distance - bySport[a.id].distance).map(s => {
    const cur = bySport[s.id];
    return `<div class="stat-row">
      <div class="label">${s.icon} ${s.name}</div>
      <div class="value">${s.distance ? fmtKm(cur.distance) : ""} <span style="color:var(--text-muted);font-weight:400">· ${cur.sessions} séances</span></div>
    </div>`;
  }).join("");

  // best month badge
  let bestMonth = null, bestMonthKm = -1;
  for (let mm = 0; mm < 12; mm++) {
    const ms = new Date(y, mm, 1), me = new Date(y, mm + 1, 0);
    const km = totalsAll(activitiesInRange(null, ms, me)).distance;
    if (km > bestMonthKm) { bestMonthKm = km; bestMonth = mm; }
  }

  const heat = renderYearHeatmap(y);

  return `
  <div class="month-nav">
    <button data-action="bilan-prev-year">‹</button>
    <div class="label">${y}</div>
    <button data-action="bilan-next-year">›</button>
  </div>
  <div class="card">
    <div class="stat-grid">
      ${statBox("Séances", tot.sessions)}
      ${statBox("Distance", fmtKm(tot.distance))}
      ${statBox("Dénivelé", fmtElevation(tot.elevation))}
    </div>
    ${diffPct !== null ? `<div style="text-align:center;margin-top:10px;font-size:13px;" class="${diffPct>=0?'diff-pos':'diff-neg'}">${diffPct>=0?'+':''}${diffPct}% vs ${y-1} (même période)</div>` : ""}
  </div>

  <div class="section-title">Répartition par sport</div>
  <div class="card">${rows || `<div class="empty-state">Aucune activité en ${y}.</div>`}</div>

  <div class="section-title">Km par mois</div>
  <div class="card"><canvas id="chart-bilan-year" height="180"></canvas></div>

  ${bestMonthKm > 0 ? `<div class="section-title">Faits marquants</div>
  <div class="card">
    ${statRow("🏆 Meilleur mois", `${MOIS[bestMonth]} · ${fmtKm(bestMonthKm)}`)}
    ${statRow("🔥 Série la plus longue", computeStreak().weeks + " semaines (en cours)")}
  </div>` : ""}

  <div class="section-title">Vue d'ensemble de l'année</div>
  <div class="card"><div class="yheat-wrap">${heat}</div></div>
  `;
}

function renderYearHeatmap(year) {
  const countByDay = {};
  DATA.activities.forEach(a => {
    if (a.date.slice(0,4) === String(year)) countByDay[a.date] = (countByDay[a.date]||0)+1;
  });
  const start = new Date(year, 0, 1);
  const startOffset = (start.getDay() + 6) % 7;
  const end = new Date(year, 11, 31);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  let cells = "";
  for (let i = 0; i < startOffset; i++) cells += `<div class="cell"></div>`;
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const iso = toISODate(d);
    const c = countByDay[iso] || 0;
    let lvl = "";
    if (c === 1) lvl = "l1"; else if (c === 2) lvl = "l2"; else if (c === 3) lvl = "l3"; else if (c >= 4) lvl = "l4";
    cells += `<div class="cell ${lvl}" title="${iso}: ${c}"></div>`;
  }
  return `<div class="yheat">${cells}</div>`;
}

function mountBilanYearChart() {
  const canvas = document.getElementById("chart-bilan-year");
  if (!canvas) return;
  const y = state.bilanYear;
  const data = [];
  for (let m = 0; m < 12; m++) {
    const s = new Date(y, m, 1), e = new Date(y, m + 1, 0);
    data.push(Math.round(totalsAll(activitiesInRange(null, s, e)).distance * 10) / 10);
  }
  renderBarChart("chart-bilan-year", MOIS_ABR, [{ label: "km", data, color: "#FC4C02" }]);
}
function mountBilanMonthChart() {
  const canvas = document.getElementById("chart-bilan-month");
  if (!canvas) return;
  const [y, m] = state.bilanMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const labels = [], data = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toISODate(new Date(y, m - 1, d));
    const dayActs = DATA.activities.filter(a => a.date === ds);
    labels.push(String(d));
    data.push(Math.round(totalsAll(dayActs).distance * 10) / 10);
  }
  renderBarChart("chart-bilan-month", labels, [{ label: "km", data, color: "#FC4C02" }]);
}

/* ================= RÉCAP VIDÉO MENSUEL ================= */
let recapState = null;
function computeMonthlyRecapSlides(y, m) {
  const mk = `${y}-${pad2(m)}`;
  const start = new Date(y, m - 1, 1), end = new Date(y, m, 0);
  const prevStart = new Date(y, m - 2, 1), prevEnd = new Date(y, m - 1, 0);
  const acts = activitiesInRange(null, start, end);
  const prevActs = activitiesInRange(null, prevStart, prevEnd);
  const tot = totalsAll(acts);
  const prevTot = totalsAll(prevActs);
  if (!tot.sessions) return null;
  const bySport = aggregateBySport(acts);
  const workoutsThisMonth = getWorkoutLogs().filter(w => w.date.slice(0, 7) === mk);
  const stepsThisMonth = DATA.steps.filter(s => s.date.slice(0, 7) === mk);
  const stepGoalMetDays = stepsThisMonth.filter(s => { const g = getStepGoalForDate(s.date); return g != null && s.count >= g; }).length;
  const avgSteps = stepsThisMonth.length ? Math.round(stepsThisMonth.reduce((t, s) => t + s.count, 0) / stepsThisMonth.length) : 0;
  const topSport = getAllSports().filter(s => bySport[s.id] && bySport[s.id].sessions > 0).sort((a, b) => bySport[b.id].sessions - bySport[a.id].sessions)[0];
  const longestAct = acts.filter(a => distanceKm(a) > 0).sort((a, b) => distanceKm(b) - distanceKm(a))[0];

  const slides = [];
  slides.push({ icon: "🎬", title: "Ton récap du mois", big: `${MOIS[m - 1]} ${y}`, sub: `${tot.sessions} séance${tot.sessions > 1 ? "s" : ""} au total`, color: ["#FC4C02", "#ff8a50"] });
  if (tot.distance > 0) {
    const diff = prevTot.distance > 0 ? Math.round(((tot.distance - prevTot.distance) / prevTot.distance) * 100) : null;
    slides.push({ icon: "📏", title: "Distance parcourue", big: fmtKm(tot.distance), sub: diff !== null ? `${diff >= 0 ? "+" : ""}${diff}% vs le mois dernier` : "", color: ["#1c7ed6", "#4dabf7"] });
  }
  if (tot.elevation > 0) {
    slides.push({ icon: "⛰️", title: "Dénivelé cumulé", big: fmtElevation(tot.elevation), sub: "", color: ["#8b5e34", "#c08552"] });
  }
  slides.push({ icon: "⏱️", title: "Temps total", big: fmtDuration(tot.duration), sub: "", color: ["#2f9e44", "#69db7c"] });
  if (topSport) {
    slides.push({ icon: topSport.icon, title: "Sport favori du mois", big: topSport.name, sub: `${bySport[topSport.id].sessions} séance${bySport[topSport.id].sessions > 1 ? "s" : ""}`, color: ["#e03131", "#ff8787"] });
  }
  if (longestAct) {
    const sp = getSport(longestAct.sport);
    slides.push({ icon: "🏆", title: "Meilleure sortie", big: fmtKm(distanceKm(longestAct)), sub: `${sp ? sp.name : ""} · ${fmtDateShort(longestAct.date)}`, color: ["#f08c00", "#ffd43b"] });
  }
  if (workoutsThisMonth.length > 0) {
    slides.push({ icon: "🏋️", title: "Renfo", big: `${workoutsThisMonth.length}`, sub: workoutsThisMonth.length > 1 ? "séances de renfo" : "séance de renfo", color: ["#495057", "#868e96"] });
  }
  if (stepsThisMonth.length > 0) {
    slides.push({ icon: "👣", title: "Pas quotidiens", big: fmtNum(avgSteps), sub: `en moyenne / jour · objectif atteint ${stepGoalMetDays}/${stepsThisMonth.length} jours`, color: ["#7048e8", "#9775fa"] });
  }
  slides.push({ icon: "🎉", title: "Bravo !", big: `${tot.sessions} séance${tot.sessions > 1 ? "s" : ""}`, sub: `en ${MOIS[m - 1]} — continue comme ça 💪`, color: ["#FC4C02", "#d94202"] });
  return slides;
}
function openMonthlyRecapStory(y, m) {
  const slides = computeMonthlyRecapSlides(y, m);
  if (!slides) { showToast("Pas encore assez d'activités ce mois-ci pour un récap 🙂"); return; }
  recapState = { slides, index: 0, timer: null, y, m };
  renderRecapStory();
}
function renderRecapStory() {
  if (!recapState) return;
  const { slides, index } = recapState;
  const s = slides[index];
  const bars = slides.map((_, i) => `<div class="recap-bar"><div class="recap-bar-fill ${i < index ? "full" : i === index ? "active" : ""}"></div></div>`).join("");
  const html = `
  <div class="recap-overlay" style="background:linear-gradient(160deg, ${s.color[0]}, ${s.color[1]});">
    <div class="recap-bars">${bars}</div>
    <button class="recap-close" data-action="recap-close">✕</button>
    <div class="recap-tapzone left" data-action="recap-prev"></div>
    <div class="recap-tapzone right" data-action="recap-next"></div>
    <div class="recap-content">
      <div class="recap-icon">${s.icon}</div>
      <div class="recap-title">${s.title}</div>
      <div class="recap-big">${s.big}</div>
      ${s.sub ? `<div class="recap-sub">${s.sub}</div>` : ""}
    </div>
    <div class="recap-footer">
      <button type="button" class="btn btn-block recap-download-btn" data-action="recap-download">🎥 Télécharger la vidéo</button>
    </div>
  </div>`;
  document.getElementById("modalRoot").innerHTML = html;
  startRecapTimer();
}
function startRecapTimer() {
  if (!recapState) return;
  clearTimeout(recapState.timer);
  recapState.timer = setTimeout(() => recapNext(), 3500);
}
function recapNext() {
  if (!recapState) return;
  if (recapState.index < recapState.slides.length - 1) { recapState.index++; renderRecapStory(); }
  else closeRecapStory();
}
function recapPrev() {
  if (!recapState) return;
  if (recapState.index > 0) { recapState.index--; renderRecapStory(); }
}
function closeRecapStory() {
  if (recapState) clearTimeout(recapState.timer);
  recapState = null;
  document.getElementById("modalRoot").innerHTML = "";
}
function recapDownload() {
  if (!recapState) return;
  const btn = document.querySelector(".recap-download-btn");
  if (btn && btn.disabled) return;
  clearTimeout(recapState.timer);
  const slides = recapState.slides;
  const monthLabel = (MOIS[recapState.m - 1] || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filenameBase = `sportsy-recap-${monthLabel}-${recapState.y}`;
  if (btn) { btn.disabled = true; btn.textContent = "🎬 Génération en cours..."; }
  renderVideoRecap(slides, filenameBase)
    .then(() => showToast("Vidéo téléchargée 🎉"))
    .catch(err => {
      console.error(err);
      showToast("Export vidéo indisponible sur cet appareil — tu peux filmer l'écran en attendant 🙂");
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = "🎥 Télécharger la vidéo"; }
      if (recapState) startRecapTimer();
    });
}
function drawRecapFrame(ctx, s, w, h, t) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, s.color[0]);
  grad.addColorStop(1, s.color[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const introProgress = Math.min(1, t / 0.15);
  const alpha = introProgress;
  const scale = 0.85 + 0.15 * introProgress;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.round(h * 0.13)}px sans-serif`;
  ctx.fillText(s.icon, 0, -h * 0.16);
  ctx.font = `700 ${Math.round(h * 0.04)}px -apple-system, sans-serif`;
  ctx.fillText(s.title, 0, -h * 0.02);
  ctx.font = `800 ${Math.round(h * 0.09)}px -apple-system, sans-serif`;
  wrapCanvasText(ctx, s.big, 0, h * 0.08, w * 0.85, Math.round(h * 0.1));
  if (s.sub) {
    ctx.font = `500 ${Math.round(h * 0.032)}px -apple-system, sans-serif`;
    ctx.globalAlpha = alpha * 0.9;
    wrapCanvasText(ctx, s.sub, 0, h * 0.2, w * 0.8, Math.round(h * 0.04));
  }
  ctx.restore();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.round(h * 0.022)}px -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("🏃 Sportsy", w / 2, h - h * 0.04);
  ctx.globalAlpha = 1;
}
function wrapCanvasText(ctx, text, cx, cy, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  words.forEach(word => {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  });
  if (line) lines.push(line);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}
function renderVideoRecap(slides, filenameBase) {
  return new Promise((resolve, reject) => {
    try {
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) { reject(new Error("MediaRecorder non supporté")); return; }
      const W = 720, H = 1280;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      const mimeCandidates = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
      const mimeType = mimeCandidates.find(mt => MediaRecorder.isTypeSupported(mt));
      if (!mimeType) { reject(new Error("Aucun format vidéo supporté")); return; }
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4000000 });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        downloadBlob(`${filenameBase}.${ext}`, blob);
        resolve();
      };
      recorder.onerror = e => reject((e && e.error) || new Error("Erreur d'enregistrement"));
      const slideDurationMs = 3000;
      const totalMs = slides.length * slideDurationMs;
      recorder.start();
      const startTime = performance.now();
      function frame(now) {
        const elapsed = now - startTime;
        if (elapsed >= totalMs) {
          drawRecapFrame(ctx, slides[slides.length - 1], W, H, 1);
          recorder.stop();
          return;
        }
        const idx = Math.min(slides.length - 1, Math.floor(elapsed / slideDurationMs));
        const within = (elapsed - idx * slideDurationMs) / slideDurationMs;
        drawRecapFrame(ctx, slides[idx], W, H, within);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    } catch (err) { reject(err); }
  });
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ================= COURSES ================= */
function renderCourses() {
  return `
  <div class="sport-tabs">
    <div class="sport-tab ${state.coursesTab==='mescourses'?'active':''}" data-action="courses-tab" data-tab="mescourses">Mes courses</div>
    <div class="sport-tab ${state.coursesTab==='wishlist'?'active':''}" data-action="courses-tab" data-tab="wishlist">Wishlist</div>
    <div class="sport-tab ${state.coursesTab==='challenges'?'active':''}" data-action="courses-tab" data-tab="challenges">Challenges</div>
    <div class="sport-tab ${state.coursesTab==='roadto'?'active':''}" data-action="courses-tab" data-tab="roadto">🎯 Road to...</div>
  </div>
  ${state.coursesTab === 'mescourses' ? renderCoursesMes() : state.coursesTab === 'wishlist' ? renderCoursesWishlist() : state.coursesTab === 'challenges' ? renderCoursesChallenges() : renderCoursesRoadTo()}
  `;
}
function renderCoursesMes() {
  const planned = getCourses({ status: 'planned' }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const done = getCourses({ status: 'done' }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `
  <button class="fab-add" data-action="add-course">+ Ajouter une course</button>
  <div class="section-title">À venir</div>
  ${planned.length ? planned.map(courseRowPlanned).join("") : `<div class="empty-state">Aucune course planifiée.</div>`}
  <div class="section-title">Terminées</div>
  ${done.length ? done.map(courseRowDone).join("") : `<div class="empty-state">Aucune course enregistrée pour l'instant.</div>`}
  `;
}
function renderCoursesWishlist() {
  const wish = getCourses({ status: 'wishlist' });
  const redo = getCourses({ wantToRedo: true });
  return `
  <button class="fab-add" data-action="add-wish">+ Ajouter à la wishlist</button>
  <div class="section-title">Nouvelles courses</div>
  ${wish.length ? wish.map(courseRowWishlist).join("") : `<div class="empty-state">Ta wishlist est vide pour l'instant.</div>`}
  <div class="section-title">Envie de refaire</div>
  ${redo.length ? redo.map(courseRowDone).join("") : `<div class="empty-state">Aucune course marquée « envie de refaire ».</div>`}
  `;
}
function renderCoursesChallenges() {
  const list = DATA.challenges;
  return `
  <button class="fab-add" data-action="add-challenge">+ Créer un challenge</button>
  ${list.length ? list.map(challengeCard).join("") : `<div class="empty-state"><div class="emoji">🏆</div>Crée ton premier challenge : une série de courses précises (comme les Superhalfs), un défi « un marathon par pays européen », ou toute autre liste personnalisée.</div>`}
  `;
}
function challengeCard(ch) {
  const total = ch.items.length;
  const done = ch.items.filter(i => i.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return `<div class="card">
    <div class="goal-head">
      <div class="name">🏆 ${ch.name}</div>
      <div class="actions">
        <button data-action="delete-challenge" data-id="${ch.id}">🗑️</button>
      </div>
    </div>
    ${ch.description ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">${ch.description}</div>` : ""}
    <div class="progress-bar-bg"><div class="progress-bar-fill ${pct>=100?'over':''}" style="width:${pct}%"></div></div>
    <div class="challenge-progress-label">${done} / ${total} réalisés</div>
    <button class="btn btn-outline btn-block" data-action="open-challenge" data-id="${ch.id}" style="margin-top:10px;">Voir le détail</button>
  </div>`;
}
function courseRowPlanned(c) {
  const sp = getSport(c.sport);
  const days = c.date ? Math.ceil((parseISO(c.date) - parseISO(todayISO())) / 86400000) : null;
  return `<div class="card course-card">
    <div class="course-head">
      <div>
        <div class="course-title">${sp ? sp.icon : '🏁'} ${c.name}</div>
        <div class="course-sub">${c.date ? fmtDateShort(c.date) : 'Date à définir'}${c.location ? ' · ' + c.location : ''}${c.distanceLabel ? ' · ' + c.distanceLabel : ''}</div>
      </div>
      ${days !== null ? `<div class="countdown-badge">${days >= 0 ? 'J-' + days : 'Passée'}</div>` : ''}
    </div>
    <div class="course-actions">
      <button class="btn btn-primary btn-sm" data-action="mark-done" data-id="${c.id}">✅ Terminée</button>
      <button class="btn btn-secondary btn-sm" data-action="edit-course" data-id="${c.id}">✏️ Modifier</button>
      <button class="btn btn-danger btn-sm" data-action="delete-course" data-id="${c.id}">🗑️</button>
    </div>
  </div>`;
}
function courseRowDone(c) {
  const sp = getSport(c.sport);
  return `<div class="card course-card">
    <div class="course-head">
      <div>
        <div class="course-title">${sp ? sp.icon : '🏁'} ${c.name}</div>
        <div class="course-sub">${c.date ? fmtDateShort(c.date) : ''}${c.location ? ' · ' + c.location : ''}${c.distanceLabel ? ' · ' + c.distanceLabel : ''}${c.resultTime ? ' · ' + c.resultTime : ''}</div>
      </div>
      ${c.wantToRedo ? `<span class="badge">🔁 À refaire</span>` : ''}
    </div>
    ${c.notes ? `<div style="font-size:13px;color:var(--text-muted);margin-top:8px;">${c.notes}</div>` : ''}
    ${c.photos && c.photos.length ? `<div class="photo-gallery">${c.photos.map(src => `<div class="photo-thumb"><img src="${src}" data-action="view-photo" data-src="${src}"></div>`).join("")}</div>` : ''}
    <div class="course-actions">
      <button class="btn btn-secondary btn-sm" data-action="edit-course" data-id="${c.id}">✏️ Modifier</button>
      <button class="btn btn-outline btn-sm" data-action="toggle-redo" data-id="${c.id}">${c.wantToRedo ? 'Retirer' : '🔁 Envie de refaire'}</button>
      <button class="btn btn-danger btn-sm" data-action="delete-course" data-id="${c.id}">🗑️</button>
    </div>
  </div>`;
}
function courseRowWishlist(c) {
  const sp = getSport(c.sport);
  return `<div class="card course-card">
    <div class="course-title">${sp ? sp.icon : '🏁'} ${c.name}</div>
    <div class="course-sub">${c.location || ''}${c.distanceLabel ? ' · ' + c.distanceLabel : ''}</div>
    ${c.notes ? `<div style="font-size:13px;color:var(--text-muted);margin-top:8px;">${c.notes}</div>` : ''}
    <div class="course-actions">
      <button class="btn btn-primary btn-sm" data-action="plan-course" data-id="${c.id}">📅 Planifier</button>
      <button class="btn btn-secondary btn-sm" data-action="edit-course" data-id="${c.id}">✏️</button>
      <button class="btn btn-danger btn-sm" data-action="delete-course" data-id="${c.id}">🗑️</button>
    </div>
  </div>`;
}

/* ================= ROAD TO... (objectifs long terme + journal de bord) ================= */
const JOURNAL_CATEGORIES = [
  { id: "nutrition", icon: "🍝", label: "Tests nutrition" },
  { id: "materiel", icon: "🎒", label: "Tests matériel" },
  { id: "pieds", icon: "🦶", label: "Pieds / ampoules" },
  { id: "sensations", icon: "❤️", label: "Sensations" },
  { id: "recuperation", icon: "😴", label: "Récupération" },
  { id: "experience", icon: "🧪", label: "Expériences" }
];
function journalCategory(id) { return JOURNAL_CATEGORIES.find(c => c.id === id); }
function daysUntil(dateIso) {
  if (!dateIso) return null;
  return Math.ceil((parseISO(dateIso) - parseISO(todayISO())) / 86400000);
}
function renderCoursesRoadTo() {
  const roadmaps = getRoadmaps();
  return `
  <button class="fab-add" data-action="add-roadmap">+ Créer un « Road to... »</button>
  ${roadmaps.length ? roadmaps.map(roadmapCard).join("") : `<div class="empty-state"><div class="emoji">🎯</div>Définis ta grande course objectif (UTMB, Diagonale des Fous, Saintélyon...) et les courses étapes qui t'y mèneront, avec un journal de bord pour suivre ta préparation.</div>`}
  `;
}
function roadmapCard(r) {
  const sp = getSport(r.sport);
  const days = daysUntil(r.date);
  const doneSteps = r.steps.filter(s => s.done).length;
  const goalLabel = r.goalType === "temps" ? `⏱️ Objectif : ${r.goalTime || "temps à définir"}` : "🎯 Objectif : Finisher";
  return `<div class="card course-card">
    <div class="course-head">
      <div>
        <div class="course-title">${sp ? sp.icon : "🏁"} ${r.name}</div>
        <div class="course-sub">${r.date ? fmtDateShort(r.date) : "Date approximative à définir"} · ${goalLabel}</div>
      </div>
      ${days !== null ? `<div class="countdown-badge">${days >= 0 ? "J-" + days : "Passée"}</div>` : ""}
    </div>
    <div class="roadmap-mini-stats">
      <span class="badge ${r.dossard ? "badge-green" : ""}">${r.dossard ? "🎫 Dossard acheté" : "🎫 Dossard non acheté"}</span>
      <span class="badge">🪜 ${doneSteps} / ${r.steps.length} étapes faites</span>
      <span class="badge">📓 ${r.journal.length} entrée${r.journal.length > 1 ? "s" : ""} au journal</span>
    </div>
    <div class="course-actions">
      <button class="btn btn-primary btn-sm" data-action="open-roadmap" data-id="${r.id}">📖 Ouvrir le journal</button>
      <button class="btn btn-secondary btn-sm" data-action="edit-roadmap" data-id="${r.id}">✏️</button>
      <button class="btn btn-danger btn-sm" data-action="delete-roadmap" data-id="${r.id}">🗑️</button>
    </div>
  </div>`;
}
function openRoadmapModal(existing) {
  const r = existing || { name: "", sport: "trail", date: "", dossard: false, goalType: "finisher", goalTime: "" };
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>${existing ? "Modifier l'objectif" : "🎯 Nouveau « Road to... »"}</h2>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <form id="form-roadmap" data-id="${existing ? existing.id : ""}">
        <div class="form-group"><label>Nom de la course objectif</label><input type="text" name="name" value="${r.name || ""}" required placeholder="Ex : UTMB, Diagonale des Fous, Saintélyon..."></div>
        <div class="form-group">
          <label>Sport</label>
          <input type="hidden" id="pill-roadmapsport-value" name="sport" value="${r.sport || "trail"}">
          <div class="pill-select">
            ${getAllSports().map(s => `<div class="pill ${r.sport===s.id?'active':''}" data-action="pill-choose" data-target="pill-roadmapsport-value" data-value="${s.id}">${s.icon} ${s.name}</div>`).join("")}
          </div>
        </div>
        <div class="form-group"><label>📅 Date approximative de la course</label><input type="date" name="date" value="${r.date || ""}"></div>
        <div class="form-group">
          <label>🎯 Objectif</label>
          <input type="hidden" id="pill-roadmapgoal-value" name="goalType" value="${r.goalType || "finisher"}">
          <div class="pill-select">
            <div class="pill ${(r.goalType||"finisher")==='finisher'?'active':''}" data-action="pill-choose" data-target="pill-roadmapgoal-value" data-value="finisher">🎯 Finisher</div>
            <div class="pill ${r.goalType==='temps'?'active':''}" data-action="pill-choose" data-target="pill-roadmapgoal-value" data-value="temps">⏱️ Temps</div>
          </div>
        </div>
        <div class="form-group field-roadmap-time"><label>Temps visé</label><input type="text" name="goalTime" value="${r.goalTime || ""}" placeholder="Ex : sous les 15h"></div>
        <div class="form-group">
          <label>🎫 Dossard</label>
          <input type="hidden" id="pill-roadmapdossard-value" name="dossard" value="${r.dossard ? "1" : "0"}">
          <div class="pill-select">
            <div class="pill ${!r.dossard?'active':''}" data-action="pill-choose" data-target="pill-roadmapdossard-value" data-value="0">Non acheté</div>
            <div class="pill ${r.dossard?'active':''}" data-action="pill-choose" data-target="pill-roadmapdossard-value" data-value="1">✅ Acheté</div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">${existing ? "Enregistrer" : "Créer"}</button>
        ${existing ? `<button type="button" class="btn btn-danger btn-block" data-action="delete-roadmap" data-id="${existing.id}">Supprimer ce « Road to... »</button>` : ""}
      </form>
    </div>
  </div>`;
  mountModal(html);
  updateRoadmapFormFields();
}
function updateRoadmapFormFields() {
  const form = document.getElementById("form-roadmap");
  if (!form) return;
  const goalType = document.getElementById("pill-roadmapgoal-value").value;
  form.querySelector(".field-roadmap-time").style.display = goalType === "temps" ? "" : "none";
}
function saveRoadmapForm(form) {
  const fd = new FormData(form);
  const roadmap = {
    name: fd.get("name"),
    sport: fd.get("sport") || "trail",
    date: fd.get("date") || "",
    dossard: fd.get("dossard") === "1",
    goalType: fd.get("goalType") || "finisher",
    goalTime: fd.get("goalType") === "temps" ? (fd.get("goalTime") || "") : ""
  };
  const id = form.dataset.id;
  if (id) {
    updateRoadmap(id, roadmap);
    closeModal(); render(); showToast("Objectif mis à jour");
  } else {
    addRoadmap(Object.assign({ steps: [], journal: [] }, roadmap));
    closeModal(); render(); showToast("Nouveau « Road to... » créé 🎯");
  }
}
function openRoadmapDetailModal(id) {
  const r = getRoadmap(id);
  if (!r) return;
  state.roadmapDetailId = id;
  const sp = getSport(r.sport);
  const days = daysUntil(r.date);
  const goalLabel = r.goalType === "temps" ? `⏱️ Objectif : ${r.goalTime || "temps à définir"}` : "🎯 Objectif : Finisher";
  const stepsRows = r.steps.length
    ? r.steps.map(s => roadmapStepRow(r, s)).join("")
    : `<div class="empty-state" style="padding:16px 0;">Aucune étape pour l'instant — ajoute les courses qui te préparent à l'objectif.</div>`;
  const journalRows = r.journal.length
    ? r.journal.map(j => journalEntryRow(r, j)).join("")
    : `<div class="empty-state" style="padding:16px 0;">Ton journal de bord est vide — note tes tests, sensations et expériences au fil de la prépa.</div>`;
  const categoryButtons = JOURNAL_CATEGORIES.map(c => `<div class="pill" data-action="add-journal-entry" data-id="${r.id}" data-category="${c.id}">${c.icon} ${c.label}</div>`).join("");
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>${sp ? sp.icon : "🏁"} ${r.name}</h2>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div class="course-sub">📅 ${r.date ? fmtDateShort(r.date) : "Date à définir"}${days !== null ? ` · ${days >= 0 ? "J-" + days : "Passée"}` : ""}</div>
        <button data-action="edit-roadmap" data-id="${r.id}" style="border:none;background:none;color:var(--text-muted);font-size:16px;">✏️</button>
      </div>
      <div class="roadmap-mini-stats" style="margin-bottom:6px;">
        <span class="badge">${goalLabel}</span>
        <span class="badge ${r.dossard ? "badge-green" : ""}" data-action="toggle-roadmap-dossard" data-id="${r.id}" style="cursor:pointer;">${r.dossard ? "🎫 Dossard acheté" : "🎫 Dossard non acheté"}</span>
      </div>

      <div class="section-title">🪜 Étapes vers l'objectif</div>
      <button class="btn btn-outline btn-block" data-action="add-roadmap-step" data-id="${r.id}">+ Ajouter une étape</button>
      <div class="card" style="margin-top:8px;">${stepsRows}</div>

      <div class="section-title">📓 Journal de bord</div>
      <div class="pill-select" style="margin-bottom:10px;">${categoryButtons}</div>
      ${journalRows}
    </div>
  </div>`;
  mountModal(html);
}
function roadmapStepRow(r, s) {
  const sp = getSport(s.sport);
  return `<div class="stat-row" style="align-items:flex-start;">
    <div class="label">
      <div style="font-weight:700;${s.done ? "text-decoration:line-through;color:var(--text-muted);" : ""}">${sp ? sp.icon : "🏁"} ${s.name}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${s.date ? fmtDateShort(s.date) : "Date prévisionnelle non définie"}</div>
    </div>
    <div class="value" style="text-align:right;">
      <div class="badge ${s.dossard ? "badge-green" : ""}" data-action="toggle-step-dossard" data-roadmap-id="${r.id}" data-step-id="${s.id}" style="cursor:pointer;margin-bottom:4px;">${s.dossard ? "🎫 Acheté" : "🎫 Non acheté"}</div>
      <div>
        <button data-action="toggle-step-done" data-roadmap-id="${r.id}" data-step-id="${s.id}" style="border:none;background:none;color:var(--text-muted);" title="Faite">${s.done ? "✅" : "⬜"}</button>
        <button data-action="edit-roadmap-step" data-roadmap-id="${r.id}" data-step-id="${s.id}" style="border:none;background:none;color:var(--text-muted);">✏️</button>
        <button data-action="delete-roadmap-step" data-roadmap-id="${r.id}" data-step-id="${s.id}" style="border:none;background:none;color:var(--text-muted);">🗑️</button>
      </div>
    </div>
  </div>`;
}
function openRoadmapStepModal(roadmapId, stepId) {
  const r = getRoadmap(roadmapId);
  if (!r) return;
  const s = stepId ? r.steps.find(x => x.id === stepId) : { name: "", sport: r.sport || "trail", date: "", dossard: false, done: false };
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>${stepId ? "Modifier l'étape" : "Nouvelle étape"}</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-roadmap-step" data-roadmap-id="${r.id}" data-step-id="${stepId || ""}">
        <div class="form-group"><label>Nom de la course</label><input type="text" name="name" value="${s.name || ""}" required placeholder="Ex : Trail à définir, ou nom précis une fois choisi"></div>
        <p style="font-size:12px;color:var(--text-muted);margin-top:-6px;">Tu peux commencer par une simple prévision (ex : « trail ~30km courant mai ») et revenir modifier cette étape plus tard une fois la course précise choisie.</p>
        <div class="form-group">
          <label>Sport</label>
          <input type="hidden" id="pill-stepsport-value" name="sport" value="${s.sport || "trail"}">
          <div class="pill-select">
            ${getAllSports().map(sp => `<div class="pill ${s.sport===sp.id?'active':''}" data-action="pill-choose" data-target="pill-stepsport-value" data-value="${sp.id}">${sp.icon} ${sp.name}</div>`).join("")}
          </div>
        </div>
        <div class="form-group"><label>Date approximative</label><input type="date" name="date" value="${s.date || ""}"></div>
        <div class="form-group">
          <label>🎫 Dossard</label>
          <input type="hidden" id="pill-stepdossard-value" name="dossard" value="${s.dossard ? "1" : "0"}">
          <div class="pill-select">
            <div class="pill ${!s.dossard?'active':''}" data-action="pill-choose" data-target="pill-stepdossard-value" data-value="0">Non acheté</div>
            <div class="pill ${s.dossard?'active':''}" data-action="pill-choose" data-target="pill-stepdossard-value" data-value="1">✅ Acheté</div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
        ${stepId ? `<button type="button" class="btn btn-danger btn-block" data-action="delete-roadmap-step" data-roadmap-id="${r.id}" data-step-id="${stepId}">Supprimer cette étape</button>` : ""}
      </form>
    </div>
  </div>`;
  mountModal(html);
}
function saveRoadmapStepForm(form) {
  const fd = new FormData(form);
  const roadmapId = form.dataset.roadmapId;
  const stepId = form.dataset.stepId;
  const step = {
    name: fd.get("name"),
    sport: fd.get("sport") || "trail",
    date: fd.get("date") || "",
    dossard: fd.get("dossard") === "1"
  };
  if (stepId) updateRoadmapStep(roadmapId, stepId, step);
  else addRoadmapStep(roadmapId, step);
  closeModal(); render(); openRoadmapDetailModal(roadmapId);
  showToast(stepId ? "Étape mise à jour" : "Étape ajoutée 🪜");
}
function journalEntryRow(r, j) {
  const cat = journalCategory(j.category) || { icon: "📓", label: "" };
  const photos = j.photos && j.photos.length ? `<div class="photo-gallery">${j.photos.map(src => `<div class="photo-thumb"><img src="${src}" data-action="view-photo" data-src="${src}"></div>`).join("")}</div>` : "";
  let body = "";
  if (j.category === "experience") {
    body = `<div style="font-size:13px;margin-top:4px;">
      <div><strong>Test :</strong> ${j.test || ""}</div>
      <div><strong>Résultat :</strong> ${j.resultat || ""}</div>
      <div><strong>Verdict :</strong> ${j.verdict === "adopte" ? "✅ Adopté" : j.verdict === "abandonne" ? "❌ Abandonné" : "—"}</div>
    </div>`;
  } else {
    body = j.text ? `<div style="font-size:13px;margin-top:4px;">${j.text}</div>` : "";
  }
  return `<div class="card journal-entry-card">
    <div class="goal-head">
      <div class="name">${cat.icon} ${cat.label} <span style="font-weight:400;color:var(--text-muted);font-size:12px;">· ${fmtDateShort(j.date)}</span></div>
      <div class="actions"><button data-action="delete-journal-entry" data-roadmap-id="${r.id}" data-entry-id="${j.id}">🗑️</button></div>
    </div>
    ${body}
    ${photos}
  </div>`;
}
function openJournalEntryModal(roadmapId, category) {
  const cat = journalCategory(category);
  if (!cat) return;
  pendingJournalPhotos = [];
  const isExperience = category === "experience";
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>${cat.icon} ${cat.label}</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-journal-entry" data-roadmap-id="${roadmapId}" data-category="${category}">
        <div class="form-group"><label>Date</label><input type="date" name="date" value="${todayISO()}" required></div>
        ${isExperience ? `
        <div class="form-group"><label>Test</label><input type="text" name="test" placeholder="Ex : chaussures X sur 3h30" required></div>
        <div class="form-group"><label>Résultat</label><input type="text" name="resultat" placeholder="Ex : ampoule au pied gauche après 2h45" required></div>
        <div class="form-group">
          <label>Verdict</label>
          <input type="hidden" id="pill-verdict-value" name="verdict" value="adopte">
          <div class="pill-select">
            <div class="pill active" data-action="pill-choose" data-target="pill-verdict-value" data-value="adopte">✅ Adopté</div>
            <div class="pill" data-action="pill-choose" data-target="pill-verdict-value" data-value="abandonne">❌ Abandonné</div>
          </div>
        </div>
        ` : `
        <div class="form-group"><label>Note</label><textarea name="text" placeholder="Ce que tu veux garder en mémoire..." required></textarea></div>
        `}
        <div class="form-group">
          <label>Photos</label>
          <div class="photo-gallery" id="journalPhotoGalleryContainer">${renderJournalPhotoGalleryInner()}</div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Ajouter au journal</button>
      </form>
    </div>
  </div>`;
  mountModal(html);
}
function renderJournalPhotoGalleryInner() {
  return pendingJournalPhotos.map((src, i) => `<div class="photo-thumb"><img src="${src}" data-action="view-photo" data-src="${src}"><button type="button" class="rm" data-action="remove-journal-photo" data-index="${i}">✕</button></div>`).join("") +
    `<label class="photo-add-tile">📷<input type="file" id="journalPhotoInput" accept="image/*" multiple style="display:none"></label>`;
}
function refreshJournalPhotoGallery() {
  const el = document.getElementById("journalPhotoGalleryContainer");
  if (el) el.innerHTML = renderJournalPhotoGalleryInner();
}
function saveJournalEntryForm(form) {
  const fd = new FormData(form);
  const roadmapId = form.dataset.roadmapId;
  const category = form.dataset.category;
  const entry = { date: fd.get("date"), category, photos: pendingJournalPhotos.slice() };
  if (category === "experience") {
    entry.test = fd.get("test") || "";
    entry.resultat = fd.get("resultat") || "";
    entry.verdict = fd.get("verdict") || "adopte";
  } else {
    entry.text = fd.get("text") || "";
  }
  addJournalEntry(roadmapId, entry);
  closeModal(); render(); openRoadmapDetailModal(roadmapId);
  showToast("Entrée ajoutée au journal 📓");
}

/* ================= BADGES ================= */
function computeLongestStreak() {
  if (!DATA.activities.length) return 0;
  const dates = DATA.activities.map(a => a.date).sort();
  let cursor = mondayOf(parseISO(dates[0]));
  const lastMonday = mondayOf(new Date());
  let best = 0, cur = 0;
  while (cursor <= lastMonday) {
    const wEnd = addDays(cursor, 6);
    const has = activitiesInRange(null, cursor, wEnd).length > 0;
    if (has) { cur++; best = Math.max(best, cur); } else { cur = 0; }
    cursor = addWeeks(cursor, 1);
  }
  return best;
}
function computeLongestRunningDayStreak() {
  const dates = new Set(DATA.activities.filter(a => RUNNING_COMBO_SPORTS.includes(a.sport)).map(a => a.date));
  if (!dates.size) return 0;
  const sorted = Array.from(dates).sort();
  let cursor = parseISO(sorted[0]);
  const today = new Date();
  let best = 0, cur = 0;
  while (cursor <= today) {
    if (dates.has(toISODate(cursor))) { cur++; best = Math.max(best, cur); } else { cur = 0; }
    cursor = addDays(cursor, 1);
  }
  return best;
}
/* Paliers "voyage" pour la distance cumulée (marche, running combo...) */
const THEMED_DISTANCE_INFO = [
  { km: 1000, icon: "🇫🇷", label: "France", full: "Traversée de la France (1000 km)" },
  { km: 4000, icon: "🇦🇺", label: "Australie", full: "Traversée de l'Australie, Perth → Sydney (4000 km)" },
  { km: 5000, icon: "🇪🇺", label: "Europe", full: "Traversée de l'Europe, Lisbonne → l'Oural (5000 km)" },
  { km: 8000, icon: "🌍", label: "Afrique", full: "Traversée de l'Afrique, Le Caire → Le Cap (8000 km)" },
  { km: 17000, icon: "🌎", label: "Amériques", full: "Du Canada à la Patagonie (17 000 km)" },
  { km: 40000, icon: "🌐", label: "Tour du monde", full: "Tour du monde (40 000 km)" }
];
/* Paliers "sommets" pour le dénivelé cumulé */
const THEMED_ELEVATION_INFO = [
  { m: 1000, icon: "🌋", label: "Puy de Dôme", full: "Puy de Dôme (1000 m)" },
  { m: 4810, icon: "🏔️", label: "Mont Blanc", full: "Mont Blanc (4810 m)" },
  { m: 5895, icon: "🌋", label: "Kilimanjaro", full: "Kilimanjaro (5895 m)" },
  { m: 8849, icon: "🏔️", label: "Everest", full: "Everest (8849 m)" },
  { m: 17698, icon: "🏔️", label: "2x Everest", full: "2x Everest (17 698 m)" },
  { m: 44245, icon: "🏔️", label: "5x Everest", full: "5x Everest (44 245 m)" }
];
function themedDistanceGroup(id, icon, title, current) {
  const byKm = Object.fromEntries(THEMED_DISTANCE_INFO.map(t => [t.km, t]));
  return {
    id, icon, title, current, tiers: THEMED_DISTANCE_INFO.map(t => t.km),
    fmtCurrent: v => fmtKm(v),
    fmtTarget: v => byKm[v] ? byKm[v].full : `${v} km`,
    chipLabel: v => byKm[v] ? byKm[v].label : `${v} km`,
    tierIcon: v => byKm[v] ? byKm[v].icon : icon
  };
}
function themedElevationGroup(id, icon, title, current) {
  const byM = Object.fromEntries(THEMED_ELEVATION_INFO.map(t => [t.m, t]));
  return {
    id, icon, title, current, tiers: THEMED_ELEVATION_INFO.map(t => t.m),
    fmtCurrent: v => fmtElevation(v),
    fmtTarget: v => byM[v] ? byM[v].full : fmtElevation(v),
    chipLabel: v => byM[v] ? byM[v].label : fmtElevation(v),
    tierIcon: v => byM[v] ? byM[v].icon : icon
  };
}
function buildBadgeGroups() {
  const KM_TIERS = [10, 50, 100, 250, 500, 1000, 1500, 2000, 3000, 5000, 7500, 10000];
  const SWIM_TIERS = [1, 5, 10, 25, 50, 100];
  const SESSION_TIERS = [5, 10, 25, 50, 100, 250, 500];
  const groups = [];
  getAllSports().forEach(s => {
    if (s.id === "hyrox") return; // pas de badges pour l'Hyrox (usage ponctuel)
    const isMarche = (s.name || "").trim().toLowerCase() === "marche";
    if (s.distance) {
      const current = aggForSport(getActivities({ sport: s.id })).distance;
      if (isMarche) {
        groups.push(themedDistanceGroup("dist-" + s.id, s.icon, `Distance – ${s.name}`, current));
      } else {
        const tiers = s.distanceUnit === "m" ? SWIM_TIERS : KM_TIERS;
        groups.push({
          id: "dist-" + s.id, icon: s.icon, title: `Distance – ${s.name}`,
          current, tiers, fmtCurrent: v => fmtKm(v), fmtTarget: v => `${v} km`
        });
      }
    } else {
      const current = activityCountForSport(s.id);
      groups.push({
        id: "sess-" + s.id, icon: s.icon, title: `Séances – ${s.name}`,
        current, tiers: SESSION_TIERS, fmtCurrent: v => `${v} séance${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}`
      });
    }
  });

  const runningComboDistance = DATA.activities.filter(a => RUNNING_COMBO_SPORTS.includes(a.sport)).reduce((t, a) => t + distanceKm(a), 0);
  groups.push(themedDistanceGroup("dist-running-combo", "🏃", "Distance – Running (CAP + Trail)", runningComboDistance));

  const totalSessions = DATA.activities.length;
  groups.push({ id: "total-sessions", icon: "🎯", title: "Total séances (tous sports)", current: totalSessions, tiers: [10, 25, 50, 100, 250, 500, 1000], fmtCurrent: v => `${v} séance${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const totalElevation = totalsAll(DATA.activities).elevation;
  groups.push(themedElevationGroup("elevation", "⛰️", "Dénivelé cumulé", totalElevation));

  const streak = computeLongestStreak();
  groups.push({ id: "streak", icon: "🔥", title: "Régularité (semaines d'affilée)", current: streak, tiers: [4, 8, 12, 26, 52, 78, 104, 156, 260], fmtCurrent: v => `${v} semaine${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const runningDayStreak = computeLongestRunningDayStreak();
  groups.push({ id: "running-streak", icon: "🏃", title: "Running streak (CAP + Trail, jours d'affilée)", current: runningDayStreak, tiers: [3, 7, 14, 30, 60, 100, 180, 365, 500, 1000], fmtCurrent: v => `${v} jour${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const stepsStreak = computeLongestStepsGoalStreak();
  groups.push({ id: "steps-streak", icon: "👣", title: "Streak pas quotidiens (objectif atteint)", current: stepsStreak, tiers: [3, 7, 14, 30, 60, 100, 180, 365, 500, 1000], fmtCurrent: v => `${v} jour${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const coursesDone = getCourses({ status: "done" }).length;
  groups.push({ id: "courses", icon: "🏁", title: "Courses terminées", current: coursesDone, tiers: [1, 5, 10, 25, 50, 75, 100, 150], fmtCurrent: v => `${v} course${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const sportsTried = getAllSports().filter(s => activityCountForSport(s.id) > 0).length;
  groups.push({ id: "explorer", icon: "🧭", title: "Sports essayés", current: sportsTried, tiers: [3, 5, 7], fmtCurrent: v => `${v} sport${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const challengesDone = DATA.challenges.filter(ch => ch.items.length > 0 && ch.items.every(i => i.done)).length;
  groups.push({ id: "challenges", icon: "🏆", title: "Challenges complétés", current: challengesDone, tiers: [1, 3, 5], fmtCurrent: v => `${v} challenge${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const workoutsDone = getWorkoutLogs().length;
  groups.push({ id: "workouts", icon: "🏋️", title: "Séances de renfo", current: workoutsDone, tiers: [5, 10, 25, 50, 100, 250], fmtCurrent: v => `${v} séance${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  return groups;
}
function badgeGroupEarnedCount(g) { return g.tiers.filter(t => g.current >= t).length; }
function renderBadgeGroupHTML(g) {
  const nextTier = g.tiers.find(t => g.current < t);
  const chips = g.tiers.map(t => {
    const earned = g.current >= t;
    const icon = earned ? (g.tierIcon ? g.tierIcon(t) : g.icon) : '🔒';
    const label = g.chipLabel ? g.chipLabel(t) : g.fmtTarget(t);
    return `<div class="badge-tier ${earned ? 'earned' : 'locked'}">
      <div class="ic">${icon}</div>
      <div class="lbl">${label}</div>
    </div>`;
  }).join("");
  const progressText = nextTier
    ? `${g.fmtCurrent(g.current)} — prochain palier : ${g.fmtTarget(nextTier)}`
    : `🎉 Tous les paliers débloqués !`;
  return `<div class="card badge-group">
    <div class="goal-head"><div class="name">${g.icon} ${g.title}</div></div>
    <div class="badge-tier-row">${chips}</div>
    <div style="font-size:12px;color:var(--text-muted);">${progressText}</div>
  </div>`;
}
function openBadgesModal() {
  const groups = buildBadgeGroups();
  const earned = groups.reduce((t, g) => t + badgeGroupEarnedCount(g), 0);
  const total = groups.reduce((t, g) => t + g.tiers.length, 0);
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>🏅 Mes badges</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <div style="text-align:center;margin-bottom:14px;font-size:14px;color:var(--text-muted);">${earned} / ${total} badges débloqués</div>
      ${groups.map(renderBadgeGroupHTML).join("")}
    </div>
  </div>`;
  mountModal(html);
}

/* ---- Popup de déblocage de badge ---- */
function snapshotBadgeState() {
  return buildBadgeGroups().map(g => ({ id: g.id, earnedTiers: g.tiers.filter(t => g.current >= t) }));
}
function detectNewBadges(before) {
  const after = buildBadgeGroups();
  const newly = [];
  after.forEach(g => {
    const prev = before.find(b => b.id === g.id);
    const prevTiers = prev ? prev.earnedTiers : [];
    g.tiers.forEach(t => {
      if (g.current >= t && !prevTiers.includes(t)) newly.push({ group: g, tier: t });
    });
  });
  return newly;
}
function badgeItemsFromNewly(newly) {
  return (newly || []).map(({ group: g, tier: t }) => ({
    icon: g.tierIcon ? g.tierIcon(t) : g.icon,
    title: g.title,
    sub: g.chipLabel ? g.chipLabel(t) : g.fmtTarget(t)
  }));
}
function showBadgeUnlockPopup(newly) {
  showCelebrationPopup(badgeItemsFromNewly(newly));
}
function showCelebrationPopup(items) {
  if (!items || !items.length) return;
  const html = items.map(it => `<div class="badge-unlock-item">
      <div class="ic">${it.icon}</div>
      <div class="txt"><div class="title">${it.title}</div><div class="lbl">${it.sub}</div></div>
    </div>`).join("");
  const modal = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div style="text-align:center;padding:6px 0 4px;">
        <div style="font-size:44px;">🎉</div>
        <h2 style="margin:6px 0 2px;">${items.length > 1 ? "Nouveaux déblocages !" : "Nouveau déblocage !"}</h2>
      </div>
      ${html}
      <button class="btn btn-primary btn-block" data-action="close-modal" style="margin-top:14px;">Continuer 🙌</button>
    </div>
  </div>`;
  mountModal(modal);
}

/* ================= ÎLES D'AVENTURE ================= */
const ADVENTURE_ISLANDS = [
  { id: "debutant", name: "Île du Débutant", icon: "🏝️", length: 10, colors: ["#40c057", "#8ce99a"],
    objects: [
      { icon: "🐚", at: 2, name: "Coquillage" },
      { icon: "🌴", at: 4, name: "Palmier" },
      { icon: "⛲", at: 6, name: "Fontaine" },
      { icon: "🦜", at: 8, name: "Perroquet" },
      { icon: "🏆", at: 10, name: "Trésor caché" }
    ] },
  { id: "foret", name: "Île de la Forêt", icon: "🌲", length: 20, colors: ["#2f9e44", "#69db7c"],
    objects: [
      { icon: "🍄", at: 4, name: "Champignon" },
      { icon: "🦌", at: 8, name: "Cerf" },
      { icon: "🏕️", at: 12, name: "Campement" },
      { icon: "🦉", at: 16, name: "Chouette" },
      { icon: "🗿", at: 20, name: "Statue ancienne" }
    ] },
  { id: "volcan", name: "Île Volcanique", icon: "🌋", length: 35, colors: ["#e8590c", "#ffa94d"],
    objects: [
      { icon: "🔥", at: 7, name: "Flamme éternelle" },
      { icon: "🪨", at: 14, name: "Roche noire" },
      { icon: "🦎", at: 21, name: "Salamandre" },
      { icon: "💎", at: 28, name: "Cristal" },
      { icon: "👑", at: 35, name: "Couronne du volcan" }
    ] },
  { id: "glace", name: "Île Glacée", icon: "🏔️", length: 50, colors: ["#1c7ed6", "#99e9f2"],
    objects: [
      { icon: "❄️", at: 10, name: "Flocon" },
      { icon: "🐧", at: 20, name: "Manchot" },
      { icon: "⛄", at: 30, name: "Bonhomme de neige" },
      { icon: "🧊", at: 40, name: "Glacier" },
      { icon: "🌟", at: 50, name: "Étoile polaire" }
    ] },
  { id: "mystere", name: "Île Mystérieuse", icon: "🌫️", length: 75, colors: ["#5f3dc4", "#b197fc"],
    objects: [
      { icon: "🔮", at: 15, name: "Boule de cristal" },
      { icon: "🦇", at: 30, name: "Chauve-souris" },
      { icon: "🕯️", at: 45, name: "Bougie" },
      { icon: "🗝️", at: 60, name: "Clé mystérieuse" },
      { icon: "👻", at: 75, name: "Esprit gardien" }
    ] },
  { id: "legende", name: "Île Légendaire", icon: "🐉", length: 120, colors: ["#c92a2a", "#ffa8a8"],
    objects: [
      { icon: "🥚", at: 24, name: "Œuf de dragon" },
      { icon: "🔥", at: 48, name: "Souffle ardent" },
      { icon: "⚔️", at: 72, name: "Épée ancienne" },
      { icon: "🛡️", at: 96, name: "Bouclier" },
      { icon: "🐉", at: 120, name: "Dragon légendaire" }
    ] }
];
const ADVENTURE_MAPS = [
  {
    id: "archipel1",
    name: "Archipel de départ",
    islands: ADVENTURE_ISLANDS,
    quests: [
      { id: "q-premiers-pas", icon: "🚩", title: "Premiers pas", desc: "Termine un parcours pour la première fois, sur n'importe quelle île.",
        check: ctx => ctx.islands.some(i => i.laps >= 1),
        progress: ctx => ctx.islands.some(i => i.laps >= 1) ? "1/1" : "0/1" },
      { id: "q-exploratrice", icon: "🔍", title: "Exploratrice", desc: "Débloque 10 objets au total sur la carte.",
        check: ctx => adventureTotalObjectsUnlocked(ctx) >= 10,
        progress: ctx => `${Math.min(adventureTotalObjectsUnlocked(ctx), 10)}/10` },
      { id: "q-cartographe", icon: "🗺️", title: "Cartographe", desc: "Débloque toutes les îles de la carte.",
        check: ctx => ctx.islands.every(i => i.unlocked),
        progress: ctx => `${ctx.islands.filter(i => i.unlocked).length}/${ctx.islands.length}` },
      { id: "q-habituee", icon: "🔁", title: "Habituée des lieux", desc: `Fais le tour de ${ADVENTURE_ISLANDS[0].name} 5 fois.`,
        check: ctx => ctx.islands[0].laps >= 5,
        progress: ctx => `${Math.min(ctx.islands[0].laps, 5)}/5` },
      { id: "q-baroudeuse", icon: "🧭", title: "Baroudeuse", desc: "Termine un parcours sur au moins 3 îles différentes.",
        check: ctx => ctx.islands.filter(i => i.laps >= 1).length >= 3,
        progress: ctx => `${ctx.islands.filter(i => i.laps >= 1).length}/3` },
      { id: "q-legende", icon: "🐉", title: "Légende vivante", desc: "Débloque le trésor final de l'île la plus difficile.",
        check: ctx => { const last = ctx.islands[ctx.islands.length - 1]; return last.unlocked && last.objectsStatus[last.objectsStatus.length - 1].unlocked; },
        progress: ctx => { const last = ctx.islands[ctx.islands.length - 1]; return last.objectsStatus[last.objectsStatus.length - 1].unlocked ? "Fait ✅" : `${last.unlockedObjectsCount}/${last.totalObjects}`; } }
    ]
  }
];
function adventureTotalObjectsUnlocked(ctx) {
  return ctx.islands.reduce((t, i) => t + i.unlockedObjectsCount, 0);
}
function ensureActiveIsland(mapDef) {
  DATA.adventure = DATA.adventure || { activeIslandId: null, progressKm: {} };
  DATA.adventure.progressKm = DATA.adventure.progressKm || {};
  if (!DATA.adventure.activeIslandId) {
    setActiveIsland((mapDef || ADVENTURE_MAPS[0]).islands[0].id);
  }
}
function computeAdventureContext(mapDef) {
  ensureActiveIsland(mapDef);
  // La distance totale (toutes îles confondues) ne sert qu'à révéler progressivement les îles sur la carte.
  const lifetimeKm = DATA.activities.filter(a => RUNNING_COMBO_SPORTS.includes(a.sport)).reduce((t, a) => t + distanceKm(a), 0);
  const activeIslandId = DATA.adventure.activeIslandId;
  const islands = mapDef.islands.map((isl, i) => {
    const unlockAt = i === 0 ? 0 : mapDef.islands[i - 1].length;
    const unlocked = lifetimeKm >= unlockAt;
    // La progression sur LE parcours (tours, objets) ne bouge que quand cette île était l'île active au moment des sorties.
    const allocatedKm = (DATA.adventure.progressKm && DATA.adventure.progressKm[isl.id]) || 0;
    const laps = unlocked ? Math.floor(allocatedKm / isl.length) : 0;
    const posInLap = unlocked ? allocatedKm % isl.length : 0;
    const objectsStatus = isl.objects.map(o => ({ ...o, unlocked: unlocked && (laps >= 1 || posInLap >= o.at) }));
    const unlockedObjectsCount = objectsStatus.filter(o => o.unlocked).length;
    return Object.assign({}, isl, {
      unlockAt, unlocked, laps, posInLap, allocatedKm,
      isActive: isl.id === activeIslandId,
      percentInLap: unlocked ? Math.min(100, Math.round((posInLap / isl.length) * 100)) : 0,
      objectsStatus, unlockedObjectsCount, totalObjects: isl.objects.length
    });
  });
  return { lifetimeKm, activeIslandId, islands };
}
function snapshotAdventureState() {
  const ctx = computeAdventureContext(ADVENTURE_MAPS[0]);
  const unlockedIslandIds = ctx.islands.filter(i => i.unlocked).map(i => i.id);
  const unlockedObjectKeys = [];
  ctx.islands.forEach(i => i.objectsStatus.forEach(o => { if (o.unlocked) unlockedObjectKeys.push(i.id + "|" + o.at); }));
  const completedQuestIds = ADVENTURE_MAPS[0].quests.filter(q => q.check(ctx)).map(q => q.id);
  return { unlockedIslandIds, unlockedObjectKeys, completedQuestIds };
}
function detectAdventureNews(before) {
  const map = ADVENTURE_MAPS[0];
  const ctx = computeAdventureContext(map);
  const items = [];
  ctx.islands.forEach(isl => {
    if (isl.unlocked && !before.unlockedIslandIds.includes(isl.id)) {
      items.push({ icon: isl.icon, title: "Nouvelle île débloquée !", sub: isl.name });
    }
    isl.objectsStatus.forEach(o => {
      const key = isl.id + "|" + o.at;
      if (o.unlocked && !before.unlockedObjectKeys.includes(key)) {
        items.push({ icon: o.icon, title: "Objet découvert !", sub: `${o.name} · ${isl.name}` });
      }
    });
  });
  map.quests.forEach(q => {
    if (q.check(ctx) && !before.completedQuestIds.includes(q.id)) {
      items.push({ icon: q.icon, title: "Quête accomplie !", sub: q.title });
    }
  });
  return items;
}
function renderAventure() {
  const map = ADVENTURE_MAPS[0];
  const ctx = computeAdventureContext(map);
  if (!state.adventureIslandId || !ctx.islands.find(i => i.id === state.adventureIslandId)) {
    state.adventureIslandId = ctx.activeIslandId;
  }
  const selected = ctx.islands.find(i => i.id === state.adventureIslandId) || ctx.islands[0];
  const activeIsland = ctx.islands.find(i => i.id === ctx.activeIslandId);

  const islandChips = ctx.islands.map(i => `
    <div class="island-chip ${i.id === selected.id ? "active" : ""} ${i.unlocked ? "" : "locked"}" data-action="select-island" data-id="${i.id}">
      ${i.isActive ? `<div class="island-chip-pin">🎯</div>` : ""}
      <div class="island-chip-icon">${i.unlocked ? i.icon : "🔒"}</div>
      <div class="island-chip-name">${i.name}</div>
      <div class="island-chip-sub">${i.unlocked ? `Tour ${i.laps + 1}${i.laps > 0 ? ` · ${i.laps} fait${i.laps > 1 ? "s" : ""}` : ""}` : `${fmtKm(Math.max(0, i.unlockAt - ctx.lifetimeKm))} restants`}</div>
    </div>`).join("");

  const questsDone = map.quests.filter(q => q.check(ctx)).length;
  const questCards = map.quests.map(q => {
    const done = q.check(ctx);
    return `<div class="card quest-card ${done ? "done" : ""}">
      <div class="goal-head">
        <div class="name">${q.icon} ${q.title}</div>
        ${done ? `<span class="badge badge-green">✅ Fait</span>` : ""}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${q.desc}</div>
      ${!done ? `<div style="font-size:12px;font-weight:700;color:var(--orange-dark);margin-top:6px;">${q.progress(ctx)}</div>` : ""}
    </div>`;
  }).join("");

  return `
  <div class="card" style="text-align:center;">
    <div style="font-size:12px;color:var(--text-muted);">Distance cumulée (course + trail) — débloque de nouvelles îles</div>
    <div style="font-size:28px;font-weight:800;color:var(--orange);">${fmtKm(ctx.lifetimeKm)}</div>
  </div>
  <div class="card active-island-banner">
    <div style="font-size:12px;color:var(--text-muted);">🎯 Île active en ce moment</div>
    <div style="font-size:16px;font-weight:800;">${activeIsland ? `${activeIsland.icon} ${activeIsland.name}` : "—"}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Tes prochaines sorties course/trail feront avancer cette île.</div>
  </div>
  <div class="section-title">${map.name}</div>
  <div class="island-chip-row">${islandChips}</div>

  ${selected.unlocked ? renderIslandDetail(selected) : renderIslandLocked(selected, ctx.lifetimeKm)}

  <div class="section-title">🧭 Quêtes de la carte (${questsDone}/${map.quests.length})</div>
  ${questCards}
  `;
}
function renderIslandLocked(isl, lifetimeKm) {
  const remaining = Math.max(0, isl.unlockAt - lifetimeKm);
  return `<div class="card" style="text-align:center;padding:30px 16px;">
    <div style="font-size:40px;">🔒</div>
    <div style="font-weight:700;margin-top:8px;">${isl.name}</div>
    <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Se débloque à ${fmtKm(isl.unlockAt)} cumulés — encore ${fmtKm(remaining)} !</div>
  </div>`;
}
function renderIslandDetail(isl) {
  const nextObj = isl.objectsStatus.find(o => !o.unlocked);
  const objectsGrid = isl.objectsStatus.map(o => `
    <div class="island-object ${o.unlocked ? "unlocked" : ""}">
      <div class="ic">${o.unlocked ? o.icon : "❔"}</div>
      <div class="lbl">${o.unlocked ? o.name : "???"}</div>
    </div>`).join("");
  return `
  <div class="card">
    <div class="island-svg-wrap">
      <svg viewBox="0 0 320 180" class="island-svg" id="island-svg-${isl.id}">
        <defs>
          <linearGradient id="islgrad-${isl.id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${isl.colors[0]}"/>
            <stop offset="100%" stop-color="${isl.colors[1]}"/>
          </linearGradient>
        </defs>
        <ellipse cx="160" cy="110" rx="150" ry="60" fill="url(#islgrad-${isl.id})" opacity="0.25"/>
        <path id="island-path-${isl.id}" d="M25,140 C70,60 110,170 155,95 C200,20 250,150 295,110" fill="none" stroke="rgba(120,90,60,0.55)" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>
        <g id="island-objects-${isl.id}"></g>
        <text id="island-runner-${isl.id}" font-size="22">🏃</text>
      </svg>
    </div>
    <div class="stat-row"><div class="label">Tour en cours</div><div class="value">${fmtKm(isl.posInLap)} / ${fmtKm(isl.length)}</div></div>
    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${isl.percentInLap}%"></div></div>
    <div class="stat-row"><div class="label">Tours complétés</div><div class="value">${isl.laps}</div></div>
    ${nextObj ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">Prochain objet à découvrir dans ${fmtKm(Math.max(0, nextObj.at - isl.posInLap))}</div>` : `<div style="font-size:12px;color:var(--green);font-weight:700;margin-top:8px;">🎉 Tous les objets de cette île sont trouvés !</div>`}
    ${isl.isActive
      ? `<div class="card" style="background:var(--orange-light);border:none;margin-top:10px;padding:10px 12px;"><div style="font-size:12px;color:var(--orange-dark);font-weight:700;">🎯 C'est ton île active — tes sorties course/trail avancent ici.</div></div>`
      : `<button class="btn btn-outline btn-block" data-action="set-active-island" data-id="${isl.id}" style="margin-top:10px;">🎯 Choisir cette île comme île active</button>`}
  </div>
  <div class="island-objects-grid">${objectsGrid}</div>
  `;
}
function mountAdventureIslandPath() {
  const map = ADVENTURE_MAPS[0];
  const ctx = computeAdventureContext(map);
  const isl = ctx.islands.find(i => i.id === state.adventureIslandId);
  if (!isl || !isl.unlocked) return;
  const path = document.getElementById(`island-path-${isl.id}`);
  if (!path || !path.getTotalLength) return;
  const totalLength = path.getTotalLength();
  const objectsG = document.getElementById(`island-objects-${isl.id}`);
  if (objectsG) {
    objectsG.innerHTML = isl.objectsStatus.map(o => {
      const frac = Math.min(1, o.at / isl.length);
      const pt = path.getPointAtLength(frac * totalLength);
      const icon = o.unlocked ? o.icon : "🔒";
      const opacity = o.unlocked ? 1 : 0.55;
      return `<text x="${pt.x}" y="${pt.y}" font-size="20" text-anchor="middle" opacity="${opacity}">${icon}</text>`;
    }).join("");
  }
  const runner = document.getElementById(`island-runner-${isl.id}`);
  if (runner) {
    const runnerFrac = Math.min(1, isl.posInLap / isl.length);
    const pt = path.getPointAtLength(runnerFrac * totalLength);
    runner.setAttribute("x", pt.x - 11);
    runner.setAttribute("y", pt.y + 8);
  }
}

/* ================= ENTRAINEMENT (RENFO) ================= */
const SVG_OPEN = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%">`;
const EXERCISES = {
  "hip-thrust": {
    name: "Hip thrust", muscle: "Fessiers", sets: 4, reps: "10", restSec: 90, weighted: true,
    instructions: "Épaules calées sur un banc, barre ou haltère posé sur les hanches, pieds à plat au sol. Pousse les hanches vers le haut jusqu'à aligner épaules-hanches-genoux, serre les fessiers en haut, redescends sans reposer complètement.",
    svg: SVG_OPEN + `<line x1="5" y1="65" x2="35" y2="65"/><circle cx="24" cy="55" r="7"/><line x1="30" y1="63" x2="60" y2="50"/><line x1="60" y1="50" x2="80" y2="68"/><line x1="80" y1="68" x2="75" y2="95"/><line x1="30" y1="63" x2="15" y2="70"/><circle cx="60" cy="48" r="4"/></svg>`
  },
  "rdl": {
    name: "Soulevé de terre roumain", muscle: "Fessiers / Ischios", sets: 4, reps: "8", restSec: 90, weighted: true,
    instructions: "Haltères devant les cuisses, dos plat, bascule le buste vers l'avant en poussant les hanches vers l'arrière (genoux légèrement fléchis). Descends jusqu'à sentir l'étirement à l'arrière des cuisses, puis remonte en poussant les hanches vers l'avant.",
    svg: SVG_OPEN + `<circle cx="50" cy="20" r="7"/><line x1="50" y1="27" x2="62" y2="55"/><line x1="62" y1="55" x2="64" y2="80"/><line x1="64" y1="80" x2="62" y2="98"/><line x1="52" y1="30" x2="35" y2="60"/><circle cx="33" cy="63" r="4"/></svg>`
  },
  "bulgarian-split-squat": {
    name: "Fente bulgare", muscle: "Fessiers / Quadriceps", sets: 3, reps: "10 / jambe", restSec: 75, weighted: true,
    instructions: "Pied arrière posé sur un banc derrière toi, descends en pliant le genou avant jusqu'à 90°, sans que le genou dépasse trop la pointe du pied. Remonte en poussant sur le talon avant.",
    svg: SVG_OPEN + `<circle cx="35" cy="20" r="7"/><line x1="35" y1="27" x2="38" y2="55"/><line x1="38" y1="55" x2="55" y2="70"/><line x1="55" y1="70" x2="50" y2="95"/><line x1="38" y1="55" x2="20" y2="75"/><line x1="20" y1="75" x2="10" y2="60"/><line x1="0" y1="60" x2="18" y2="60"/></svg>`
  },
  "step-up": {
    name: "Step-up avec montée de genou", muscle: "Fessiers / Quadriceps", sets: 3, reps: "10 / jambe", restSec: 75, weighted: true,
    instructions: "Monte sur un banc/step avec une jambe en poussant sur le talon, monte l'autre genou haut devant toi en équilibre, puis redescends contrôlé.",
    svg: SVG_OPEN + `<line x1="30" y1="80" x2="75" y2="80"/><circle cx="50" cy="20" r="7"/><line x1="50" y1="27" x2="52" y2="55"/><line x1="52" y1="55" x2="65" y2="78"/><line x1="52" y1="55" x2="35" y2="60"/><line x1="35" y1="60" x2="30" y2="45"/></svg>`
  },
  "glute-bridge-1leg": {
    name: "Pont fessier unilatéral", muscle: "Fessiers", sets: 3, reps: "12 / jambe", restSec: 60, weighted: false,
    instructions: "Allongée sur le dos, un pied au sol genou plié, l'autre jambe tendue en l'air. Pousse les hanches vers le haut en serrant le fessier du côté au sol, redescends sans reposer.",
    svg: SVG_OPEN + `<circle cx="12" cy="73" r="6"/><line x1="18" y1="75" x2="55" y2="60"/><line x1="55" y1="60" x2="70" y2="75"/><line x1="70" y1="75" x2="65" y2="92"/><line x1="55" y1="60" x2="88" y2="52"/></svg>`
  },
  "kickback": {
    name: "Kickback (extension de hanche)", muscle: "Fessiers", sets: 3, reps: "12 / jambe", restSec: 60, weighted: false,
    instructions: "À quatre pattes (ou à la poulie/élastique), pousse une jambe vers l'arrière et le haut en gardant le genou plié à 90°, en serrant le fessier en fin de mouvement. Redescends contrôlé.",
    svg: SVG_OPEN + `<circle cx="15" cy="40" r="6"/><line x1="20" y1="46" x2="55" y2="50"/><line x1="20" y1="46" x2="18" y2="80"/><line x1="55" y1="50" x2="58" y2="82"/><line x1="55" y1="50" x2="85" y2="35"/></svg>`
  },
  "db-row": {
    name: "Rowing haltère", muscle: "Dos", sets: 4, reps: "10", restSec: 75, weighted: true,
    instructions: "Buste penché en avant, dos plat, tire l'haltère vers la hanche en amenant le coude vers l'arrière, serre l'omoplate, redescends contrôlé.",
    svg: SVG_OPEN + `<circle cx="30" cy="20" r="7"/><line x1="30" y1="27" x2="45" y2="55"/><line x1="45" y1="55" x2="48" y2="95"/><line x1="32" y1="30" x2="45" y2="50"/><circle cx="46" cy="50" r="4"/><line x1="32" y1="30" x2="20" y2="60"/></svg>`
  },
  "lat-pulldown": {
    name: "Tirage vertical (ou traction assistée)", muscle: "Dos", sets: 3, reps: "8-10", restSec: 75, weighted: true,
    instructions: "Tire la barre (ou fais une traction assistée) vers le haut de la poitrine en ramenant les coudes vers le bas et l'arrière, remonte contrôlé sans à-coup.",
    svg: SVG_OPEN + `<line x1="20" y1="10" x2="80" y2="10"/><circle cx="50" cy="15" r="7"/><line x1="50" y1="22" x2="50" y2="55"/><line x1="45" y1="25" x2="25" y2="12"/><line x1="55" y1="25" x2="75" y2="12"/><line x1="50" y1="55" x2="50" y2="95"/></svg>`
  },
  "shoulder-press": {
    name: "Développé épaules", muscle: "Épaules", sets: 3, reps: "10", restSec: 75, weighted: true,
    instructions: "Haltères au niveau des épaules, pousse vers le haut jusqu'à extension complète des bras sans casser le dos, redescends contrôlé.",
    svg: SVG_OPEN + `<circle cx="50" cy="25" r="7"/><line x1="50" y1="32" x2="50" y2="65"/><line x1="45" y1="35" x2="35" y2="10"/><circle cx="35" cy="10" r="4"/><line x1="55" y1="35" x2="65" y2="10"/><circle cx="65" cy="10" r="4"/><line x1="50" y1="65" x2="50" y2="95"/></svg>`
  },
  "pushup": {
    name: "Pompes", muscle: "Pectoraux / Triceps", sets: 3, reps: "10-12", restSec: 60, weighted: false,
    instructions: "En planche, mains sous les épaules, descends la poitrine vers le sol en gardant le corps aligné, repousse jusqu'à extension des bras. Sur les genoux si besoin.",
    svg: SVG_OPEN + `<circle cx="15" cy="55" r="6"/><line x1="20" y1="52" x2="70" y2="58"/><line x1="22" y1="53" x2="28" y2="78"/><line x1="70" y1="58" x2="90" y2="60"/></svg>`
  },
  "bicep-curl": {
    name: "Curl biceps", muscle: "Biceps", sets: 3, reps: "12", restSec: 60, weighted: true,
    instructions: "Haltères le long du corps, plie les coudes pour amener les haltères vers les épaules sans bouger les coudes, redescends contrôlé.",
    svg: SVG_OPEN + `<circle cx="50" cy="20" r="7"/><line x1="50" y1="27" x2="50" y2="60"/><line x1="45" y1="32" x2="42" y2="55"/><line x1="42" y1="55" x2="50" y2="38"/><circle cx="50" cy="36" r="4"/><line x1="55" y1="32" x2="58" y2="60"/><line x1="50" y1="60" x2="50" y2="95"/></svg>`
  },
  "triceps-extension": {
    name: "Extension triceps", muscle: "Triceps", sets: 3, reps: "12", restSec: 60, weighted: true,
    instructions: "Haltère tenu à deux mains derrière la tête, coudes pointés vers le haut, tends les bras vers le plafond puis redescends contrôlé.",
    svg: SVG_OPEN + `<circle cx="50" cy="20" r="7"/><line x1="50" y1="27" x2="50" y2="60"/><line x1="55" y1="30" x2="68" y2="18"/><line x1="68" y1="18" x2="60" y2="40"/><circle cx="60" cy="40" r="4"/><line x1="50" y1="60" x2="50" y2="95"/></svg>`
  },
  "face-pull": {
    name: "Face pull", muscle: "Épaules / Dos", sets: 3, reps: "15", restSec: 60, weighted: false,
    instructions: "Élastique ou poulie à hauteur de visage, tire vers le visage en écartant les coudes vers l'extérieur et l'arrière, serre les omoplates.",
    svg: SVG_OPEN + `<circle cx="50" cy="20" r="7"/><line x1="50" y1="27" x2="50" y2="60"/><line x1="43" y1="30" x2="25" y2="25"/><line x1="57" y1="30" x2="75" y2="25"/><line x1="25" y1="25" x2="75" y2="25"/><line x1="50" y1="60" x2="50" y2="95"/></svg>`
  },
  "plank": {
    name: "Planche", muscle: "Gainage", sets: 3, reps: "30-45 sec", restSec: 45, weighted: false,
    instructions: "Appui sur les avant-bras et les pointes de pieds, corps aligné de la tête aux talons, gaine le ventre et les fessiers sans creuser le dos.",
    svg: SVG_OPEN + `<circle cx="15" cy="45" r="6"/><line x1="20" y1="42" x2="80" y2="50"/><line x1="21" y1="43" x2="21" y2="68"/><line x1="80" y1="50" x2="95" y2="55"/></svg>`
  },
  "side-plank": {
    name: "Planche latérale", muscle: "Gainage / Obliques", sets: 3, reps: "20-30 sec / côté", restSec: 45, weighted: false,
    instructions: "Appui sur un avant-bras, corps de profil aligné, hanches levées, l'autre bras vers le plafond. Garde le bassin haut sans s'affaisser.",
    svg: SVG_OPEN + `<circle cx="20" cy="30" r="6"/><line x1="25" y1="32" x2="75" y2="45"/><line x1="26" y1="33" x2="26" y2="60"/><line x1="75" y1="45" x2="90" y2="50"/><line x1="26" y1="32" x2="15" y2="15"/></svg>`
  },
  "dead-bug": {
    name: "Dead bug", muscle: "Gainage profond", sets: 3, reps: "10 / côté", restSec: 45, weighted: false,
    instructions: "Allongée sur le dos, bras tendus vers le plafond, genoux pliés à 90°. Descends un bras et la jambe opposée vers le sol sans décoller le bas du dos, reviens et alterne.",
    svg: SVG_OPEN + `<circle cx="20" cy="20" r="6"/><line x1="25" y1="22" x2="55" y2="25"/><line x1="27" y1="21" x2="12" y2="8"/><line x1="55" y1="25" x2="85" y2="15"/><line x1="52" y1="26" x2="58" y2="45"/><line x1="58" y1="45" x2="45" y2="48"/></svg>`
  },
  "mountain-climbers": {
    name: "Mountain climbers", muscle: "Gainage / Cardio", sets: 3, reps: "20", restSec: 45, weighted: false,
    instructions: "En planche haute, ramène rapidement un genou puis l'autre vers la poitrine, en gardant le bassin stable.",
    svg: SVG_OPEN + `<circle cx="15" cy="45" r="6"/><line x1="20" y1="42" x2="75" y2="50"/><line x1="21" y1="43" x2="21" y2="68"/><line x1="75" y1="50" x2="95" y2="53"/><line x1="75" y1="50" x2="58" y2="65"/><line x1="58" y1="65" x2="62" y2="80"/></svg>`
  },
  "leg-raises": {
    name: "Relevés de jambes", muscle: "Abdos (bas du ventre)", sets: 3, reps: "12", restSec: 45, weighted: false,
    instructions: "Allongée sur le dos, jambes tendues, remonte-les à la verticale sans décoller le bas du dos du sol, redescends contrôlé sans les reposer complètement.",
    svg: SVG_OPEN + `<circle cx="20" cy="80" r="6"/><line x1="25" y1="79" x2="55" y2="78"/><line x1="55" y1="78" x2="60" y2="25"/></svg>`
  }
};
const WORKOUT_PROGRAMS = [
  { id: "fessier", name: "Fessier / Bas du corps", icon: "🍑", exerciseIds: ["hip-thrust", "rdl", "bulgarian-split-squat", "step-up", "glute-bridge-1leg", "kickback"] },
  { id: "hautducorps", name: "Haut du corps complet", icon: "💪", exerciseIds: ["db-row", "lat-pulldown", "shoulder-press", "pushup", "bicep-curl", "triceps-extension", "face-pull"] },
  { id: "abdos", name: "Abdos express (15 min)", icon: "🔥", exerciseIds: ["plank", "side-plank", "dead-bug", "mountain-climbers", "leg-raises"] }
];
function getProgram(id) { return WORKOUT_PROGRAMS.find(p => p.id === id); }
function feelingLabel(f) { return f === "hard" ? "😓 trop dur" : f === "easy" ? "😴 trop facile" : f === "ok" ? "👍 parfait" : ""; }
function lastExerciseLog(programId, exerciseId) {
  const logs = getWorkoutLogs({ programId });
  for (const log of logs) {
    const entry = (log.exercises || []).find(e => e.exerciseId === exerciseId);
    if (entry && (entry.weight != null || entry.feeling)) return { date: log.date, weight: entry.weight, feeling: entry.feeling };
  }
  return null;
}

function renderEntrainement() {
  if (state.entrainementView === "detail" && state.entrainementProgramId) return renderProgramDetail(state.entrainementProgramId);
  return renderProgramList();
}
function renderProgramList() {
  const totalLogs = getWorkoutLogs().length;
  return `
  <div class="card">
    <div class="stat-row"><div class="label">🏋️ Séances de renfo enregistrées</div><div class="value">${totalLogs}</div></div>
  </div>
  ${WORKOUT_PROGRAMS.map(programCard).join("")}
  `;
}
function programCard(p) {
  const last = lastWorkoutLogForProgram(p.id);
  return `<div class="card">
    <div class="goal-head">
      <div class="name">${p.icon} ${p.name}</div>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${p.exerciseIds.length} exercices ${last ? `· dernière séance : ${fmtDateShort(last.date)}` : "· pas encore faite"}</div>
    <button class="btn btn-outline btn-block" data-action="view-program" data-id="${p.id}">Voir les exercices</button>
    <button class="btn btn-primary btn-block" data-action="start-workout" data-id="${p.id}" style="margin-top:8px;">🚀 Lancer l'entraînement</button>
  </div>`;
}
function renderProgramDetail(programId) {
  const p = getProgram(programId);
  if (!p) return renderProgramList();
  return `
  <div style="margin-bottom:10px;"><span class="link" data-action="back-to-programs">← Retour</span></div>
  <div class="section-title">${p.icon} ${p.name}</div>
  ${p.exerciseIds.map(exId => exerciseCard(exId, p.id)).join("")}
  <button class="btn btn-primary btn-block" data-action="start-workout" data-id="${p.id}" style="margin-top:10px;">🚀 Lancer l'entraînement</button>
  `;
}
function exerciseCard(exId, programId) {
  const ex = EXERCISES[exId];
  const last = ex.weighted && programId ? lastExerciseLog(programId, exId) : null;
  return `<div class="card" style="display:flex;gap:12px;align-items:flex-start;">
    <div style="width:56px;height:56px;flex:0 0 auto;color:var(--orange);">${ex.svg}</div>
    <div>
      <div style="font-weight:700;">${ex.name}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${ex.muscle} · ${ex.sets} x ${ex.reps} · repos ${ex.restSec}s</div>
      <div style="font-size:12px;">${ex.instructions}</div>
      ${last ? `<div style="font-size:11px;color:var(--orange-dark);margin-top:6px;">Dernière fois (${fmtDateShort(last.date)}) : ${last.weight != null ? last.weight + " kg · " : ""}${feelingLabel(last.feeling)}</div>` : ""}
    </div>
  </div>`;
}

/* ---- Lecteur d'entraînement (mode "Lancer") ---- */
let workoutSession = null;
function startWorkout(programId) {
  const p = getProgram(programId);
  if (!p) return;
  if (workoutSession && workoutSession.restTimer) clearInterval(workoutSession.restTimer);
  workoutSession = { programId, exIndex: 0, setsDone: 0, finished: false, resting: false, restRemaining: 0, restTimer: null, log: [], currentWeight: "", currentFeeling: null };
  primeWeightFeelingForCurrentExercise();
  renderWorkoutPlayerModal();
}
function currentSessionExercise() {
  const p = getProgram(workoutSession.programId);
  const exId = p.exerciseIds[workoutSession.exIndex];
  return EXERCISES[exId] ? { id: exId, ...EXERCISES[exId] } : null;
}
function primeWeightFeelingForCurrentExercise() {
  const ex = currentSessionExercise();
  const last = ex.weighted ? lastExerciseLog(workoutSession.programId, ex.id) : null;
  workoutSession.currentWeight = last && last.weight != null ? last.weight : "";
  workoutSession.currentFeeling = null;
}
function renderWorkoutPlayerModal() {
  if (!workoutSession) return;
  const p = getProgram(workoutSession.programId);
  if (workoutSession.finished) {
    mountModal(`
    <div class="modal-overlay">
      <div class="modal-sheet" style="text-align:center;">
        <div class="modal-handle"></div>
        <div style="font-size:50px;margin:20px 0;">🎉</div>
        <h2>Séance terminée !</h2>
        <p style="color:var(--text-muted);">${p.name} · ${p.exerciseIds.length} exercices</p>
        <button class="btn btn-primary btn-block" data-action="finish-workout">Enregistrer et fermer</button>
      </div>
    </div>`, { noOverlayClose: true });
    return;
  }
  const ex = currentSessionExercise();
  const totalEx = p.exerciseIds.length;
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet" style="text-align:center;">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>${p.icon} ${p.name}</h2>
        <button class="modal-close" data-action="quit-workout">✕</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Exercice ${workoutSession.exIndex + 1} / ${totalEx}</div>
      <div style="width:120px;height:120px;margin:0 auto;color:var(--orange);">${ex.svg}</div>
      <div style="font-size:20px;font-weight:800;margin-top:10px;">${ex.name}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">${ex.muscle}</div>
      ${workoutSession.resting ? `
        <div style="font-size:13px;color:var(--text-muted);">Repos</div>
        <div style="font-size:44px;font-weight:800;color:var(--orange);margin:6px 0;">${workoutSession.restRemaining}s</div>
        <button class="btn btn-outline btn-block" data-action="skip-rest">Passer le repos</button>
      ` : `
        <div style="font-size:16px;font-weight:700;margin-bottom:4px;">Série ${workoutSession.setsDone + 1} / ${ex.sets}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:16px;">${ex.reps}</div>
        <p style="font-size:12px;color:var(--text-muted);">${ex.instructions}</p>
        ${ex.weighted ? `
        ${(() => { const last = lastExerciseLog(workoutSession.programId, ex.id); return last ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Dernière fois (${fmtDateShort(last.date)}) : ${last.weight != null ? last.weight + " kg · " : ""}${feelingLabel(last.feeling)}</div>` : ""; })()}
        <div class="form-group" style="text-align:left;">
          <label>Poids utilisé (kg)</label>
          <input type="number" step="0.5" min="0" id="workoutWeightInput" value="${workoutSession.currentWeight}" placeholder="Ex : 12">
        </div>
        <div class="pill-select" style="justify-content:center;">
          <div class="pill ${workoutSession.currentFeeling === 'hard' ? 'active' : ''}" data-action="set-workout-feeling" data-value="hard">😓 Trop dur</div>
          <div class="pill ${workoutSession.currentFeeling === 'ok' ? 'active' : ''}" data-action="set-workout-feeling" data-value="ok">👍 Parfait</div>
          <div class="pill ${workoutSession.currentFeeling === 'easy' ? 'active' : ''}" data-action="set-workout-feeling" data-value="easy">😴 Trop facile</div>
        </div>
        ` : ""}
        <button class="btn btn-primary btn-block" data-action="complete-set" style="margin-top:10px;">✅ Série terminée</button>
      `}
    </div>
  </div>`;
  mountModal(html, { noOverlayClose: true });
}
function completeSet() {
  const ex = currentSessionExercise();
  workoutSession.setsDone++;
  if (workoutSession.setsDone >= ex.sets) {
    workoutSession.log.push({
      exerciseId: ex.id, setsDone: workoutSession.setsDone,
      weight: ex.weighted && workoutSession.currentWeight !== "" ? Number(workoutSession.currentWeight) : null,
      feeling: ex.weighted ? workoutSession.currentFeeling : null
    });
    const p = getProgram(workoutSession.programId);
    if (workoutSession.exIndex + 1 >= p.exerciseIds.length) {
      workoutSession.finished = true;
      renderWorkoutPlayerModal();
      return;
    }
    workoutSession.exIndex++;
    workoutSession.setsDone = 0;
    primeWeightFeelingForCurrentExercise();
    renderWorkoutPlayerModal();
  } else {
    startRest(ex.restSec);
  }
}
function startRest(seconds) {
  workoutSession.resting = true;
  workoutSession.restRemaining = seconds;
  renderWorkoutPlayerModal();
  clearInterval(workoutSession.restTimer);
  workoutSession.restTimer = setInterval(() => {
    workoutSession.restRemaining--;
    if (workoutSession.restRemaining <= 0) {
      clearInterval(workoutSession.restTimer);
      workoutSession.resting = false;
      playBeep();
      renderWorkoutPlayerModal();
    } else {
      renderWorkoutPlayerModal();
    }
  }, 1000);
}
function skipRest() {
  clearInterval(workoutSession.restTimer);
  workoutSession.resting = false;
  renderWorkoutPlayerModal();
}
function quitWorkout() {
  if (!confirm("Quitter l'entraînement en cours ? La progression de cette séance ne sera pas enregistrée.")) return;
  clearInterval(workoutSession.restTimer);
  workoutSession = null;
  closeModal();
}
function finishWorkoutSave() {
  const beforeBadges = snapshotBadgeState();
  addWorkoutLog({ programId: workoutSession.programId, date: todayISO(), exercises: workoutSession.log });
  workoutSession = null;
  closeModal();
  render();
  showToast("Séance enregistrée 💪");
  const newly = detectNewBadges(beforeBadges);
  if (newly.length) showBadgeUnlockPopup(newly);
}
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

/* ================= PROFIL ================= */
function renderProfil() {
  const shoes = DATA.shoes.filter(s => s.active !== false);
  const retiredShoes = DATA.shoes.filter(s => s.active === false);
  const badgeGroups = buildBadgeGroups();
  const badgeEarned = badgeGroups.reduce((t, g) => t + badgeGroupEarnedCount(g), 0);
  const badgeTotal = badgeGroups.reduce((t, g) => t + g.tiers.length, 0);

  const weightLogs = getWeightLogs();
  const lastWeight = weightLogs[0];

  return `
  <div class="section-title">Suivi corporel</div>
  <div class="card" data-action="open-body-tracking" style="cursor:pointer">
    <div class="stat-row"><div class="label">⚖️ Dernier poids</div><div class="value">${lastWeight ? `${fmtNum(lastWeight.weight, 1)} kg` : "Pas encore enregistré"}</div></div>
    <div style="text-align:center;margin-top:6px;"><span class="link">Voir le suivi →</span></div>
  </div>

  <div class="section-title">Badges</div>
  <div class="card" data-action="open-badges" style="cursor:pointer">
    <div class="stat-row"><div class="label">🏅 Badges débloqués</div><div class="value">${badgeEarned} / ${badgeTotal}</div></div>
    <div style="text-align:center;margin-top:6px;"><span class="link">Voir tous mes badges →</span></div>
  </div>

  <div class="section-title">Mes sports</div>
  <div class="card">
    ${SPORTS.map(s => `<div class="stat-row"><div class="label">${s.icon} ${s.name}</div><div class="value" style="font-weight:400;color:var(--text-muted);font-size:12px;">intégré</div></div>`).join("")}
    ${(DATA.customSports || []).map(s => `<div class="stat-row">
      <div class="label">${s.icon} ${s.name}</div>
      <div class="value"><button data-action="delete-custom-sport" data-id="${s.id}" style="border:none;background:none;color:var(--text-muted);font-size:16px;">🗑️</button></div>
    </div>`).join("")}
    <button class="btn btn-outline btn-block" data-action="add-sport">+ Ajouter un sport</button>
  </div>

  <div class="section-title">Mes chaussures de course</div>
  <div class="card">
    ${shoes.length ? shoes.map(shoeRow).join("") : `<div class="empty-state" style="padding:20px;">Aucune paire enregistrée.</div>`}
    <button class="btn btn-outline btn-block" data-action="add-shoe">+ Ajouter une paire</button>
    ${retiredShoes.length ? `<div style="margin-top:10px;font-size:12px;color:var(--text-muted)">${retiredShoes.length} paire(s) retirée(s)</div>` : ""}
  </div>

  <div class="section-title">Mes données</div>
  <div class="card">
    <p style="font-size:13px;color:var(--text-muted);margin-top:0">Tes données sont stockées uniquement sur cet appareil. Pense à exporter régulièrement une sauvegarde !</p>
    <button class="btn btn-secondary btn-block" data-action="export-json">⬇️ Exporter (JSON — sauvegarde complète)</button>
    <button class="btn btn-secondary btn-block" data-action="export-csv">⬇️ Exporter (CSV — pour tableur)</button>
    <label class="btn btn-outline btn-block" style="cursor:pointer;">
      ⬆️ Importer une sauvegarde JSON
      <input type="file" id="importFile" accept="application/json" style="display:none">
    </label>
    <button class="btn btn-danger btn-block" data-action="reset-data">Réinitialiser toutes les données</button>
  </div>

  <div class="section-title">Installer sur l'écran d'accueil (iPhone)</div>
  <div class="card">
    <p style="font-size:13px;line-height:1.5;margin:0">
      1. Ouvre cette page dans <b>Safari</b><br>
      2. Appuie sur l'icône <b>Partager</b> (le carré avec la flèche)<br>
      3. Choisis <b>« Sur l'écran d'accueil »</b><br>
      L'appli apparaîtra alors comme une vraie application, avec son icône, en plein écran.
    </p>
  </div>
  `;
}
function shoeRow(s) {
  const km = shoeTotalKm(s.id);
  const threshold = 600;
  const pct = Math.min(100, Math.round((km / threshold) * 100));
  return `<div class="shoe-item" style="flex-direction:column;align-items:stretch;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div><b>${s.name}</b></div>
      <div style="display:flex;gap:6px;align-items:center;">
        <span>${fmtNum(km,0)} km</span>
        <button data-action="delete-shoe" data-id="${s.id}" style="border:none;background:none;color:var(--text-muted);">🗑️</button>
      </div>
    </div>
    <div class="shoe-km-bar"><div class="fill ${pct>=90?'warn':''}" style="width:${pct}%"></div></div>
    ${pct>=90 ? `<div style="font-size:11px;color:var(--red);margin-top:4px;">⚠️ Cette paire approche ou dépasse ${threshold} km, pense à la remplacer !</div>` : ""}
  </div>`;
}

/* ================= SUIVI CORPOREL (poids / mesures / photos) ================= */
let pendingWeightPhotos = [];
let weightPhotoTargetLogId = null;
function openBodyTrackingModal() {
  const logs = getWeightLogs();
  const last = logs[0];
  const measurements = getMeasurements();

  const periodNote = last && last.duringPeriod
    ? `<div class="card" style="background:var(--orange-light);border:none;"><div style="font-size:12px;color:var(--orange-dark);">🩸 Ta dernière pesée a été faite pendant tes règles — le chiffre peut être temporairement plus élevé à cause de la rétention d'eau, ce n'est pas représentatif de ta tendance réelle. Pas de panique si ça n'a pas bougé (ou un peu monté) par rapport au mois dernier.</div></div>`
    : "";

  const rows = logs.map((log, i) => {
    const prev = logs[i + 1];
    const delta = prev ? Math.round((log.weight - prev.weight) * 10) / 10 : null;
    const eligibleForPhoto = delta != null && Math.abs(delta) >= 1 && (!log.photos || !log.photos.length);
    return `<div class="card" style="margin-bottom:8px;">
      <div class="stat-row" style="border:none;padding:4px 0;">
        <div class="label">${fmtDateShort(log.date)} ${log.duringPeriod ? "🩸" : ""}</div>
        <div class="value">${fmtNum(log.weight, 1)} kg ${delta != null ? `<span style="font-size:11px;font-weight:600;color:var(--text-muted)">(${delta >= 0 ? "+" : ""}${fmtNum(delta, 1)} kg)</span>` : ""}
          <button data-action="delete-weight-log" data-id="${log.id}" style="border:none;background:none;color:var(--text-muted);margin-left:4px;">🗑️</button>
        </div>
      </div>
      ${log.photos && log.photos.length ? `<div class="photo-gallery">${log.photos.map(src => `<div class="photo-thumb"><img src="${src}" data-action="view-photo" data-src="${src}"></div>`).join("")}</div>` : ""}
      ${eligibleForPhoto ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Écart de ${Math.abs(delta)} kg depuis la pesée précédente. <span class="link" data-action="trigger-weight-photo" data-id="${log.id}">📷 Ajouter une photo</span></div>` : ""}
    </div>`;
  }).join("");

  const measurementRows = measurements.map(m => `<div class="stat-row">
    <div class="label">${fmtDateShort(m.date)}</div>
    <div class="value" style="font-size:12px;font-weight:400;">${[
      m.waist ? `Taille ${m.waist}cm` : "", m.hips ? `Hanches ${m.hips}cm` : "",
      m.glutes ? `Fessier ${m.glutes}cm` : "", m.thighs ? `Cuisses ${m.thighs}cm` : ""
    ].filter(Boolean).join(" · ")} <button data-action="delete-measurement" data-id="${m.id}" style="border:none;background:none;color:var(--text-muted);">🗑️</button></div>
  </div>`).join("");

  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>⚖️ Suivi corporel</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      ${periodNote}
      <form id="form-weight">
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" name="date" value="${todayISO()}" required></div>
          <div class="form-group"><label>Poids (kg)</label><input type="number" step="0.1" min="0" name="weight" required placeholder="Ex : 68.5"></div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:8px 0;">
          <input type="checkbox" name="duringPeriod" style="width:auto;"> 🩸 Je suis pendant mes règles (rétention d'eau probable)
        </label>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer le poids</button>
      </form>
      ${logs.length >= 2 ? `<div class="section-title">Évolution</div><div class="card"><canvas id="chart-weight" height="140"></canvas></div>` : ""}
      <div class="section-title">Historique</div>
      ${rows || `<div class="empty-state" style="padding:20px;">Aucune pesée enregistrée pour l'instant.</div>`}
      <input type="file" id="weightPhotoInputHidden" accept="image/*" multiple style="display:none">

      <div class="section-title">Mesures (facultatif, sans rythme imposé)</div>
      <button class="btn btn-outline btn-block" data-action="add-measurement">+ Ajouter une mesure</button>
      ${measurements.length ? `<div class="card" style="margin-top:8px;">${measurementRows}</div>` : ""}
    </div>
  </div>`;
  mountModal(html);
  if (logs.length >= 2) mountWeightChart(logs);
}
function mountWeightChart(logs) {
  const canvas = document.getElementById("chart-weight");
  if (!canvas) return;
  const sorted = logs.slice().reverse();
  renderLineChart("chart-weight", sorted.map(l => fmtDateShort(l.date)), [
    { label: "Poids (kg)", data: sorted.map(l => l.weight), color: "#FC4C02" }
  ]);
}
function saveWeightForm(form) {
  const fd = new FormData(form);
  addWeightLog({ date: fd.get("date"), weight: Number(fd.get("weight")), duringPeriod: fd.get("duringPeriod") === "on", photos: [] });
  showToast("Poids enregistré ⚖️");
  render();
  openBodyTrackingModal();
}
function openMeasurementModal() {
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>Nouvelle mesure</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-measurement">
        <div class="form-group"><label>Date</label><input type="date" name="date" value="${todayISO()}" required></div>
        <div class="form-row">
          <div class="form-group"><label>Taille (cm)</label><input type="number" step="0.5" min="0" name="waist" placeholder="Ex : 74"></div>
          <div class="form-group"><label>Hanches (cm)</label><input type="number" step="0.5" min="0" name="hips" placeholder="Ex : 102"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Fessier (cm)</label><input type="number" step="0.5" min="0" name="glutes" placeholder="Ex : 106"></div>
          <div class="form-group"><label>Cuisses (cm)</label><input type="number" step="0.5" min="0" name="thighs" placeholder="Ex : 58"></div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </form>
    </div>
  </div>`;
  mountModal(html);
}
function saveMeasurementForm(form) {
  const fd = new FormData(form);
  addMeasurement({
    date: fd.get("date"),
    waist: fd.get("waist") ? Number(fd.get("waist")) : null,
    hips: fd.get("hips") ? Number(fd.get("hips")) : null,
    glutes: fd.get("glutes") ? Number(fd.get("glutes")) : null,
    thighs: fd.get("thighs") ? Number(fd.get("thighs")) : null
  });
  closeModal();
  openBodyTrackingModal();
  showToast("Mesure enregistrée 📏");
}

/* ================= CHARTS ================= */
function renderLineChart(canvasId, labels, series) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext("2d");
  charts[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: series.map(s => ({
        label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color + "33",
        fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2
      }))
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 6, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: { size: 10 } } }
      }
    }
  });
}
function renderBarChart(canvasId, labels, series) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext("2d");
  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: series.map(s => ({ label: s.label, data: s.data, backgroundColor: s.color, borderRadius: 4 })) },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { font: { size: 10 } } } }
    }
  });
}

/* ================= MODALS: ACTIVITY ================= */
function openActivityModal(existing) {
  const a = existing || { sport: state.statsSport || "course", date: todayISO(), duration: "", distance: "", elevation: "", notes: "", shoeId: "", feeling: "" };
  const totalSec = a.duration ? Math.round(a.duration * 60) : 0;
  const hDur = a.duration ? Math.floor(totalSec / 3600) : "";
  const mDur = a.duration ? Math.floor((totalSec % 3600) / 60) : "";
  const sDur = a.duration ? totalSec % 60 : "";
  const shoesOptions = DATA.shoes.filter(s => s.active !== false).map(s => `<option value="${s.id}" ${a.shoeId===s.id?"selected":""}>${s.name}</option>`).join("");

  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>${existing ? "Modifier l'activité" : "Nouvelle activité"}</h2>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <form id="form-activity" data-id="${existing ? existing.id : ""}">
        <div class="form-group">
          <label>Sport</label>
          <input type="hidden" id="pill-sport-value" name="sport" value="${a.sport}">
          <div class="pill-select">
            ${getAllSports().map(s => `<div class="pill ${s.id===a.sport?'active':''}" data-action="pill-choose" data-target="pill-sport-value" data-value="${s.id}">${s.icon} ${s.name}</div>`).join("")}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" name="date" value="${a.date}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Durée (h)</label><input type="number" min="0" name="durH" value="${hDur}" placeholder="0"></div>
          <div class="form-group"><label>Durée (min)</label><input type="number" min="0" max="59" name="durM" value="${mDur}" placeholder="30"></div>
          <div class="form-group"><label>Durée (s)</label><input type="number" min="0" max="59" name="durS" value="${sDur}" placeholder="0"></div>
        </div>
        <div class="form-row field-distance">
          <div class="form-group"><label id="distanceLabel">Distance (km)</label><input type="number" step="0.01" min="0" name="distance" value="${a.distance}" placeholder="0"></div>
        </div>
        <div class="form-row field-elevation">
          <div class="form-group"><label>Dénivelé + (m)</label><input type="number" min="0" name="elevation" value="${a.elevation}" placeholder="0"></div>
        </div>
        <div class="form-group field-shoe">
          <label>Chaussures</label>
          <select name="shoeId"><option value="">Aucune</option>${shoesOptions}</select>
        </div>
        <div class="form-group">
          <label>Ressenti</label>
          <input type="hidden" id="pill-feeling-value" name="feeling" value="${a.feeling}">
          <div class="pill-select">
            ${["😞","😕","😐","🙂","😄"].map(e => `<div class="pill ${a.feeling===e?'active':''}" data-action="pill-choose" data-target="pill-feeling-value" data-value="${e}">${e}</div>`).join("")}
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea name="notes" placeholder="Parcours, sensations...">${a.notes || ""}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block">${existing ? "Enregistrer" : "Ajouter l'activité"}</button>
        ${existing ? `<button type="button" class="btn btn-danger btn-block" data-action="delete-activity" data-id="${existing.id}">Supprimer cette activité</button>` : ""}
      </form>
    </div>
  </div>`;
  mountModal(html);
  updateActivityFormFields();
}
function updateActivityFormFields() {
  const form = document.getElementById("form-activity");
  if (!form) return;
  const sportId = document.getElementById("pill-sport-value").value;
  const sp = getSport(sportId);
  form.querySelector(".field-distance").style.display = sp.distance ? "" : "none";
  form.querySelector(".field-elevation").style.display = sp.elevation ? "" : "none";
  form.querySelector(".field-shoe").style.display = sp.trackShoes ? "" : "none";
  const label = document.getElementById("distanceLabel");
  if (label) label.textContent = sp.distanceUnit === "m" ? "Distance (m)" : "Distance (km)";
}
function saveActivityForm(form) {
  const fd = new FormData(form);
  const durH = Number(fd.get("durH")) || 0, durM = Number(fd.get("durM")) || 0, durS = Number(fd.get("durS")) || 0;
  const activity = {
    sport: fd.get("sport"),
    date: fd.get("date"),
    duration: durH * 60 + durM + durS / 60,
    distance: fd.get("distance") ? Number(fd.get("distance")) : null,
    elevation: fd.get("elevation") ? Number(fd.get("elevation")) : null,
    shoeId: fd.get("shoeId") || null,
    feeling: fd.get("feeling") || null,
    notes: fd.get("notes") || ""
  };
  const id = form.dataset.id;
  const beforeBadges = snapshotBadgeState();
  const beforeAdventure = snapshotAdventureState();
  if (id) {
    updateActivity(id, activity);
  } else {
    const saved = addActivity(activity);
    if (RUNNING_COMBO_SPORTS.includes(saved.sport) && distanceKm(saved) > 0) {
      ensureActiveIsland(ADVENTURE_MAPS[0]);
      addAdventureProgress(DATA.adventure.activeIslandId, distanceKm(saved));
    }
  }
  closeModal();
  render();
  showToast(id ? "Activité mise à jour" : "Activité ajoutée 💪");
  const items = badgeItemsFromNewly(detectNewBadges(beforeBadges)).concat(detectAdventureNews(beforeAdventure));
  if (items.length) showCelebrationPopup(items);
}
function openActivityDetail(id) {
  const a = DATA.activities.find(x => x.id === id);
  if (a) openActivityModal(a);
}

/* ================= MODALS: GOAL ================= */
function openGoalModal(id) {
  const g = id ? DATA.goals.find(x => x.id === id) : { sport: "", period: state.objTab, metric: "distance", target: "" };
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>${id ? "Modifier l'objectif" : "Nouvel objectif"}</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-goal" data-id="${id || ""}">
        <div class="form-group">
          <label>Période</label>
          <input type="hidden" id="pill-period-value" name="period" value="${g.period}">
          <div class="pill-select">
            <div class="pill ${g.period==='week'?'active':''}" data-action="pill-choose" data-target="pill-period-value" data-value="week">Semaine</div>
            <div class="pill ${g.period==='year'?'active':''}" data-action="pill-choose" data-target="pill-period-value" data-value="year">Année</div>
          </div>
        </div>
        <div class="form-group">
          <label>Sport</label>
          <input type="hidden" id="pill-goalsport-value" name="sport" value="${g.sport || ''}">
          <div class="pill-select">
            <div class="pill ${!g.sport?'active':''}" data-action="pill-choose" data-target="pill-goalsport-value" data-value="">Tous sports</div>
            <div class="pill ${g.sport===RUNNING_COMBO?'active':''}" data-action="pill-choose" data-target="pill-goalsport-value" data-value="${RUNNING_COMBO}">🏃 Running (CAP + Trail)</div>
            ${getAllSports().map(s => `<div class="pill ${g.sport===s.id?'active':''}" data-action="pill-choose" data-target="pill-goalsport-value" data-value="${s.id}">${s.icon} ${s.name}</div>`).join("")}
          </div>
        </div>
        <div class="form-group">
          <label>Type d'objectif</label>
          <input type="hidden" id="pill-metric-value" name="metric" value="${g.metric}">
          <div class="pill-select">
            <div class="pill field-metric-distance ${g.metric==='distance'?'active':''}" data-action="pill-choose" data-target="pill-metric-value" data-value="distance">Distance (km)</div>
            <div class="pill ${g.metric==='duration'?'active':''}" data-action="pill-choose" data-target="pill-metric-value" data-value="duration">Temps (h)</div>
            <div class="pill ${g.metric==='sessions'?'active':''}" data-action="pill-choose" data-target="pill-metric-value" data-value="sessions">Nombre de séances</div>
          </div>
        </div>
        <div class="form-group">
          <label>Objectif à atteindre</label>
          <input type="number" min="0" step="0.1" name="target" value="${g.target}" required placeholder="Ex : 20">
        </div>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </form>
    </div>
  </div>`;
  mountModal(html);
  updateGoalFormFields();
}
function updateGoalFormFields() {
  const form = document.getElementById("form-goal");
  if (!form) return;
  const sportVal = document.getElementById("pill-goalsport-value").value;
  const sp = sportVal && sportVal !== RUNNING_COMBO ? getSport(sportVal) : null;
  const distanceCapable = !sp || sp.distance !== false;
  const distancePill = form.querySelector(".field-metric-distance");
  if (distancePill) distancePill.style.display = distanceCapable ? "" : "none";
  if (!distanceCapable) {
    const metricHidden = document.getElementById("pill-metric-value");
    if (metricHidden.value === "distance") {
      metricHidden.value = "sessions";
      Array.from(distancePill.parentElement.children).forEach(p => p.classList.remove("active"));
      const sessionsPill = form.querySelector('.pill[data-target="pill-metric-value"][data-value="sessions"]');
      if (sessionsPill) sessionsPill.classList.add("active");
    }
  }
}
function saveGoalForm(form) {
  const fd = new FormData(form);
  const goal = { sport: fd.get("sport") || null, period: fd.get("period"), metric: fd.get("metric"), target: Number(fd.get("target")) };
  const id = form.dataset.id;
  if (id) updateGoal(id, goal); else addGoal(goal);
  closeModal(); render(); showToast("Objectif enregistré 🎯");
}

/* ================= MODALS: PAS QUOTIDIENS ================= */
function openStepGoalModal() {
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>🎯 Objectif de pas</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-step-goal">
        <div class="form-group"><label>Nouvel objectif (pas / jour)</label><input type="number" min="0" step="100" name="target" required placeholder="Ex : 10000"></div>
        <div class="form-group"><label>À partir de quelle date ?</label><input type="date" name="startDate" value="${todayISO()}" required></div>
        <p style="font-size:12px;color:var(--text-muted);margin-top:-4px;">Les jours précédant cette date resteront évalués avec l'ancien objectif — rien n'est recalculé rétroactivement. Tu peux aussi choisir une date passée si tu changes l'historique.</p>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </form>
    </div>
  </div>`;
  mountModal(html);
}
function saveStepGoalForm(form) {
  const fd = new FormData(form);
  addStepGoal(Number(fd.get("target")), fd.get("startDate"));
  closeModal(); render(); showToast("Objectif de pas enregistré 🎯");
}
function openStepsDayModal(date) {
  const d = date || todayISO();
  const existing = getStepsForDay(d);
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>👣 Pas du jour</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-steps-day">
        <div class="form-group"><label>Date</label><input type="date" name="date" value="${d}" required></div>
        <div class="form-group"><label>Nombre de pas</label><input type="number" min="0" name="count" value="${existing != null ? existing : ''}" required placeholder="Ex : 8500"></div>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
        ${existing != null ? `<button type="button" class="btn btn-danger btn-block" data-action="delete-steps-day" data-date="${d}">Supprimer cette entrée</button>` : ""}
      </form>
    </div>
  </div>`;
  mountModal(html);
}
function saveStepsDayForm(form) {
  const fd = new FormData(form);
  const beforeBadges = snapshotBadgeState();
  setStepsForDay(fd.get("date"), Number(fd.get("count")));
  closeModal(); render(); showToast("Pas enregistrés 👣");
  const newly = detectNewBadges(beforeBadges);
  if (newly.length) showBadgeUnlockPopup(newly);
}

/* ================= MODALS: SHOE ================= */
function openShoeModal(id) {
  const s = id ? DATA.shoes.find(x => x.id === id) : { name: "", initialKm: 0 };
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>${id ? "Modifier la paire" : "Nouvelle paire de chaussures"}</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-shoe" data-id="${id || ""}">
        <div class="form-group"><label>Nom du modèle</label><input type="text" name="name" value="${s.name}" required placeholder="Ex : Nike Pegasus 40"></div>
        <div class="form-group"><label>Km déjà parcourus avec cette paire (avant de commencer le suivi)</label><input type="number" min="0" name="initialKm" value="${s.initialKm||0}"></div>
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </form>
    </div>
  </div>`;
  mountModal(html);
}
function saveShoeForm(form) {
  const fd = new FormData(form);
  const shoe = { name: fd.get("name"), initialKm: Number(fd.get("initialKm")) || 0 };
  const id = form.dataset.id;
  if (id) updateShoe(id, shoe); else addShoe(shoe);
  closeModal(); render(); showToast("Paire enregistrée 👟");
}

/* ================= MODALS: COURSE (course/wishlist/challenge) ================= */
let pendingCoursePhotos = [];
let pendingJournalPhotos = [];

function compressImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function renderPhotoGalleryInner() {
  return pendingCoursePhotos.map((src, i) => `<div class="photo-thumb"><img src="${src}" data-action="view-photo" data-src="${src}"><button type="button" class="rm" data-action="remove-photo" data-index="${i}">✕</button></div>`).join("") +
    `<label class="photo-add-tile">📷<input type="file" id="coursePhotoInput" accept="image/*" multiple style="display:none"></label>`;
}
function refreshPhotoGallery() {
  const el = document.getElementById("photoGalleryContainer");
  if (el) el.innerHTML = renderPhotoGalleryInner();
}
function openPhotoLightbox(src) {
  const div = document.createElement("div");
  div.className = "photo-lightbox";
  div.innerHTML = `<img src="${src}">`;
  div.addEventListener("click", () => div.remove());
  document.body.appendChild(div);
}

function openCourseModal(existing, forcedStatus) {
  const c = existing || { name: "", sport: "course", status: forcedStatus || "wishlist", date: "", location: "", distanceLabel: "", resultTime: "", notes: "", photos: [], wantToRedo: false };
  pendingCoursePhotos = (c.photos || []).slice();
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>${existing ? "Modifier la course" : "Nouvelle course"}</h2>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <form id="form-course" data-id="${existing ? existing.id : ""}">
        <div class="form-group">
          <label>Statut</label>
          <input type="hidden" id="pill-coursestatus-value" name="status" value="${c.status}">
          <div class="pill-select">
            <div class="pill ${c.status==='wishlist'?'active':''}" data-action="pill-choose" data-target="pill-coursestatus-value" data-value="wishlist">💭 Wishlist</div>
            <div class="pill ${c.status==='planned'?'active':''}" data-action="pill-choose" data-target="pill-coursestatus-value" data-value="planned">📅 Planifiée</div>
            <div class="pill ${c.status==='done'?'active':''}" data-action="pill-choose" data-target="pill-coursestatus-value" data-value="done">✅ Terminée</div>
          </div>
        </div>
        <div class="form-group"><label>Nom de la course</label><input type="text" name="name" value="${c.name || ''}" required placeholder="Ex : Marathon de Paris"></div>
        <div class="form-group">
          <label>Sport</label>
          <input type="hidden" id="pill-coursesport-value" name="sport" value="${c.sport || 'course'}">
          <div class="pill-select">
            ${getAllSports().map(s => `<div class="pill ${c.sport===s.id?'active':''}" data-action="pill-choose" data-target="pill-coursesport-value" data-value="${s.id}">${s.icon} ${s.name}</div>`).join("")}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Lieu</label><input type="text" name="location" value="${c.location || ''}" placeholder="Ex : Paris, France"></div>
          <div class="form-group"><label>Distance / format</label><input type="text" name="distanceLabel" value="${c.distanceLabel || ''}" placeholder="Ex : 42,2 km"></div>
        </div>
        <div class="form-group field-course-date"><label>Date</label><input type="date" name="date" value="${c.date || ''}"></div>
        <div class="form-group field-course-result"><label>Temps réalisé</label><input type="text" name="resultTime" value="${c.resultTime || ''}" placeholder="Ex : 3:45:12"></div>
        <div class="form-group field-course-redo">
          <label>Envie de refaire cette course ?</label>
          <input type="hidden" id="pill-courseredo-value" name="wantToRedo" value="${c.wantToRedo ? '1' : '0'}">
          <div class="pill-select">
            <div class="pill ${!c.wantToRedo?'active':''}" data-action="pill-choose" data-target="pill-courseredo-value" data-value="0">Non</div>
            <div class="pill ${c.wantToRedo?'active':''}" data-action="pill-choose" data-target="pill-courseredo-value" data-value="1">🔁 Oui</div>
          </div>
        </div>
        <div class="form-group field-course-photos">
          <label>Photos</label>
          <div class="photo-gallery" id="photoGalleryContainer">${renderPhotoGalleryInner()}</div>
        </div>
        <div class="form-group"><label>Notes</label><textarea name="notes" placeholder="Ressenti, parcours...">${c.notes || ''}</textarea></div>
        <button type="submit" class="btn btn-primary btn-block">${existing ? 'Enregistrer' : 'Ajouter la course'}</button>
        ${existing ? `<button type="button" class="btn btn-danger btn-block" data-action="delete-course" data-id="${existing.id}">Supprimer cette course</button>` : ""}
      </form>
    </div>
  </div>`;
  mountModal(html);
  updateCourseFormFields();
}
function updateCourseFormFields() {
  const form = document.getElementById("form-course");
  if (!form) return;
  const status = document.getElementById("pill-coursestatus-value").value;
  form.querySelector(".field-course-date").style.display = (status === "wishlist") ? "none" : "";
  form.querySelector(".field-course-result").style.display = (status === "done") ? "" : "none";
  form.querySelector(".field-course-redo").style.display = (status === "done") ? "" : "none";
  form.querySelector(".field-course-photos").style.display = (status === "done") ? "" : "none";
}
function saveCourseForm(form) {
  const fd = new FormData(form);
  const course = {
    status: fd.get("status"),
    name: fd.get("name"),
    sport: fd.get("sport"),
    location: fd.get("location") || "",
    distanceLabel: fd.get("distanceLabel") || "",
    date: fd.get("date") || "",
    resultTime: fd.get("resultTime") || "",
    wantToRedo: fd.get("wantToRedo") === "1",
    notes: fd.get("notes") || "",
    photos: pendingCoursePhotos.slice()
  };
  const id = form.dataset.id;
  const beforeBadges = snapshotBadgeState();
  if (id) updateCourse(id, course); else addCourse(course);
  closeModal();
  render();
  showToast(id ? "Course mise à jour" : "Course ajoutée 🏁");
  const newly = detectNewBadges(beforeBadges);
  if (newly.length) showBadgeUnlockPopup(newly);
}

/* ================= MODALS: CHALLENGE ================= */
function openChallengeModal(existing) {
  const c = existing || { name: "", description: "" };
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>${existing ? "Modifier le challenge" : "Nouveau challenge"}</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-challenge" data-id="${existing ? existing.id : ''}">
        <div class="form-group"><label>Nom du challenge</label><input type="text" name="name" value="${c.name}" required placeholder="Ex : Superhalfs, Marathon par pays européen..."></div>
        <div class="form-group"><label>Description / règles</label><textarea name="description" placeholder="Ex : Courir un semi ET un marathon dans chaque pays d'Europe, dont un des deux dans la capitale">${c.description || ''}</textarea></div>
        <button type="submit" class="btn btn-primary btn-block">${existing ? 'Enregistrer' : 'Créer le challenge'}</button>
      </form>
    </div>
  </div>`;
  mountModal(html);
}
function saveChallengeForm(form) {
  const fd = new FormData(form);
  const data = { name: fd.get("name"), description: fd.get("description") || "" };
  const id = form.dataset.id;
  if (id) {
    updateChallenge(id, data);
    closeModal(); render(); showToast("Challenge mis à jour");
  } else {
    const ch = addChallenge(Object.assign({ items: [] }, data));
    render();
    openChallengeDetailModal(ch.id);
  }
}
function renderChallengeItemsInner(ch) {
  if (!ch.items.length) return `<div class="empty-state" style="padding:16px 0;">Aucun élément pour l'instant — ajoute ta liste ci-dessous.</div>`;
  return ch.items.map(i => `<div class="challenge-item-row">
    <div class="check ${i.done ? 'done' : ''}" data-action="toggle-challenge-item" data-challenge-id="${ch.id}" data-item-id="${i.id}">✓</div>
    <div class="lbl ${i.done ? 'done' : ''}">${i.label}</div>
    <button class="del" type="button" data-action="delete-challenge-item" data-challenge-id="${ch.id}" data-item-id="${i.id}">🗑️</button>
  </div>`).join("");
}
function openChallengeDetailModal(challengeId) {
  const ch = DATA.challenges.find(c => c.id === challengeId);
  if (!ch) return;
  const done = ch.items.filter(i => i.done).length;
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>🏆 ${ch.name}</h2>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div class="challenge-progress-label" style="margin:0;">${done} / ${ch.items.length} réalisés</div>
        <button data-action="edit-challenge" data-id="${ch.id}" style="border:none;background:none;color:var(--text-muted);font-size:16px;">✏️</button>
      </div>
      ${ch.description ? `<p style="font-size:13px;color:var(--text-muted);margin:4px 0 12px;">${ch.description}</p>` : ""}
      <div id="challengeItemsList">${renderChallengeItemsInner(ch)}</div>
      <form id="form-challenge-additem" data-challenge-id="${ch.id}" style="margin-top:14px;">
        <div class="form-group"><input type="text" name="label" placeholder="Ajouter un élément (ex : Semi de Berlin)"></div>
        <button type="submit" class="btn btn-secondary btn-block">+ Ajouter</button>
      </form>
      <details style="margin-top:12px;">
        <summary style="cursor:pointer;font-size:13px;color:var(--text-muted);">Ajouter plusieurs éléments à la fois</summary>
        <form id="form-challenge-bulkadd" data-challenge-id="${ch.id}" style="margin-top:10px;">
          <div class="form-group"><textarea name="bulk" placeholder="Un élément par ligne, ex :&#10;France - semi ou marathon à Paris&#10;Allemagne - semi ou marathon à Berlin&#10;..."></textarea></div>
          <button type="submit" class="btn btn-secondary btn-block">Ajouter la liste</button>
        </form>
      </details>
      <button class="btn btn-danger btn-block" data-action="delete-challenge" data-id="${ch.id}" style="margin-top:14px;">Supprimer ce challenge</button>
    </div>
  </div>`;
  mountModal(html);
}

/* ================= MODALS: SPORT PERSONNALISÉ ================= */
const SPORT_ICON_CHOICES = ["🔥","⚡","🥊","🤸","🧗","🏂","🏄","⛷️","🛶","🚣","🏸","🎾","⚽","🏀","🥋","🧘","🚶","🛹","🤾","🏹","🤺","🏇","🏓","🥏"];
function openSportModal() {
  const html = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header"><h2>Nouveau sport</h2><button class="modal-close" data-action="close-modal">✕</button></div>
      <form id="form-sport">
        <div class="form-group"><label>Nom du sport</label><input type="text" name="name" required placeholder="Ex : Escalade"></div>
        <div class="form-group">
          <label>Icône</label>
          <input type="hidden" id="pill-sporticon-value" name="icon" value="${SPORT_ICON_CHOICES[0]}">
          <div class="pill-select">
            ${SPORT_ICON_CHOICES.map((e,i) => `<div class="pill ${i===0?'active':''}" data-action="pill-choose" data-target="pill-sporticon-value" data-value="${e}" style="font-size:18px;padding:8px 12px;">${e}</div>`).join("")}
          </div>
        </div>
        <div class="form-group">
          <label>Suivre une distance ?</label>
          <input type="hidden" id="pill-sportdist-value" name="distance" value="0">
          <div class="pill-select">
            <div class="pill active" data-action="pill-choose" data-target="pill-sportdist-value" data-value="0">Non</div>
            <div class="pill" data-action="pill-choose" data-target="pill-sportdist-value" data-value="1">Oui</div>
          </div>
        </div>
        <div class="form-group">
          <label>Suivre un dénivelé ?</label>
          <input type="hidden" id="pill-sportelev-value" name="elevation" value="0">
          <div class="pill-select">
            <div class="pill active" data-action="pill-choose" data-target="pill-sportelev-value" data-value="0">Non</div>
            <div class="pill" data-action="pill-choose" data-target="pill-sportelev-value" data-value="1">Oui</div>
          </div>
        </div>
        <div class="form-group">
          <label>Type d'allure à calculer</label>
          <input type="hidden" id="pill-sportpace-value" name="pace" value="">
          <div class="pill-select">
            <div class="pill active" data-action="pill-choose" data-target="pill-sportpace-value" data-value="">Aucune</div>
            <div class="pill" data-action="pill-choose" data-target="pill-sportpace-value" data-value="km">Allure /km</div>
            <div class="pill" data-action="pill-choose" data-target="pill-sportpace-value" data-value="speed">Vitesse km/h</div>
            <div class="pill" data-action="pill-choose" data-target="pill-sportpace-value" data-value="100m">Allure /100m</div>
          </div>
        </div>
        <div class="form-group">
          <label>Suivre l'usure de chaussures ?</label>
          <input type="hidden" id="pill-sportshoes-value" name="trackShoes" value="0">
          <div class="pill-select">
            <div class="pill active" data-action="pill-choose" data-target="pill-sportshoes-value" data-value="0">Non</div>
            <div class="pill" data-action="pill-choose" data-target="pill-sportshoes-value" data-value="1">Oui</div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Ajouter ce sport</button>
      </form>
    </div>
  </div>`;
  mountModal(html);
}
function saveSportForm(form) {
  const fd = new FormData(form);
  addCustomSport({
    name: fd.get("name"),
    icon: fd.get("icon"),
    distance: fd.get("distance") === "1",
    elevation: fd.get("elevation") === "1",
    pace: fd.get("pace") || null,
    trackShoes: fd.get("trackShoes") === "1"
  });
  closeModal(); render(); showToast("Sport ajouté ! Il apparaît maintenant partout dans l'appli 🎉");
}

/* ================= EXPORT / IMPORT / RESET ================= */
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function doExportJSON() { downloadFile(`suivi-sport-${todayISO()}.json`, exportJSON(), "application/json"); showToast("Export JSON téléchargé"); }
function doExportCSV() { downloadFile(`suivi-sport-${todayISO()}.csv`, exportCSV(), "text/csv"); showToast("Export CSV téléchargé"); }
function doResetData() {
  if (confirm("Cette action supprimera définitivement toutes tes activités, objectifs et réglages. Continuer ?")) {
    if (confirm("Es-tu vraiment sûre ? Pense à exporter une sauvegarde avant !")) {
      localStorage.removeItem(DB_KEY);
      DATA = loadData();
      render();
      showToast("Données réinitialisées");
    }
  }
}

/* ================= MODAL / MISC HELPERS ================= */
function mountModal(html, opts) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = html;
  const overlay = root.querySelector(".modal-overlay");
  if (overlay && !(opts && opts.noOverlayClose)) {
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  }
}
function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ================= GLOBAL EVENT DELEGATION ================= */
function handleGlobalClick(e) {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const action = t.dataset.action;
  const id = t.dataset.id;
  switch (action) {
    case "add-activity": openActivityModal(); break;
    case "open-activity": openActivityDetail(id); break;
    case "delete-activity": if (confirm("Supprimer cette activité ?")) { deleteActivity(id); closeModal(); render(); showToast("Activité supprimée"); } break;
    case "select-sport": state.statsSport = t.dataset.sport; state.statsRangeAll = false; render(); break;
    case "toggle-range": state.statsRangeAll = !state.statsRangeAll; render(); break;
    case "open-calendar": openCalendarModal(); break;
    case "close-modal": closeModal(); break;
    case "cal-prev": state.calendarMonth = addMonths(state.calendarMonth, -1); renderCalendarModal(); break;
    case "cal-next": state.calendarMonth = addMonths(state.calendarMonth, 1); renderCalendarModal(); break;
    case "bilan-tab": state.bilanTab = t.dataset.tab; render(); break;
    case "bilan-prev-month": shiftBilanMonth(-1); break;
    case "bilan-next-month": shiftBilanMonth(1); break;
    case "bilan-prev-year": state.bilanYear--; render(); break;
    case "bilan-next-year": state.bilanYear++; render(); break;
    case "open-monthly-recap": openMonthlyRecapStory(Number(t.dataset.year), Number(t.dataset.month)); break;
    case "recap-close": closeRecapStory(); break;
    case "recap-prev": recapPrev(); break;
    case "recap-next": recapNext(); break;
    case "recap-download": recapDownload(); break;
    case "obj-tab": state.objTab = t.dataset.tab; render(); break;
    case "add-goal": openGoalModal(); break;
    case "add-step-goal": openStepGoalModal(); break;
    case "add-steps-day": openStepsDayModal(); break;
    case "edit-steps-day": openStepsDayModal(t.dataset.date); break;
    case "delete-steps-day": if (confirm("Supprimer cette entrée de pas ?")) { deleteStepsForDay(t.dataset.date); closeModal(); render(); showToast("Entrée supprimée"); } break;
    case "delete-step-goal": if (confirm("Supprimer ce changement d'objectif ?")) { deleteStepGoal(id); render(); } break;
    case "edit-goal": openGoalModal(id); break;
    case "delete-goal": if (confirm("Supprimer cet objectif ?")) { deleteGoal(id); render(); } break;
    case "add-shoe": openShoeModal(); break;
    case "edit-shoe": openShoeModal(id); break;
    case "delete-shoe": if (confirm("Supprimer cette paire ?")) { deleteShoe(id); render(); } break;
    case "courses-tab": state.coursesTab = t.dataset.tab; render(); break;
    case "add-course": openCourseModal(null, "planned"); break;
    case "add-wish": openCourseModal(null, "wishlist"); break;
    case "edit-course": { const c = DATA.courses.find(x => x.id === id); if (c) openCourseModal(c); break; }
    case "mark-done": { const c = DATA.courses.find(x => x.id === id); if (c) openCourseModal(Object.assign({}, c, { status: "done", date: c.date || todayISO() })); break; }
    case "plan-course": { const c = DATA.courses.find(x => x.id === id); if (c) openCourseModal(Object.assign({}, c, { status: "planned" })); break; }
    case "toggle-redo": { const c = DATA.courses.find(x => x.id === id); if (c) { updateCourse(id, { wantToRedo: !c.wantToRedo }); render(); } break; }
    case "delete-course": if (confirm("Supprimer cette course ?")) { deleteCourse(id); closeModal(); render(); showToast("Course supprimée"); } break;
    case "view-photo": openPhotoLightbox(t.dataset.src); break;
    case "remove-photo": pendingCoursePhotos.splice(Number(t.dataset.index), 1); refreshPhotoGallery(); break;
    case "add-roadmap": openRoadmapModal(); break;
    case "edit-roadmap": { const r = getRoadmap(id); if (r) openRoadmapModal(r); break; }
    case "delete-roadmap": if (confirm("Supprimer ce « Road to... » et tout son journal de bord ?")) { deleteRoadmap(id); if (state.roadmapDetailId === id) state.roadmapDetailId = null; closeModal(); render(); showToast("Objectif supprimé"); } break;
    case "open-roadmap": openRoadmapDetailModal(id); break;
    case "toggle-roadmap-dossard": { const r = getRoadmap(id); if (r) { updateRoadmap(id, { dossard: !r.dossard }); render(); if (state.roadmapDetailId === id) openRoadmapDetailModal(id); } break; }
    case "add-roadmap-step": openRoadmapStepModal(id); break;
    case "edit-roadmap-step": openRoadmapStepModal(t.dataset.roadmapId, t.dataset.stepId); break;
    case "delete-roadmap-step": if (confirm("Supprimer cette étape ?")) { const rid = t.dataset.roadmapId; deleteRoadmapStep(rid, t.dataset.stepId); closeModal(); render(); openRoadmapDetailModal(rid); showToast("Étape supprimée"); } break;
    case "toggle-step-done": { const r = getRoadmap(t.dataset.roadmapId); const s = r && r.steps.find(x => x.id === t.dataset.stepId); if (r && s) { updateRoadmapStep(r.id, s.id, { done: !s.done }); render(); openRoadmapDetailModal(r.id); } break; }
    case "toggle-step-dossard": { const r = getRoadmap(t.dataset.roadmapId); const s = r && r.steps.find(x => x.id === t.dataset.stepId); if (r && s) { updateRoadmapStep(r.id, s.id, { dossard: !s.dossard }); render(); openRoadmapDetailModal(r.id); } break; }
    case "add-journal-entry": openJournalEntryModal(id, t.dataset.category); break;
    case "delete-journal-entry": if (confirm("Supprimer cette entrée du journal ?")) { const rid = t.dataset.roadmapId; deleteJournalEntry(rid, t.dataset.entryId); render(); openRoadmapDetailModal(rid); showToast("Entrée supprimée"); } break;
    case "remove-journal-photo": pendingJournalPhotos.splice(Number(t.dataset.index), 1); refreshJournalPhotoGallery(); break;
    case "add-challenge": openChallengeModal(); break;
    case "edit-challenge": { const ch = DATA.challenges.find(x => x.id === id); if (ch) openChallengeModal(ch); break; }
    case "delete-challenge": if (confirm("Supprimer ce challenge et toute sa liste ?")) { deleteChallenge(id); closeModal(); render(); showToast("Challenge supprimé"); } break;
    case "open-challenge": openChallengeDetailModal(id); break;
    case "toggle-challenge-item": toggleChallengeItem(t.dataset.challengeId, t.dataset.itemId); render(); openChallengeDetailModal(t.dataset.challengeId); break;
    case "delete-challenge-item": deleteChallengeItem(t.dataset.challengeId, t.dataset.itemId); render(); openChallengeDetailModal(t.dataset.challengeId); break;
    case "add-sport": openSportModal(); break;
    case "select-island": state.adventureIslandId = t.dataset.id; render(); break;
    case "set-active-island": setActiveIsland(id); state.adventureIslandId = id; render(); showToast("Île active mise à jour 🎯"); break;
    case "view-program": state.entrainementView = "detail"; state.entrainementProgramId = id; render(); break;
    case "back-to-programs": state.entrainementView = "list"; state.entrainementProgramId = null; render(); break;
    case "start-workout": startWorkout(id); break;
    case "complete-set": completeSet(); break;
    case "skip-rest": skipRest(); break;
    case "quit-workout": quitWorkout(); break;
    case "finish-workout": finishWorkoutSave(); break;
    case "set-workout-feeling": workoutSession.currentFeeling = t.dataset.value; renderWorkoutPlayerModal(); break;
    case "open-badges": openBadgesModal(); break;
    case "open-body-tracking": openBodyTrackingModal(); break;
    case "delete-weight-log": if (confirm("Supprimer cette pesée ?")) { deleteWeightLog(id); render(); openBodyTrackingModal(); } break;
    case "trigger-weight-photo": weightPhotoTargetLogId = id; document.getElementById("weightPhotoInputHidden").click(); break;
    case "add-measurement": openMeasurementModal(); break;
    case "delete-measurement": if (confirm("Supprimer cette mesure ?")) { deleteMeasurement(id); openBodyTrackingModal(); } break;
    case "delete-custom-sport": {
      const count = activityCountForSport(id);
      const msg = count > 0
        ? `Ce sport a ${count} activité(s) enregistrée(s). Elles resteront dans ton historique mais n'afficheront plus d'icône. Supprimer quand même ?`
        : "Supprimer ce sport ?";
      if (confirm(msg)) {
        deleteCustomSport(id);
        if (state.statsSport === id) state.statsSport = "course";
        render();
        showToast("Sport supprimé");
      }
      break;
    }
    case "export-json": doExportJSON(); break;
    case "export-csv": doExportCSV(); break;
    case "reset-data": doResetData(); break;
    case "pill-choose": {
      const target = document.getElementById(t.dataset.target);
      target.value = t.dataset.value;
      Array.from(t.parentElement.children).forEach(p => p.classList.remove("active"));
      t.classList.add("active");
      if (t.dataset.target === "pill-sport-value") updateActivityFormFields();
      if (t.dataset.target === "pill-coursestatus-value") updateCourseFormFields();
      if (t.dataset.target === "pill-roadmapgoal-value") updateRoadmapFormFields();
      if (t.dataset.target === "pill-goalsport-value") updateGoalFormFields();
      break;
    }
  }
}
function shiftBilanMonth(delta) {
  const [y, m] = state.bilanMonth.split("-").map(Number);
  const d = addMonths(new Date(y, m - 1, 1), delta);
  state.bilanMonth = monthKey(d);
  render();
}
function handleGlobalSubmit(e) {
  if (e.target.id === "form-activity") { e.preventDefault(); saveActivityForm(e.target); }
  if (e.target.id === "form-goal") { e.preventDefault(); saveGoalForm(e.target); }
  if (e.target.id === "form-step-goal") { e.preventDefault(); saveStepGoalForm(e.target); }
  if (e.target.id === "form-steps-day") { e.preventDefault(); saveStepsDayForm(e.target); }
  if (e.target.id === "form-shoe") { e.preventDefault(); saveShoeForm(e.target); }
  if (e.target.id === "form-sport") { e.preventDefault(); saveSportForm(e.target); }
  if (e.target.id === "form-weight") { e.preventDefault(); saveWeightForm(e.target); }
  if (e.target.id === "form-measurement") { e.preventDefault(); saveMeasurementForm(e.target); }
  if (e.target.id === "form-course") { e.preventDefault(); saveCourseForm(e.target); }
  if (e.target.id === "form-roadmap") { e.preventDefault(); saveRoadmapForm(e.target); }
  if (e.target.id === "form-roadmap-step") { e.preventDefault(); saveRoadmapStepForm(e.target); }
  if (e.target.id === "form-journal-entry") { e.preventDefault(); saveJournalEntryForm(e.target); }
  if (e.target.id === "form-challenge") { e.preventDefault(); saveChallengeForm(e.target); }
  if (e.target.id === "form-challenge-additem") {
    e.preventDefault();
    const fd = new FormData(e.target);
    const label = (fd.get("label") || "").trim();
    const chId = e.target.dataset.challengeId;
    if (label) addChallengeItem(chId, label);
    render();
    openChallengeDetailModal(chId);
  }
  if (e.target.id === "form-challenge-bulkadd") {
    e.preventDefault();
    const fd = new FormData(e.target);
    const lines = (fd.get("bulk") || "").split("\n");
    const chId = e.target.dataset.challengeId;
    addChallengeItemsBulk(chId, lines);
    render();
    openChallengeDetailModal(chId);
  }
}
function handleGlobalChange(e) {
  if (e.target.id === "workoutWeightInput") {
    if (workoutSession) workoutSession.currentWeight = e.target.value;
    return;
  }
  if (e.target.id === "importFile") {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJSON(reader.result);
        render();
        showToast("Import réussi ✅");
      } catch (err) {
        alert("Fichier invalide.");
      }
    };
    reader.readAsText(file);
  }
  if (e.target.id === "coursePhotoInput") {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    Promise.all(files.map(f => compressImageFile(f, 1000, 0.7).catch(() => null))).then(dataUrls => {
      pendingCoursePhotos.push(...dataUrls.filter(Boolean));
      refreshPhotoGallery();
    });
  }
  if (e.target.id === "journalPhotoInput") {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    Promise.all(files.map(f => compressImageFile(f, 1000, 0.7).catch(() => null))).then(dataUrls => {
      pendingJournalPhotos.push(...dataUrls.filter(Boolean));
      refreshJournalPhotoGallery();
    });
  }
  if (e.target.id === "weightPhotoInputHidden") {
    const files = Array.from(e.target.files || []);
    if (!files.length || !weightPhotoTargetLogId) return;
    Promise.all(files.map(f => compressImageFile(f, 1000, 0.7).catch(() => null))).then(dataUrls => {
      const log = (DATA.weightLogs || []).find(w => w.id === weightPhotoTargetLogId);
      const existing = log && log.photos ? log.photos : [];
      updateWeightLog(weightPhotoTargetLogId, { photos: existing.concat(dataUrls.filter(Boolean)) });
      weightPhotoTargetLogId = null;
      openBodyTrackingModal();
    });
  }
}
