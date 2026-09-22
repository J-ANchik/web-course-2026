
// Лабораторная работа №3. Todo-list на чистом JavaScript
// Данные не сохраняются между перезагрузками (localStorage — в лабе №9)

// Ссылки на DOM-элементы
const form = document.getElementById('task-form');
const input = document.getElementById('task-input');
const warning = document.getElementById('warning');
const filtersEl = document.getElementById('filters');
const listEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const counterEl = document.getElementById('counter');

// Палитра «цветов бумаги» для заметок — чисто оформительская вещь,
// цвет вычисляется из id задачи, а не хранится в данных
const NOTE_COLORS = ['#FFD23F', '#FF6FA5', '#45D0C6', '#B497F0', '#FF9F45'];

//  Состояние приложения 
// Задачи храним как массив объектов:
// { id: 1, text: 'Сделать лабу', completed: false }
let tasks = [
  { id: 1, text: 'Сделать лабораторную №3', completed: false },
  { id: 2, text: 'Выпить кофе', completed: true },
  { id: 3, text: 'Погулять на солнце', completed: false }
];

let nextId = tasks.length + 1;
let currentFilter = 'all'; // 'all' | 'active' | 'completed'

// Рендер
// Возвращает задачи, соответствующие текущему фильтру
function getFilteredTasks() {
  return tasks.filter((task) => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });
}

// Создаёт DOM-элемент одной задачи (через createElement, без innerHTML с текстом)
function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task' + (task.completed ? ' completed' : '');
  li.dataset.id = String(task.id);
  li.style.setProperty('--note-color', NOTE_COLORS[task.id % NOTE_COLORS.length]);

  const row = document.createElement('div');
  row.className = 'task__row';

  const checkBtn = document.createElement('button');
  checkBtn.type = 'button';
  checkBtn.className = 'task__check';
  checkBtn.dataset.action = 'toggle';
  checkBtn.setAttribute('aria-pressed', String(task.completed));
  checkBtn.setAttribute('aria-label', task.completed ? 'Снять отметку о выполнении' : 'Отметить задачу выполненной');
  checkBtn.textContent = task.completed ? '✓' : '';

  const textSpan = document.createElement('span');
  textSpan.className = 'task__text';
  textSpan.textContent = task.text;

  row.append(checkBtn, textSpan);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'task__delete';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.setAttribute('aria-label', 'Удалить задачу «' + task.text + '»');
  deleteBtn.textContent = '✕';

  li.append(row, deleteBtn);
  return li;
}

// Перерисовывает список на основе массива tasks и текущего фильтра
function render() {
  const filtered = getFilteredTasks();

  listEl.innerHTML = '';
  filtered.forEach((task) => {
    listEl.appendChild(createTaskElement(task));
  });

  emptyStateEl.hidden = filtered.length !== 0;
  updateCounter();
}

// Обновляет строку «Осталось: N, Выполнено: M»
function updateCounter() {
  const remaining = tasks.filter((task) => !task.completed).length;
  const done = tasks.filter((task) => task.completed).length;
  counterEl.textContent = `Осталось: ${remaining} · Выполнено: ${done}`;
}


// Действия с задачами

function addTask(text) {
  tasks.push({ id: nextId, text, completed: false });
  nextId += 1;
  render();
}

function toggleTask(id) {
  tasks = tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  render();
}


// Обработчики событий

// Добавление задачи — кнопка «Приклеить» и Enter работают через submit формы
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();

  if (!text) {
    warning.hidden = false;
    input.classList.add('is-shaking');
    input.addEventListener(
      'animationend',
      () => input.classList.remove('is-shaking'),
      { once: true }
    );
    input.focus();
    return;
  }

  warning.hidden = true;
  addTask(text);
  form.reset();
  input.focus();
});

// Прячем предупреждение, как только пользователь снова начал печатать
input.addEventListener('input', () => {
  if (!warning.hidden) warning.hidden = true;
});

// Клики по кнопкам «выполнено» / «удалить» — делегирование событий
listEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const li = button.closest('.task');
  const id = Number(li.dataset.id);

  if (button.dataset.action === 'toggle') {
    toggleTask(id);
  } else if (button.dataset.action === 'delete') {
    deleteTask(id);
  }
});

// Переключение фильтров
filtersEl.addEventListener('click', (event) => {
  const button = event.target.closest('.filters__btn');
  if (!button) return;

  currentFilter = button.dataset.filter;

  filtersEl.querySelectorAll('.filters__btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn === button);
  });

  render();
});

//  Первичная отрисовка -
render();
