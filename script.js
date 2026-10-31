const $ = id => document.getElementById(id);
const today = new Date();
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
  } catch { return []; }
};
let assignments = read("studyos-assignments").map(a => ({
  ...a,
  priority: ["high", "normal", "low"].includes(a.priority) ? a.priority : "normal"
}));
let sessions = read("studyos-sessions");

$("today").textContent = today.toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});
$("deadline").value = localDate(today);
$("sessionDate").value = localDate(today);

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

function getPriorityReason(a) {
  const days = Math.round((new Date(a.date + "T00:00:00") - new Date(localDate(new Date()) + "T00:00:00")) / 86400000);
  if (days < 0) return "Overdue - this needs attention.";
  if (days === 0) return "Due today.";
  if (days === 1) return "Due tomorrow.";
  if (days <= 2) return "Due in " + days + " days.";
  if ((a.priority || "normal") === "high") return "Marked high priority.";
  if ((a.priority || "normal") === "low") return "Marked low priority.";
  return "Due " + prettyDate(a.date) + ".";
}

function render() {
  const open = assignments.filter(a => !a.done);
  const due = open.filter(a => a.date <= localDate(today));
  $("openCount").textContent = open.length;
  $("dueCount").textContent = due.length;
  $("doneCount").textContent = assignments.filter(a => a.done).length;

  const list = $("assignments");
  list.replaceChildren();

  const todayKey = localDate(new Date());
  const daysUntil = date => {
    const start = new Date(todayKey + "T00:00:00");
    const dueDate = new Date(date + "T00:00:00");
    return Math.round((dueDate - start) / 86400000);
  };
  const priorityRank = a => ({ high: 0, normal: 1, low: 2 }[a.priority || "normal"]);
  const sorted = [...assignments].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    if (a.done) return a.date.localeCompare(b.date);
    const da = daysUntil(a.date), db = daysUntil(b.date);
    const bucket = a => {
      const d = daysUntil(a.date);
      if (d < 0) return 0;
      if ((a.priority || "normal") === "high" && d <= 2) return 1;
      if ((a.priority || "normal") === "high") return 2;
      if (d <= 2) return 3;
      return 4;
    };
    return bucket(a) - bucket(b) ||
      priorityRank(a) - priorityRank(b) ||
      da - db ||
      a.title.localeCompare(b.title);
  });

  const nextTask = $("nextTask");
  nextTask.replaceChildren();
  const firstOpen = sorted.find(a => !a.done);
  if (firstOpen) {
    nextTask.append(node("strong", "START HERE"));
    nextTask.append(node("div", firstOpen.title));
    nextTask.append(node("div", getPriorityReason(firstOpen), "meta"));
    nextTask.append(node("div", "A useful first step: work on this assignment for 25 minutes, then reassess.", "meta"));
  } else {
    nextTask.append(node("strong", "YOU'RE ALL CAUGHT UP"));
    nextTask.append(node("div", "Add an assignment when you have new work to plan."));
  }

  if (!sorted.length) {
    list.append(node("p", "No assignments yet. Add your first one above.", "empty"));
  }

  sorted.forEach(a => {
    const item = node("div", "", "item" + (a.done ? " done" : ""));
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = a.done;
    check.setAttribute("aria-label", "Mark " + a.title + " complete");
    check.addEventListener("change", () => {
      a.done = check.checked;
      save();
      render();
    });

    const content = node("div", "", "item-content");
    content.append(node("div", a.title, "item-title"));
    content.append(node("div", a.course + " · Due " + prettyDate(a.date), "meta"));
    const priorityName = (a.priority || "normal").charAt(0).toUpperCase() + (a.priority || "normal").slice(1);
    content.append(node("span", priorityName + " priority", "priority priority-" + (a.priority || "normal")));
    if (!a.done) content.append(node("div", getPriorityReason(a), "meta"));

    const actions = node("div", "", "item-actions");
    const edit = node("button", "Edit", "secondary");
    edit.type = "button";
    edit.addEventListener("click", () => {
      const title = prompt("Assignment name:", a.title);
      if (title === null) return;
      const course = prompt("Course:", a.course);
      if (course === null) return;
      const date = prompt("Due date (YYYY-MM-DD):", a.date);
      if (date === null) return;
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || Number.isNaN(new Date(date + "T00:00:00").getTime())) {
        alert("Please enter the due date as YYYY-MM-DD.");
        return;
      }
      const priority = prompt("Priority: high, normal, or low", a.priority || "normal");
      if (priority === null) return;
      const normalizedPriority = priority.trim().toLowerCase();
      if (!["high", "normal", "low"].includes(normalizedPriority)) {
        alert("Priority must be high, normal, or low.");
        return;
      }
      if (!title.trim() || !course.trim()) {
        alert("Assignment name and course cannot be blank.");
        return;
      }
      Object.assign(a, { title: title.trim(), course: course.trim(), date, priority: normalizedPriority });
      save();
      render();
    });

    const remove = node("button", "Delete", "danger");
    remove.type = "button";
    remove.addEventListener("click", () => {
      assignments = assignments.filter(x => x.id !== a.id);
      save();
      render();
    });

    actions.append(edit, remove);
    item.append(check, content, remove);
    list.append(item);
  });

  const sessionList = $("sessions");
  sessionList.replaceChildren();

  const upcoming = [...sessions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

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
  $("deadline").value = localDate(today);
  $("priority").value = "normal";
  render();
});

$("sessionForm").addEventListener("submit", e => {
  e.preventDefault();
  sessions.push({
    id: crypto.randomUUID(),
    title: $("sessionTitle").value.trim(),
    date: $("sessionDate").value,
    minutes: Number($("minutes").value)
  });
  save();
  e.target.reset();
  $("sessionDate").value = localDate(today);
  $("minutes").value = "25";
  render();
});

render();