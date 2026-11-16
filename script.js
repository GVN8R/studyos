const $ = id => document.getElementById(id);

const localDate = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const prettyDate = s => {
  if (!s) return "No date";
  return new Date(s + "T12:00:00").toLocaleDateString(
    undefined, { month: "short", day: "numeric", year: "numeric" }
  );
};

const read = key => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

let assignments = read("studyos-assignments").map(a => ({
  ...a,
  priority: ["high", "normal", "low"].includes(a.priority) ? a.priority : "normal"
}));
let sessions = read("studyos-sessions");
let editingAssignmentId = null;
const checkinStorageKey = "studyos-checkin-date";
const lastCourseStorageKey = "studyos-last-course";
const lastPriorityStorageKey = "studyos-last-priority";
const rememberedCourse = localStorage.getItem(lastCourseStorageKey) || "";
const savedPriority = localStorage.getItem(lastPriorityStorageKey);
const rememberedPriority = ["high", "normal", "low"].includes(savedPriority)
  ? savedPriority
  : "normal";

$("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});
$("deadline").value = localDate(new Date());
$("sessionDate").value = localDate(new Date());
$("course").value = rememberedCourse;
$("priority").value = rememberedPriority;

function save() {
  localStorage.setItem("studyos-assignments", JSON.stringify(assignments));
  localStorage.setItem("studyos-sessions", JSON.stringify(sessions));
}

function getSortedAssignments() {
  return [...assignments].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    if (a.done) return a.date.localeCompare(b.date);
    return compareOpenTasks(a, b);
  });
}

function getStartTask() {
  return getSortedAssignments().find(a => !a.done) || null;
}

function getPlanSignature() {
  const relevant = assignments.map(a => ({
    id: a.id, title: a.title, course: a.course, date: a.date,
    priority: priorityOf(a), remainingMinutes: remainingMinutesOf(a), done: Boolean(a.done)
  })).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return JSON.stringify(relevant);
}

function getCheckinRecord() {
  try {
    const saved = JSON.parse(localStorage.getItem(checkinStorageKey) || "null");
    if (saved && typeof saved === "object" && saved.date) return saved;
  } catch {}
  const legacyDate = localStorage.getItem(checkinStorageKey);
  return legacyDate ? { date: legacyDate, signature: null } : null;
}

function getCheckinState() {
  const todayKey = localDate(new Date());
  const record = getCheckinRecord();
  if (!record || record.date !== todayKey) return "not-reviewed";
  if (!record.signature || record.signature !== getPlanSignature()) return "changed";
  return "reviewed";
}

function renderCheckin() {
  const state = getCheckinState();
  const open = assignments.filter(a => !a.done);
  const overdue = open.filter(a => daysUntil(a.date) < 0).length;
  const dueToday = open.filter(a => daysUntil(a.date) === 0).length;
  const upcoming = open.filter(a => daysUntil(a.date) > 0 && daysUntil(a.date) <= 7).length;
  const highPriority = open.filter(a => priorityOf(a) === "high").length;
  const focus = getStartTask();
  const focusBox = $("checkinFocus");
  focusBox.replaceChildren();

  const statusText = state === "reviewed" ? "Reviewed today" : state === "changed" ? "Plan changed" : "Not reviewed";
  $("checkinStatus").textContent = statusText;
  $("checkinStatus").classList.toggle("is-complete", state === "reviewed");
  $("checkinStatus").classList.toggle("is-changed", state === "changed");
  $("completeCheckin").textContent = state === "changed" ? "Review updated plan" : state === "reviewed" ? "Review again" : "I've reviewed today's plan";
  $("planFocusSession").disabled = !focus;

  focusBox.append(node("span", "TODAY'S PLAN AT A GLANCE", "checkin-label"));
  const summary = node("div", "", "checkin-summary");
  [[open.length, "open"], [overdue, "overdue"], [dueToday, "due today"], [upcoming, "due in 7 days"], [highPriority, "high priority"]].forEach(([count, label]) => {
    const stat = node("div", "", "checkin-stat");
    stat.append(node("strong", String(count)));
    stat.append(node("span", label));
    summary.append(stat);
  });
  focusBox.append(summary);
  focusBox.append(node("p", focus
    ? "Your task order is shown in Start Here. Use this review to check whether the overall plan still fits your day."
    : "You have no open assignments. Your plan is clear for now.", "meta"));

  $("checkinMessage").textContent = state === "changed"
    ? "Your assignments changed since your last review. Review the updated plan before you continue."
    : state === "reviewed"
      ? "You've reviewed the current plan today. Reviewing it does not mark any assignment complete."
      : "Review your workload and deadlines. This check-in is separate from completing assignments.";
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

function daysUntil(date) {
  const todayKey = localDate(new Date());
  const start = new Date(todayKey + "T00:00:00");
  const due = new Date(date + "T00:00:00");
  return Math.round((due - start) / 86400000);
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

function priorityOf(a) {
  return ["high", "normal", "low"].includes(a.priority) ? a.priority : "normal";
}

function remainingMinutesOf(a) {
  const value = Number(a.remainingMinutes);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function urgencyScore(a) {
  const days = daysUntil(a.date);
  if (days < 0) return 125 + Math.min(Math.abs(days), 14);
  if (days === 0) return 115;
  if (days === 1) return 105;
  if (days <= 3) return 90 - (days - 2) * 3;
  if (days <= 7) return 78 - (days - 4) * 2;
  return Math.max(55, 70 - (days - 8) * 0.5);
}

function priorityScore(a) {
  return { high: 12, normal: 6, low: 0 }[priorityOf(a)];
}

function effortScore(a) {
  const minutes = remainingMinutesOf(a);
  if (minutes === null) return 0;
  if (minutes <= 15) return 4;
  if (minutes <= 30) return 3;
  if (minutes <= 60) return 1;
  if (minutes <= 120) return 0;
  return -1;
}

function recommendationScore(a) {
  return urgencyScore(a) + priorityScore(a) + effortScore(a);
}

function compareOpenTasks(a, b) {
  return recommendationScore(b) - recommendationScore(a) ||
    daysUntil(a.date) - daysUntil(b.date) ||
    ({ high: 0, normal: 1, low: 2 }[priorityOf(a)] -
    { high: 0, normal: 1, low: 2 }[priorityOf(b)]) ||
    (remainingMinutesOf(a) ?? Infinity) - (remainingMinutesOf(b) ?? Infinity) ||
    a.title.localeCompare(b.title);
}

function getPriorityReason(a) {
  const d = daysUntil(a.date);
  const deadlineText = d < 0 ? "Overdue"
    : d === 0 ? "Due today"
    : d === 1 ? "Due tomorrow"
    : d <= 7 ? `Due in ${d} days`
    : `Due ${prettyDate(a.date)}`;
  const priorityText = priorityOf(a) === "high" ? "High priority"
    : priorityOf(a) === "low" ? "Low priority" : "";
  const minutes = remainingMinutesOf(a);
  const effortText = minutes === null ? "Time estimate not set"
    : minutes >= 180 ? "About 3+ hours left"
    : minutes >= 60 ? `About ${minutes / 60} hour${minutes === 60 ? "" : "s"} left`
    : `About ${minutes} minutes left`;
  return [deadlineText, priorityText, effortText].filter(Boolean).join(" · ");
}

function openEditDialog(a) {
  editingAssignmentId = a.id;
  $("editTask").value = a.title || "";
  $("editCourse").value = a.course || "";
  $("editDeadline").value = a.date || "";
  $("editPriority").value = priorityOf(a);
  $("editRemainingTime").value = remainingMinutesOf(a) === null ? "" : String(remainingMinutesOf(a));
  $("editError").textContent = "";
  $("editDialog").showModal();
  $("editTask").focus();
}

function closeEditDialog() {
  $("editDialog").close();
  editingAssignmentId = null;
  $("editError").textContent = "";
}

$("closeEdit").addEventListener("click", closeEditDialog);
$("cancelEdit").addEventListener("click", closeEditDialog);

$("editDialog").addEventListener("click", event => {
  if (event.target === $("editDialog")) closeEditDialog();
});

$("editForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("editTask").value.trim();
  const course = $("editCourse").value.trim();
  const date = $("editDeadline").value;
  const priority = $("editPriority").value;
  const remainingMinutes = $("editRemainingTime").value === ""
    ? null : Number($("editRemainingTime").value);

  if (!title || !course) {
    $("editError").textContent = "Assignment name and course cannot be blank.";
    return;
  }
  if (!isValidDateString(date)) {
    $("editError").textContent = "Please choose a valid due date.";
    return;
  }

  const assignment = assignments.find(a => a.id === editingAssignmentId);
  if (!assignment) {
    closeEditDialog();
    return;
  }

  Object.assign(assignment, { title, course, date, priority, remainingMinutes });
  save();
  closeEditDialog();
  render();
});

function render() {
  const open = assignments.filter(a => !a.done);
  const due = open.filter(a => a.date <= localDate(new Date()));
  $("openCount").textContent = open.length;
  $("dueCount").textContent = due.length;
  $("doneCount").textContent = assignments.filter(a => a.done).length;

  const list = $("assignments");
  list.replaceChildren();

  const sorted = getSortedAssignments();

  const nextTask = $("nextTask");
  nextTask.replaceChildren();
  const firstOpen = sorted.find(a => !a.done);

  if (firstOpen) {
    nextTask.append(node("strong", "START HERE"));
    nextTask.append(node("div", firstOpen.title));
    const startReason = getPriorityReason(firstOpen);
    if (startReason) nextTask.append(node("div", startReason, "meta"));
    nextTask.append(node("div", "Try a 25-minute session, then reassess what you need next.", "meta"));
  } else {
    nextTask.append(node("strong", "YOU'RE ALL CAUGHT UP"));
    nextTask.append(node("div", "Add an assignment when you have new work to plan."));
  }

  if (!sorted.length) {
    list.append(node("p", "No assignments yet. Add your first one above.", "empty"));
  }

  sorted.forEach(a => {
    const isStartHere = !a.done && firstOpen && a.id === firstOpen.id;
    const item = node("div", "",
      "item" + (a.done ? " done" : "") + (isStartHere ? " start-here-item" : ""));
    
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = Boolean(a.done);
    check.setAttribute("aria-label", "Mark " + a.title + " complete");
    check.addEventListener("change", () => {
      a.done = check.checked;
      save();
      render();
    });

    const content = node("div", "", "item-content");
    if (isStartHere) content.append(node("span", "START HERE", "start-here-tag"));
    content.append(node("div", a.title, "item-title"));
    content.append(node("div", a.course + " · Due " + prettyDate(a.date), "meta"));
    
    const priority = priorityOf(a);
    content.append(node(
      "span",
      priority.charAt(0).toUpperCase() + priority.slice(1) + " priority",
      "priority priority-" + priority
    ));
    if (!a.done) {
      const reason = getPriorityReason(a);
      if (reason) content.append(node("div", reason, "meta"));
    }

    const actions = node("div", "", "item-actions");

    const edit = node("button", "Edit", "secondary");
    edit.type = "button";
    edit.addEventListener("click", () => openEditDialog(a));

    const remove = node("button", "Delete", "danger");
    remove.type = "button";
    remove.addEventListener("click", () => {
      assignments = assignments.filter(x => x.id !== a.id);
      save();
      render();
    });

    actions.append(edit, remove);
    item.append(check, content, actions);
    list.append(item);
  });

  const sessionList = $("sessions");
  sessionList.replaceChildren();

  const upcoming = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) {
    sessionList.append(node("p", "No study sessions planned yet.", "empty"));
  }

  upcoming.forEach(s => {
    const box = node("div", "", "session");
    box.append(node("strong", s.title));
    box.append(node("small", prettyDate(s.date) + " · " + s.minutes + " minutes"));

    const remove = node("button", "Remove", "secondary");
    remove.type = "button";
    remove.style.marginTop = "10px";
    remove.addEventListener("click", () => {
      sessions = sessions.filter(x => x.id !== s.id);
      save();
      render();
    });
    box.append(remove);
    sessionList.append(box);
  });

  renderCheckin();
}

$("assignmentForm").addEventListener("submit", e => {
  e.preventDefault();
  const title = $("task").value.trim();
  const course = $("course").value.trim();

  if (!title || !course) {
    alert("Assignment name and course cannot be blank.");
    return;
  }
  if (!isValidDateString($("deadline").value)) {
    alert("Please choose a valid due date.");
    return;
  }

  const priority = $("priority").value;
  const remainingMinutes = $("remainingTime").value === ""
    ? null : Number($("remainingTime").value);
  assignments.push({
    id: crypto.randomUUID(),
    title,
    course,
    date: $("deadline").value,
    priority,
    remainingMinutes,
    done: false
  });
  localStorage.setItem(lastCourseStorageKey, course);
  localStorage.setItem(lastPriorityStorageKey, priority);
  save();
  e.target.reset();
  $("deadline").value = localDate(new Date());
  $("course").value = course;
  $("priority").value = priority;
  $("remainingTime").value = "30";
  render();
  $("task").focus();
});

$("sessionForm").addEventListener("submit", e => {
  e.preventDefault();
  const title = $("sessionTitle").value.trim();
  if (!title) {
    alert("Study session name cannot be blank.");
    return;
  }
  if (!isValidDateString($("sessionDate").value)) {
    alert("Please choose a valid study date.");
    return;
  }

  sessions.push({
    id: crypto.randomUUID(),
    title,
    date: $("sessionDate").value,
    minutes: Number($("minutes").value)
  });
  save();
  e.target.reset();
  $("sessionDate").value = localDate(new Date());
  $("minutes").value = "25";
  render();
});

$("planFocusSession").addEventListener("click", () => {
  const focus = getStartTask();
  if (!focus) return;

  sessions.push({
    id: crypto.randomUUID(),
    title: "Work on: " + focus.title,
    date: localDate(new Date()),
    minutes: 25
  });
  save();
  render();
  $("sessionForm").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("completeCheckin").addEventListener("click", () => {
  localStorage.setItem(checkinStorageKey, JSON.stringify({
    date: localDate(new Date()),
    signature: getPlanSignature()
  }));
  renderCheckin();
});

render();