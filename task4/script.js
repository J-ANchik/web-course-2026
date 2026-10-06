'use strict'; // строгий режим: JS сообщает о типичных ошибках, а не молча их пропускает

/* =====================================================================
   Лабораторная работа №4. Игра «Быки и коровы»
   ===================================================================== */

// ---------------------------------------------------------------------
// 1. Константы
// ---------------------------------------------------------------------
function main() {
   // Длина загадываемого числа (по заданию — 4 цифры)
   const CODE_LENGTH = 4;
   // Загаданное число. Храним СТРОКОЙ, чтобы не потерять ведущий ноль ("0572")
   let secret = '';
   // Флаг окончания игры: true после победы, пока не нажата «Новая игра»
   let isGameOver = false;
   
   const inputEl = document.getElementById('guess-input');       // поле ввода
   const checkBtn = document.getElementById('check-btn');        // кнопка «Проверить»
   const newGameBtn = document.getElementById('new-game-btn');   // кнопка «Новая игра»
   const attemptsEl = document.getElementById('attempts');       // счётчик попыток
   const messageEl = document.getElementById('message');         // сообщения об ошибке / победе
   const historyEl = document.getElementById('history');         // список истории
   const historyEmptyEl = document.getElementById('history-empty'); // подсказка при пустой истории
   
      // Кнопка «Новая игра»
   newGameBtn.addEventListener('click', startNewGame);
   
   // ---------------------------------------------------------------------
   // 8. Запуск: при загрузке страницы сразу начинаем новую игру
   // ---------------------------------------------------------------------
   startNewGame();
}

main();
// ---------------------------------------------------------------------
// 4. Функции игровой логики
// ---------------------------------------------------------------------

/**
 * Генерирует случайное число из CODE_LENGTH неповторяющихся цифр.
 * Способ: перемешиваем цифры 0–9 (алгоритм Фишера — Йетса) и берём первые 4.
 * Так повторы невозможны по построению — не нужно проверять и перегенерировать.
 * Ведущий ноль допустим (например, "0572"), поэтому результат — строка.
 * @returns {string} например "4071"
 */
function generateSecret() {
  // Массив цифр-строк: ['0', '1', ..., '9']
  const digits = Array.from({ length: 10 }, (_, i) => String(i));

  // Перемешивание Фишера — Йетса: идём с конца и меняем элемент
  // со случайным элементом, который стоит левее (или с ним самим)
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]]; // обмен значениями
  }

  // Берём первые CODE_LENGTH цифр и склеиваем в строку
  return digits.slice(0, CODE_LENGTH).join('');
}

/**
 * Проверяет ввод игрока.
 * Правила: только цифры, ровно 4 символа, все цифры разные.
 * @param {string} value — введённая строка (уже без пробелов по краям)
 * @returns {{valid: boolean, error: string}} valid=true — ввод корректен,
 *          иначе в error лежит текст ошибки для показа игроку
 */
function validateGuess(value) {
  // Пустой ввод
  if (value === '') {
    return { valid: false, error: 'Введите число из 4 разных цифр.' };
  }

  // Только цифры 0–9: любые буквы, пробелы и символы не проходят
  if (!/^[0-9]+$/.test(value)) {
    return { valid: false, error: 'Допустимы только цифры от 0 до 9 — без букв, пробелов и символов.' };
  }

  // Ровно CODE_LENGTH цифр
  if (value.length !== CODE_LENGTH) {
    return { valid: false, error: `Нужно ввести ровно ${CODE_LENGTH} цифры, а введено: ${value.length}.` };
  }

  // Все цифры разные: Set хранит только уникальные значения,
  // поэтому если размер Set меньше длины строки — есть повторы
  if (new Set(value).size !== CODE_LENGTH) {
    return { valid: false, error: 'Все цифры должны быть разными.' };
  }

  // Всё в порядке
  return { valid: true, error: '' };
}

/**
 * Считает быков и коров.
 * Бык  — цифра совпала и по значению, и по позиции.
 * Корова — цифра есть в загаданном числе, но стоит на другой позиции.
 * Так как в обоих числах цифры не повторяются, двойного счёта не возникает.
 * @param {string} secretCode — загаданное число
 * @param {string} guess — попытка игрока
 * @returns {{bulls: number, cows: number}}
 */
function countBullsAndCows(secretCode, guess) {
  let bulls = 0;
  let cows = 0;

  // Проходим по позициям и сравниваем цифры
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (guess[i] === secretCode[i]) {
      bulls++;                              // цифра на своём месте
    } else if (secretCode.includes(guess[i])) {
      cows++;                               // цифра есть, но на другом месте
    }
  }

  return { bulls, cows };
}

// ---------------------------------------------------------------------
// 5. Вспомогательные функции для текста
// ---------------------------------------------------------------------

/**
 * Выбирает правильную форму слова для числа n (русское склонение).
 * Пример: 1 бык, 2 быка, 5 быков.
 * @param {number} n — число
 * @param {string} one — форма для 1 (бык)
 * @param {string} few — форма для 2–4 (быка)
 * @param {string} many — форма для 0, 5–20 и т.д. (быков)
 */
function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return one;                              // 1, 21, 31...
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;  // 2–4, 22–24...
  return many;                                                               // 0, 5–20, 25–30...
}

// Текст про быков: "1 бык", "2 быка", "0 быков"
function formatBulls(n) {
  return `${n} ${pluralize(n, 'бык', 'быка', 'быков')}`;
}

// Текст про коров: "1 корова", "2 коровы", "0 коров"
function formatCows(n) {
  return `${n} ${pluralize(n, 'корова', 'коровы', 'коров')}`;
}

// ---------------------------------------------------------------------
// 6. Отрисовка (интерфейс строится из массива history)
// ---------------------------------------------------------------------

/**
 * Создаёт <span> с классом и текстом — маленький помощник для render().
 */
function createSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

/**
 * Создаёт <li> для одной попытки: "1234 → 1 бык, 2 коровы".
 * @param {{guess: string, bulls: number, cows: number}} entry — запись из history
 */
function createHistoryItem(entry) {
  const li = document.createElement('li');

  // Выигрышная попытка (4 быка) подсвечивается отдельным классом
  if (entry.bulls === CODE_LENGTH) {
    li.classList.add('win');
  }

  // Собираем строку из частей, чтобы покрасить быков и коров по-разному
  li.append(
    createSpan('guess', entry.guess),
    ' → ',
    createSpan('bulls', formatBulls(entry.bulls)),
    ', ',
    createSpan('cows', formatCows(entry.cows))
  );

  return li;
}

/**
 * Перерисовывает интерфейс целиком на основе текущего состояния
 * (массив history и флаг isGameOver). Вызывается после любого изменения данных.
 */
function render() {
  // Счётчик попыток = количество записей в истории
  attemptsEl.textContent = history.length;

  // История: map превращает каждую запись массива в <li>,
  // replaceChildren заменяет старое содержимое списка новым
  historyEl.replaceChildren(...history.map(createHistoryItem));

  // Пока попыток нет — показываем подсказку вместо пустого списка
  historyEmptyEl.hidden = history.length > 0;

  // Прокручиваем историю вниз, чтобы была видна последняя попытка
  historyEl.scrollTop = historyEl.scrollHeight;

  // После победы блокируем ввод до нажатия «Новая игра»
  inputEl.disabled = isGameOver;
  checkBtn.disabled = isGameOver;
}

/**
 * Показывает сообщение игроку.
 * @param {string} text — текст (пустая строка очищает сообщение)
 * @param {string} type — 'error' | 'success' | '' — влияет на оформление
 */
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = type ? `message ${type}` : 'message';
}

// ---------------------------------------------------------------------
// 7. Обработчики событий
// ---------------------------------------------------------------------

/**
 * Нажатие «Проверить» (или Enter в поле ввода).
 * Сам обработчик короткий: он только связывает функции, написанные выше —
 * валидацию, подсчёт и отрисовку.
 */
function handleCheck() {
  // Если игра уже выиграна — попытки не принимаем
  if (isGameOver) return;

  // Убираем случайные пробелы по краям
  const value = inputEl.value.trim();

  // 1) Валидация. При ошибке выводим сообщение, попытка НЕ засчитывается
  const validation = validateGuess(value);
  if (!validation.valid) {
    showMessage(validation.error, 'error');
    inputEl.focus();
    inputEl.select(); // выделяем ввод, чтобы его можно было сразу перезаписать
    return;
  }

  // 2) Подсчёт быков и коров
  const { bulls, cows } = countBullsAndCows(secret, value);

  // 3) Сохраняем попытку в массив состояния
  history.push({ guess: value, bulls, cows });

  // 4) Проверка победы
  if (bulls === CODE_LENGTH) {
    isGameOver = true;
    const n = history.length;
    showMessage(`Победа! Угадано за ${n} ${pluralize(n, 'попытку', 'попытки', 'попыток')}`, 'success');
  } else {
    showMessage('', ''); // убираем прошлую ошибку, если она была
  }

  // 5) Очищаем поле и перерисовываем интерфейс
  inputEl.value = '';
  render();

  // Возвращаем фокус в поле ввода, только если игра продолжается.
  // После победы фокус на «Новая игра» НЕ переводим: иначе то же самое нажатие Enter
  // сработало бы уже на этой кнопке и игра сразу началась бы заново.
  if (!isGameOver) {
    inputEl.focus();
  }
}

/**
 * «Новая игра» (и первый запуск при загрузке страницы):
 * сбрасывает загаданное число, историю и счётчик.
 */
function startNewGame() {
  secret = generateSecret();   // новое загаданное число
  history = [];                // пустая история (счётчик попыток обнулится сам)
  isGameOver = false;          // игра снова идёт

  inputEl.value = '';
  showMessage('', '');
  render();
  inputEl.focus();

  // Отладка: загаданное число в консоли (F12), чтобы можно было
  // проверить подсчёт быков и коров вручную. Перед сдачей можно удалить.
  console.log('Загаданное число (для проверки):', secret);
}

// Кнопка «Проверить»
checkBtn.addEventListener('click', handleCheck);

// Enter в поле ввода делает то же самое, что и кнопка
inputEl.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    event.preventDefault(); // отменяем стандартную реакцию браузера на Enter
    handleCheck();
  }
});


