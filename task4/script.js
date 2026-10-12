'use strict'; // строгий режим: JS сообщает о типичных ошибках, а не молча их пропускает

/* =====================================================================
   Лабораторная работа №4. Игра «Быки и коровы»
   ===================================================================== */

function main() {
   // ---------------------------------------------------------------------
   // 1. Константы и состояние игры (внутри main)
   // ---------------------------------------------------------------------
   const CODE_LENGTH = 4; // Длина загадываемого числа
   let secret = '';       // Загаданное число
   let isGameOver = false;// Флаг окончания игры
   let history = [];      // Массив истории попыток (теперь переменная объявлена правильно)

   // DOM-элементы
   const inputEl = document.getElementById('guess-input');
   const checkBtn = document.getElementById('check-btn');
   const newGameBtn = document.getElementById('new-game-btn');
   const attemptsEl = document.getElementById('attempts');
   const messageEl = document.getElementById('message');
   const historyEl = document.getElementById('history');
   const historyEmptyEl = document.getElementById('history-empty');
   
   // ---------------------------------------------------------------------
   // 2. Внутренние функции (имеют доступ ко всем переменным выше благодаря замыканию)
   // ---------------------------------------------------------------------

   /**
    * Перерисовывает интерфейс целиком на основе текущего состояния.
    */
   function render() {
     attemptsEl.textContent = history.length;
     historyEl.replaceChildren(...history.map(createHistoryItem));
     historyEmptyEl.hidden = history.length > 0;
     historyEl.scrollTop = historyEl.scrollHeight;
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

     const value = inputEl.value.trim();

     // Используем внешнюю функцию валидации, передавая CODE_LENGTH
     const validation = validateGuess(value, CODE_LENGTH);
     if (!validation.valid) {
       showMessage(validation.error, 'error');
       inputEl.focus();
       inputEl.select();
       return;
     }

     // Используем внешнюю функцию подсчета
     const { bulls, cows } = countBullsAndCows(secret, value, CODE_LENGTH);

     history.push({ guess: value, bulls, cows });

     if (bulls === CODE_LENGTH) {
       isGameOver = true;
       const n = history.length;
       showMessage(`Победа! Угадано за ${n} ${pluralize(n, 'попытку', 'попытки', 'попыток')}`, 'success');
     } else {
       showMessage('', '');
     }

     inputEl.value = '';
     render();

     if (!isGameOver) {
       inputEl.focus();
     }
   }

   /**
    * «Новая игра»: сбрасывает загаданное число, историю и счётчик.
    */
   function startNewGame() {
     // Используем внешнюю функцию генерации
     secret = generateSecret(CODE_LENGTH);   
     history = [];                
     isGameOver = false;          

     inputEl.value = '';
     showMessage('', '');
     render();
     inputEl.focus();

     console.log('Загаданное число (для проверки):', secret);
   }

   // ---------------------------------------------------------------------
   // 3. Навешивание обработчиков событий (внутри main)
   // ---------------------------------------------------------------------
   newGameBtn.addEventListener('click', startNewGame);
   checkBtn.addEventListener('click', handleCheck);

   inputEl.addEventListener('keydown', function (event) {
     if (event.key === 'Enter') {
       event.preventDefault();
       handleCheck();
     }
   });

   // ---------------------------------------------------------------------
   // 4. Старт игры при вызове main
   // ---------------------------------------------------------------------
   startNewGame();
}

// Запуск всей программы
main(); 


// =====================================================================
// Чистые функции общего назначения (остаются СНАРУЖИ функции main)
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

function createSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function createHistoryItem(entry) {
  const li = document.createElement('li');
  // Здесь CODE_LENGTH заменена на фиксированную 4, так как функция снаружи
  if (entry.bulls === 4) { 
    li.classList.add('win');
  }
  li.append(
    createSpan('guess', entry.guess),
    ' → ',
    createSpan('bulls', formatBulls(entry.bulls)),
    ', ',
    createSpan('cows', formatCows(entry.cows))
  );
  return li;
}
