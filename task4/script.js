'use strict'; // строгий режим: JS сообщает о типичных ошибках, а не молча их пропускает

/* =====================================================================
   Лабораторная работа №4. Игра «Быки и коровы»
   ===================================================================== */

function main() {
  // ---------------------------------------------------------------------
  // 1. Константы и состояние приложения (внутри main)
  // ---------------------------------------------------------------------
  
  // Длина загадываемого числа (по заданию — 4 цифры)
  const CODE_LENGTH = 4;

  // Загаданное число. Храним СТРОКОЙ, чтобы не потерять ведущий ноль ("0572")
  let secret = '';

  // История попыток — массив объектов: { guess: "1234", bulls: 1, cows: 2 }
  let history = [];

  // Флаг окончания игры: true после победы, пока не нажата «Новая игра»
  let isGameOver = false;

  // ---------------------------------------------------------------------
  // 2. Ссылки на элементы страницы (внутри main)
  // ---------------------------------------------------------------------
  const inputEl = document.getElementById('guess-input');       // поле ввода
  const checkBtn = document.getElementById('check-btn');        // кнопка «Проверить»
  const newGameBtn = document.getElementById('new-game-btn');   // кнопка «Новая игра»
  const attemptsEl = document.getElementById('attempts');       // счётчик попыток
  const messageEl = document.getElementById('message');         // сообщения об ошибке / победе
  const historyEl = document.getElementById('history');         // список истории
  const historyEmptyEl = document.getElementById('history-empty'); // подсказка при пустой истории

  // ---------------------------------------------------------------------
  // 3. Внутренние функции интерфейса (имеют доступ к переменным выше)
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
   * Перерисовывает интерфейс целиком на основе текущего состояния.
   */
  function render() {
    // Счётчик попыток = количество записей в истории
    attemptsEl.textContent = history.length;

    // История: заменяем старое содержимое списка новым
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
   */
  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = type ? `message ${type}` : 'message';
  }

  /**
   * Нажатие «Проверить» (или Enter в поле ввода).
   */
  function handleCheck() {
    if (isGameOver) return;

    // Убираем случайные пробелы по краям
    const value = inputEl.value.trim();

    // 1) Валидация. При ошибке выводим сообщение, попытка НЕ засчитывается
    const validation = validateGuess(value, CODE_LENGTH);
    if (!validation.valid) {
      showMessage(validation.error, 'error');
      inputEl.focus();
      inputEl.select(); // выделяем ввод, чтобы его можно было сразу перезаписать
      return;
    }

    // 2) Подсчёт быков и коров
    const { bulls, cows } = countBullsAndCows(secret, value, CODE_LENGTH);

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

    // Куда передать фокус: в поле ввода — или на «Новая игра» после победы
    if (isGameOver) {
      newGameBtn.focus();
    } else {
      inputEl.focus();
    }
  }

  /**
   * «Новая игра» (и первый запуск при загрузке страницы):
   * сбрасывает загаданное число, историю и счётчик.
   */
  function startNewGame() {
    secret = generateSecret(CODE_LENGTH); // новое загаданное число
    history = [];                         // пустая история
    isGameOver = false;                   // игра снова идёт

    inputEl.value = '';
    showMessage('', '');
    render();
    inputEl.focus();

    // Отладка в консоли
    console.log('Загаданное число (для проверки):', secret);
  }

  // ---------------------------------------------------------------------
  // 4. Навешивание обработчиков событий (внутри main)
  // ---------------------------------------------------------------------
  checkBtn.addEventListener('click', handleCheck);

  inputEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault(); // предотвращаем лишние действия браузера
      handleCheck();
    }
  });

  newGameBtn.addEventListener('click', startNewGame);

  // ---------------------------------------------------------------------
  // 5. Запуск игры при вызове main
  // ---------------------------------------------------------------------
  startNewGame();
}

// Запуск всей программы
main();


// =====================================================================
// Чистые функции игровой логики и текста (остаются СНАРУЖИ функции main)
// =====================================================================

function generateSecret(codeLength) {
  const digits = Array.from({ length: 10 }, (_, i) => String(i));
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, codeLength).join('');
}

function validateGuess(value, codeLength) {
  if (value === '') {
    return { valid: false, error: 'Введите число из 4 разных цифр.' };
  }
  if (!/^[0-9]+\$/.test(value)) {
    return { valid: false, error: 'Допустимы только цифры от 0 до 9 — без букв, пробелов и символов.' };
  }
  if (value.length !== codeLength) {
    return { valid: false, error: `Нужно ввести ровно ${codeLength} цифры, а введено: ${value.length}.` };
  }
  if (new Set(value).size !== codeLength) {
    return { valid: false, error: 'Все цифры должны быть разными.' };
  }
  return { valid: true, error: '' };
}

function countBullsAndCows(secretCode, guess, codeLength) {
  let bulls = 0;
  let cows = 0;
  for (let i = 0; i < codeLength; i++) {
    if (guess[i] === secretCode[i]) {
      bulls++;
    } else if (secretCode.includes(guess[i])) {
      cows++;
    }
  }
  return { bulls, cows };
}

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function formatBulls(n) {
  return `${n} ${pluralize(n, 'бык', 'быка', 'быков')}`;
}

function formatCows(n) {
  return `${n} ${pluralize(n, 'корова', 'коровы', 'коров')}`;
}
