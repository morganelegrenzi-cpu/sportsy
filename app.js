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
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
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
  const titles = { accueil: "Mon Suivi Sport", stats: "Statistiques", objectifs: "Objectifs", courses: "Courses", bilans: "Bilans", profil: "Profil" };
  document.getElementById("topbarTitle").textContent = titles[state.page] || "Mon Suivi Sport";
  let html = "";
  if (state.page === "accueil") html = renderAccueil();
  else if (state.page === "stats") html = renderStats();
  else if (state.page === "objectifs") html = renderObjectifs();
  else if (state.page === "courses") html = renderCourses();
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
  const goals = DATA.goals.filter(g => g.period === state.objTab);
  return `
  <div class="sport-tabs">
    <div class="sport-tab ${state.objTab==='week'?'active':''}" data-action="obj-tab" data-tab="week">Hebdomadaires</div>
    <div class="sport-tab ${state.objTab==='year'?'active':''}" data-action="obj-tab" data-tab="year">Annuels</div>
  </div>
  <button class="fab-add" data-action="add-goal">+ Ajouter un objectif</button>
  ${goals.length ? goals.map(goalCardFull).join("") : `<div class="empty-state"><div class="emoji">🎯</div>Aucun objectif ${state.objTab==='week'?'hebdomadaire':'annuel'} pour l'instant.</div>`}
  `;
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

/* ================= COURSES ================= */
function renderCourses() {
  return `
  <div class="sport-tabs">
    <div class="sport-tab ${state.coursesTab==='mescourses'?'active':''}" data-action="courses-tab" data-tab="mescourses">Mes courses</div>
    <div class="sport-tab ${state.coursesTab==='wishlist'?'active':''}" data-action="courses-tab" data-tab="wishlist">Wishlist</div>
    <div class="sport-tab ${state.coursesTab==='challenges'?'active':''}" data-action="courses-tab" data-tab="challenges">Challenges</div>
  </div>
  ${state.coursesTab === 'mescourses' ? renderCoursesMes() : state.coursesTab === 'wishlist' ? renderCoursesWishlist() : renderCoursesChallenges()}
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
function buildBadgeGroups() {
  const KM_TIERS = [10, 50, 100, 250, 500, 1000, 1500, 2000, 3000, 5000, 7500, 10000];
  const SWIM_TIERS = [1, 5, 10, 25, 50, 100];
  const HYROX_TIERS = [8, 40, 80, 200, 400, 800]; // ~1, 5, 10, 25, 50, 100 courses (8 km/course)
  const SESSION_TIERS = [5, 10, 25, 50, 100, 250, 500];
  const groups = [];
  getAllSports().forEach(s => {
    if (s.distance) {
      const current = aggForSport(getActivities({ sport: s.id })).distance;
      const tiers = s.distanceUnit === "m" ? SWIM_TIERS : (s.id === "hyrox" ? HYROX_TIERS : KM_TIERS);
      groups.push({
        id: "dist-" + s.id, icon: s.icon, title: `Distance – ${s.name}`,
        current, tiers,
        fmtCurrent: v => fmtKm(v),
        fmtTarget: s.id === "hyrox" ? (v => `${Math.round(v / 8)} course${Math.round(v / 8) > 1 ? "s" : ""}`) : (v => `${v} km`)
      });
    } else {
      const current = activityCountForSport(s.id);
      groups.push({
        id: "sess-" + s.id, icon: s.icon, title: `Séances – ${s.name}`,
        current, tiers: SESSION_TIERS, fmtCurrent: v => `${v} séance${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}`
      });
    }
  });
  const totalSessions = DATA.activities.length;
  groups.push({ id: "total-sessions", icon: "🎯", title: "Total séances (tous sports)", current: totalSessions, tiers: [10, 25, 50, 100, 250, 500, 1000], fmtCurrent: v => `${v} séance${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const totalElevation = totalsAll(DATA.activities).elevation;
  groups.push({ id: "elevation", icon: "⛰️", title: "Dénivelé cumulé", current: totalElevation, tiers: [1000, 5000, 10000, 25000, 50000], fmtCurrent: v => fmtElevation(v), fmtTarget: v => fmtElevation(v) });

  const streak = computeLongestStreak();
  groups.push({ id: "streak", icon: "🔥", title: "Régularité (semaines d'affilée)", current: streak, tiers: [4, 8, 12, 26, 52, 78, 104, 156, 260], fmtCurrent: v => `${v} semaine${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const runningDayStreak = computeLongestRunningDayStreak();
  groups.push({ id: "running-streak", icon: "🏃", title: "Running streak (CAP + Trail, jours d'affilée)", current: runningDayStreak, tiers: [3, 7, 14, 30, 60, 100, 180, 365, 500, 1000], fmtCurrent: v => `${v} jour${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const coursesDone = getCourses({ status: "done" }).length;
  groups.push({ id: "courses", icon: "🏁", title: "Courses terminées", current: coursesDone, tiers: [1, 5, 10, 25, 50, 75, 100, 150], fmtCurrent: v => `${v} course${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const sportsTried = getAllSports().filter(s => activityCountForSport(s.id) > 0).length;
  groups.push({ id: "explorer", icon: "🧭", title: "Sports essayés", current: sportsTried, tiers: [3, 5, 7], fmtCurrent: v => `${v} sport${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  const challengesDone = DATA.challenges.filter(ch => ch.items.length > 0 && ch.items.every(i => i.done)).length;
  groups.push({ id: "challenges", icon: "🏆", title: "Challenges complétés", current: challengesDone, tiers: [1, 3, 5], fmtCurrent: v => `${v} challenge${v > 1 ? "s" : ""}`, fmtTarget: v => `${v}` });

  return groups;
}
function badgeGroupEarnedCount(g) { return g.tiers.filter(t => g.current >= t).length; }
function renderBadgeGroupHTML(g) {
  const nextTier = g.tiers.find(t => g.current < t);
  const chips = g.tiers.map(t => {
    const earned = g.current >= t;
    return `<div class="badge-tier ${earned ? 'earned' : 'locked'}">
      <div class="ic">${earned ? g.icon : '🔒'}</div>
      <div class="lbl">${g.fmtTarget(t)}</div>
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

/* ================= PROFIL ================= */
function renderProfil() {
  const shoes = DATA.shoes.filter(s => s.active !== false);
  const retiredShoes = DATA.shoes.filter(s => s.active === false);
  const badgeGroups = buildBadgeGroups();
  const badgeEarned = badgeGroups.reduce((t, g) => t + badgeGroupEarnedCount(g), 0);
  const badgeTotal = badgeGroups.reduce((t, g) => t + g.tiers.length, 0);

  return `
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
  if (id) updateActivity(id, activity); else addActivity(activity);
  closeModal();
  render();
  showToast(id ? "Activité mise à jour" : "Activité ajoutée 💪");
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
            <div class="pill ${g.metric==='distance'?'active':''}" data-action="pill-choose" data-target="pill-metric-value" data-value="distance">Distance (km)</div>
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
}
function saveGoalForm(form) {
  const fd = new FormData(form);
  const goal = { sport: fd.get("sport") || null, period: fd.get("period"), metric: fd.get("metric"), target: Number(fd.get("target")) };
  const id = form.dataset.id;
  if (id) updateGoal(id, goal); else addGoal(goal);
  closeModal(); render(); showToast("Objectif enregistré 🎯");
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
  if (id) updateCourse(id, course); else addCourse(course);
  closeModal();
  render();
  showToast(id ? "Course mise à jour" : "Course ajoutée 🏁");
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
function mountModal(html) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = html;
  const overlay = root.querySelector(".modal-overlay");
  if (overlay) {
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
    case "obj-tab": state.objTab = t.dataset.tab; render(); break;
    case "add-goal": openGoalModal(); break;
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
    case "add-challenge": openChallengeModal(); break;
    case "edit-challenge": { const ch = DATA.challenges.find(x => x.id === id); if (ch) openChallengeModal(ch); break; }
    case "delete-challenge": if (confirm("Supprimer ce challenge et toute sa liste ?")) { deleteChallenge(id); closeModal(); render(); showToast("Challenge supprimé"); } break;
    case "open-challenge": openChallengeDetailModal(id); break;
    case "toggle-challenge-item": toggleChallengeItem(t.dataset.challengeId, t.dataset.itemId); render(); openChallengeDetailModal(t.dataset.challengeId); break;
    case "delete-challenge-item": deleteChallengeItem(t.dataset.challengeId, t.dataset.itemId); render(); openChallengeDetailModal(t.dataset.challengeId); break;
    case "add-sport": openSportModal(); break;
    case "open-badges": openBadgesModal(); break;
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
  if (e.target.id === "form-shoe") { e.preventDefault(); saveShoeForm(e.target); }
  if (e.target.id === "form-sport") { e.preventDefault(); saveSportForm(e.target); }
  if (e.target.id === "form-course") { e.preventDefault(); saveCourseForm(e.target); }
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
}
