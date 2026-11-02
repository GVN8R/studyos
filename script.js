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

$("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});
$("deadline").value = localDate(new Date());
$("sessionDate").value = localDate(new Date());

function save() {
  localStorage.setItem("studyos-assignments", JSON.stringify(assignments));
  localStorage.setItem("studyos-sessions", JSON.stringify(sessions));
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

function taskBucket(a) {
  const d = daysUntil(a.date);
  const priority = priorityOf(a);

  if (d < 0) return 0;
  if (priority === "high" && d <= 2) return 1;
  if (d <= 2) return 2;
  if (priority === "high") return 3;
  if (priority === "normal") return 4;
  return 5;
}

function compareOpenTasks(a, b) {
  return taskBucket(a) - taskBucket(b) ||
    daysUntil(a.date) - daysUntil(b.date) ||
    ({ high: 0, normal: 1, low: 2 }[priorityOf(a)] -
    { high: 0, normal: 1, low: 2 }[priorityOf(b)]) ||
    a.title.localeCompare(b.title);
}

function getPriorityReason(a) {
  const d = daysUntil(a.date);
  const priority = priorityOf(a);

  if (d < 0) return "Overdue";
  if (priority === "high" && d <= 2) {
    return d === 0 ? "High priority ~ Due today"
      : d === 1 ? "High priority ~ Due tomorrow"
      : "High priority ~ Due in 2 days";
  }
  if (d <= 2) {
    return d === 0 ? "Due today"
      : d === 1 ? "Due tomorrow"
      : "Due in 2 days";
  }
  if (priority === "high") return "High priority";
  if (priority === "low") return "Low priority";
  return "Normal priority";
}

function openEditDialog(a) {
  editingAssignmentId = a.id;
  $("editTask").value = a.title || "";
  $("editCourse").value = a.course || "";
  $("editDeadline").value = a.date || "";
  $("editPriority").value = priorityOf(a);
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
  const title = $("task").value.trim();
  const course = $("course").value.trim();
  const date = $("editDeadline").value;
  const priority = $("editPriority").value;

  if (!title || !course) {
    alert("Assignment name and course cannot be blank.");
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

  Object.assign(assignment, { title, course, date, priority });
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

  const sorted = [...assignments].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    if (a.done) return a.date.localeCompare(b.date);
    return compareOpenTasks(a, b);
  });

  const nextTask = $("nextTask");
  nextTask.replaceChildren();
  const firstOpen = sorted.find(a => !a.done);

  if (firstOpen) {
    nextTask.append(node("strong", "START HERE"));
    nextTask.append(node("div", firstOpen.title));
    nextTask.append(node("div", getPriorityReason(firstOpen), true));
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
    if (!a.done) content.append(node("div", getPriorityReason(a), "meta"));

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
}

$("assignmentForm").addEventListener("submit", e => {
  e.preventDefault();
if (!isValidDateString($("deadline").value)) {
  alert("Please choose a valid due date.");
  return;
}

  assignments.push({
    id: crypto.randomUUID(),
    title: $("task").value.trim(),
    course: $("course").value.trim(),
    date: $("deadline").value,
    priority: $("priority").value,
    done: false
  });
  save();
  e.target.reset();
  $("deadline").value = localDate(new Date());
  $("priority").value = "normal";
  render();
});

$("sessionForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!isValidDateString($("sessionDate").value)) {
    alert("Please choose a valid study date.");
    return;
  }

  sessions.push({
    id: crypto.randomUUID(),
    title: $("sessionTitle").value.trim(),
    date: $("sessionDate").value,
    minutes: Number($("minutes").value)
  });
  save();
  e.target.reset();
  $("sessionDate").value = localDate(new Date());
  $("minutes").value = "25";
  render();
});

render();