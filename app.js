const firebaseConfig = {
  apiKey: "AIzaSyB6QdisMrBoRtEkM-FLOfgmRnDtWehiEzc",
  authDomain: "jeongeun-todo-backend.firebaseapp.com",
  projectId: "jeongeun-todo-backend",
  storageBucket: "jeongeun-todo-backend.firebasestorage.app",
  messagingSenderId: "73880816235",
  appId: "1:73880816235:web:ac009dadfc4c02e3e97f2e",
  databaseURL: "https://jeongeun-todo-backend-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const todosRef = db.ref("todos");

const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const saveButton = form.querySelector("button[type='submit']");
const list = document.querySelector("#todo-list");
const summary = document.querySelector("#summary");
const status = document.querySelector("#status");
const monthLabel = document.querySelector("#month-label");
const dayCaption = document.querySelector("#day-caption");
const weekStrip = document.querySelector("#week-strip");
const todayButton = document.querySelector("#today-button");
const prevWeekButton = document.querySelector("#prev-week");
const nextWeekButton = document.querySelector("#next-week");

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

let todos = [];
let editingId = null;
let savingEditId = null;
let savingEditText = "";
let loaded = false;
let selectedDate = todayKey();

summary.textContent = "불러오는 중…";

prevWeekButton.addEventListener("click", () => {
  selectDate(addDays(selectedDate, -7));
});

nextWeekButton.addEventListener("click", () => {
  selectDate(addDays(selectedDate, 7));
});

todayButton.addEventListener("click", () => {
  selectDate(todayKey());
});

weekStrip.addEventListener("click", (event) => {
  const day = event.target.closest("[data-date]");
  if (!day) return;
  selectDate(day.dataset.date);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || form.dataset.saving === "true") return;

  form.dataset.saving = "true";
  saveButton.disabled = true;
  saveButton.textContent = "저장 중…";
  input.value = "";

  try {
    await todosRef.push({
      text,
      done: false,
      date: selectedDate,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    });
    showStatus("저장했습니다");
  } catch (error) {
    input.value = text;
    showError("저장하지 못했습니다. 데이터베이스 규칙을 확인해 주세요.");
    console.error(error);
  } finally {
    delete form.dataset.saving;
    saveButton.disabled = false;
    saveButton.textContent = "저장";
  }
});

list.addEventListener("click", (event) => {
  const item = event.target.closest("[data-id]");
  if (!item) return;

  const id = item.dataset.id;
  const action = event.target.closest("[data-action]")?.dataset.action;

  if (action === "edit") {
    editingId = id;
    render();
    return;
  }

  if (action === "delete") {
    if (editingId === id) editingId = null;
    db.ref(`todos/${id}`).remove().catch((error) => {
      showError("할 일을 삭제하지 못했습니다.");
      console.error(error);
    });
    return;
  }

  if (action === "cancel") {
    editingId = null;
    render();
  }
});

list.addEventListener("change", (event) => {
  if (!event.target.matches("[data-action='toggle']")) return;
  const id = event.target.closest("[data-id]").dataset.id;
  db.ref(`todos/${id}`).update({ done: event.target.checked }).catch((error) => {
    showError("완료 상태를 바꾸지 못했습니다.");
    console.error(error);
  });
});

list.addEventListener("submit", async (event) => {
  const editForm = event.target.closest("[data-action='save']");
  if (!editForm) return;
  event.preventDefault();

  const item = editForm.closest("[data-id]");
  if (!item) return;
  const id = item.dataset.id;
  const text = editForm.querySelector("input").value.trim();
  if (!text || savingEditId) return;

  savingEditId = id;
  savingEditText = text;
  render();

  try {
    await db.ref(`todos/${id}`).update({ text });
    const saved = todos.find((todo) => todo.id === id);
    if (saved) saved.text = text;
    if (editingId === id) editingId = null;
    savingEditId = null;
    savingEditText = "";
    render();
    showStatus("저장했습니다");
  } catch (error) {
    savingEditId = null;
    savingEditText = "";
    render();
    showError("저장하지 못했습니다.");
    console.error(error);
  }
});

todosRef.on(
  "value",
  (snapshot) => {
    const value = snapshot.val() ?? {};
    todos = Object.entries(value)
      .map(([id, todo]) => ({
        id,
        text: String(todo?.text ?? ""),
        done: Boolean(todo?.done),
        date: normalizeDate(todo?.date),
        createdAt: Number(todo?.createdAt) || 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    loaded = true;
    render();
  },
  (error) => {
    showError("할 일을 불러오지 못했습니다. 데이터베이스 규칙을 확인해 주세요.");
    console.error(error);
  }
);

function selectDate(key) {
  if (!isDateKey(key) || key === selectedDate) return;
  selectedDate = key;
  editingId = null;
  savingEditId = null;
  savingEditText = "";
  render();
}

function showStatus(message) {
  status.textContent = message;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

function showError(message) {
  summary.classList.add("is-error");
  summary.textContent = message;
}

function visibleTodos() {
  const today = todayKey();
  return todos.filter((todo) => {
    if (!todo.date) return selectedDate === today;
    return todo.date === selectedDate;
  });
}

function render() {
  renderWeek();
  if (!loaded) return;

  const visible = visibleTodos();
  const remaining = visible.filter((todo) => !todo.done).length;
  summary.classList.remove("is-error");
  summary.textContent =
    visible.length === 0
      ? "할 일이 없습니다"
      : `${visible.length}개 중 ${remaining}개 남음`;

  if (visible.length === 0) {
    list.innerHTML = `<li class="empty">위에 할 일을 적고 저장해 보세요.</li>`;
    return;
  }

  list.innerHTML = visible
    .map((todo) => {
      if (todo.id === editingId) {
        const saving = savingEditId === todo.id;
        const value = saving ? savingEditText : todo.text;
        return `
          <li class="item" data-id="${todo.id}">
            <form class="edit-form" data-action="save">
              <input type="text" value="${escapeHtml(value)}" maxlength="120" required ${saving ? "readonly" : ""} />
              <button class="save-button" type="submit" ${saving ? "disabled" : ""}>${saving ? "저장 중…" : "저장"}</button>
              <button class="icon-button" type="button" data-action="cancel">취소</button>
            </form>
          </li>
        `;
      }

      return `
        <li class="item${todo.done ? " is-done" : ""}" data-id="${todo.id}">
          <input class="check" type="checkbox" data-action="toggle" ${todo.done ? "checked" : ""} aria-label="완료" />
          <span class="text">${escapeHtml(todo.text)}</span>
          <div class="actions">
            <button class="icon-button" type="button" data-action="edit">수정</button>
            <button class="icon-button danger" type="button" data-action="delete">삭제</button>
          </div>
        </li>
      `;
    })
    .join("");

  const editingInput = list.querySelector(".edit-form input");
  if (editingInput && savingEditId !== editingId) {
    editingInput.focus();
    editingInput.setSelectionRange(editingInput.value.length, editingInput.value.length);
  }
}

function renderWeek() {
  const today = todayKey();
  monthLabel.textContent = `${Number(selectedDate.slice(5, 7))}월`;
  dayCaption.textContent = captionFor(selectedDate, today);
  todayButton.setAttribute("aria-pressed", String(selectedDate === today));

  const start = startOfWeek(selectedDate);
  weekStrip.innerHTML = WEEKDAYS.map((name, index) => {
    const key = addDays(start, index);
    const selected = key === selectedDate;
    const isToday = key === today;
    return `
      <button
        type="button"
        class="day${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}"
        data-date="${key}"
        aria-pressed="${selected}"
        aria-label="${labelFor(key)}"
      >
        <span class="day-name">${name}</span>
        <span class="day-num">${Number(key.slice(8, 10))}</span>
      </button>
    `;
  }).join("");
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDate(value) {
  return isDateKey(value) ? value : "";
}

function parseKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(key, amount) {
  const date = parseKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatKey(date);
}

function startOfWeek(key) {
  return addDays(key, -parseKey(key).getUTCDay());
}

function captionFor(key, today) {
  const date = parseKey(key);
  const text = `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 ${WEEKDAYS[date.getUTCDay()]}요일`;
  return key === today ? `오늘 · ${text}` : text;
}

function labelFor(key) {
  const date = parseKey(key);
  return `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 ${WEEKDAYS[date.getUTCDay()]}요일`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

renderWeek();
