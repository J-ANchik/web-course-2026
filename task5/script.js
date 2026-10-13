'use strict';

/* =====================================================================
   Лабораторная работа №5. Игра Simon («Симон говорит»)

   Как устроена игра:
   1. По кнопке «Старт» генерируется последовательность из 1 элемента (0–3).
   2. Компьютер «проигрывает» её: по очереди подсвечивает сектора.
   3. Игрок повторяет последовательность кликами. Пока идёт показ — клики
      игнорируются.
   4. Верно повторил — к последовательности добавляется ещё один случайный
      элемент, и она показывается заново с самого начала.
   5. Ошибся — игра заканчивается, выводится достигнутый уровень.

   Главное требование по таймерам: setInterval здесь не используется вообще,
   а все setTimeout регистрируются в одном месте (реестр `timers`), поэтому
   при ошибке или перезапуске игры их можно разом отменить — «зависших»
   таймеров и наложения старых последовательностей на новые не будет.
   ===================================================================== */




const PADS_COUNT = 4;            // количество цветных секторов
const LIGHT_MS = 500;            // сколько подсвечивается сектор при показе
const GAP_MS = 250;              // пауза между подсветками при показе
const BEFORE_SHOW_MS = 700;      // пауза перед началом показа последовательности
const NEXT_ROUND_DELAY_MS = 900; // пауза между успешным раундом и следующим
const PLAYER_FLASH_MS = 250;     // длительность подсветки при клике игрока
const ERROR_FLASH_MS = 700;      // длительность подсветки ошибочного сектора

// Возможные фазы игры. Именно по ним (а не по CSS-классам) программа
// понимает, можно ли сейчас принимать клики.
const PHASE = {
  IDLE: 'idle',           // игра ещё не начиналась
  SHOWING: 'showing',     // компьютер показывает последовательность
  INPUT: 'input',         // ждём ввод игрока
  GAME_OVER: 'gameover'   // игрок ошибся
};

// Частоты звуков для каждого сектора (Гц): до, ми, соль, до следующей октавы
const FREQUENCIES = [262, 330, 392, 523];
const ERROR_FREQUENCY = 110; // низкий звук при ошибке


/* ---------------------------------------------------------------------
   2. СОСТОЯНИЕ ИГРЫ
   Всё хранится в обычном объекте, а не «угадывается» по DOM/CSS.
   --------------------------------------------------------------------- */

const state = {
  phase: PHASE.IDLE,  // текущая фаза (флаг «идёт показ / ждём ввод» и т.д.)
  sequence: [],       // загаданная последовательность, например [2, 0, 3]
  playerInput: [],    // то, что игрок уже ввёл в текущем раунде
  runId: 0            // номер текущей партии; растёт при каждом старте/конце игры
};

// Реестр активных таймеров: id таймера -> функция, которую нужно вызвать
// при отмене (или null). Нужен, чтобы уметь остановить ВСЕ таймеры разом.
const timers = new Map();

let soundEnabled = true; // включён ли звук (чекбокс «Звук»)
let audioCtx = null;     // AudioContext создаётся лениво, после первого клика


/* ---------------------------------------------------------------------
   3. ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ
   --------------------------------------------------------------------- */

const pads = Array.from(document.querySelectorAll('.pad')); // 4 сектора по порядку 0..3
const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');
const levelEl = document.getElementById('level');
const soundToggle = document.getElementById('sound-toggle');


/* ---------------------------------------------------------------------
   4. ТАЙМЕРЫ
   Все задержки в игре проходят через эти две функции.
   --------------------------------------------------------------------- */

/**
 * Запускает setTimeout и записывает его в реестр timers.
 * Когда таймер сработает, он сам удалит себя из реестра.
 * @param {Function} callback  - что выполнить по истечении времени
 * @param {number} ms          - задержка в миллисекундах
 * @param {Function|null} onCancel - что вызвать, если таймер отменят досрочно
 * @returns {number} id таймера
 */
function schedule(callback, ms, onCancel = null) {
  const id = setTimeout(() => {
    timers.delete(id); // таймер отработал — убираем из реестра
    callback();
  }, ms);
  timers.set(id, onCancel);
  return id;
}

/**
 * Пауза в виде Promise, чтобы можно было писать `await wait(500)`.
 * Promise разрешается значением:
 *   true  — время вышло штатно;
 *   false — паузу отменили (игра перезапущена или закончилась).
 * Благодаря этому «зависших» ожиданий не остаётся: отменённая цепочка
 * получает false и спокойно завершается.
 */
function wait(ms) {
  return new Promise((resolve) => {
    schedule(() => resolve(true), ms, () => resolve(false));
  });
}

/**
 * Отменяет ВСЕ активные таймеры и очищает реестр.
 * Вызывается при новом старте и при окончании игры.
 */
function clearAllTimers() {
  for (const [id, onCancel] of timers) {
    clearTimeout(id);
    if (onCancel) {
      onCancel(); // сообщаем ожидающему коду, что паузу отменили
    }
  }
  timers.clear();
}

/**
 * Устарела ли «партия» с номером runId.
 * Если игрок успел нажать «Старт» заново, runId в state уже другой,
 * и старая цепочка показа обязана прекратить работу.
 */
function isStale(runId) {
  return runId !== state.runId;
}


/* ---------------------------------------------------------------------
   5. ЗВУК (по желанию)
   Звук строится через AudioContext и не блокирует игру: тон запускается
   и играет сам по себе, а код сразу идёт дальше.
   --------------------------------------------------------------------- */

/**
 * Создаёт AudioContext (если его ещё нет) и «будит» его.
 * Браузеры разрешают звук только после действия пользователя, поэтому
 * вызываем эту функцию из обработчиков кликов.
 */
function initAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (err) {
    // Звук не критичен: если что-то пошло не так, просто играем без него
    audioCtx = null;
  }
}

/**
 * Проигрывает короткий тон заданной частоты.
 * @param {number} frequency - частота в Гц
 * @param {number} durationMs - длительность в миллисекундах
 */
function playTone(frequency, durationMs) {
  if (!soundEnabled || !audioCtx) {
    return;
  }
  try {
    const now = audioCtx.currentTime;
    const duration = durationMs / 1000;

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    // Плавное нарастание и затухание громкости, чтобы не было щелчков
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  } catch (err) {
    // Игнорируем ошибки звука — на логику игры они влиять не должны
  }
}


/* ---------------------------------------------------------------------
   6. ФУНКЦИИ ИНТЕРФЕЙСА
   --------------------------------------------------------------------- */

/**
 * Показывает сообщение в строке статуса.
 * @param {string} text - текст сообщения
 * @param {string} [kind] - '', 'ok' или 'error' (влияет только на цвет)
 */
function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = 'status' + (kind ? ' status--' + kind : '');
}

/** Выводит текущий уровень (он равен длине последовательности). */
function updateLevel() {
  levelEl.textContent = state.sequence.length;
}

/**
 * Переключает фазу игры и блокирует/разблокирует кнопки.
 * Кликать по секторам можно только в фазе INPUT.
 */
function setPhase(phase) {
  state.phase = phase;
  const canClick = phase === PHASE.INPUT;
  pads.forEach((pad) => {
    pad.disabled = !canClick;
  });
}

/** Включает или выключает подсветку сектора (класс .active). */
function lightPad(index, isOn) {
  pads[index].classList.toggle('active', isOn);
}

/** Кратковременно подсвечивает сектор — используется для кликов игрока. */
function flashPad(index, ms) {
  lightPad(index, true);
  schedule(() => lightPad(index, false), ms);
}

/** Снимает подсветку и отметку ошибки со всех секторов. */
function clearHighlights() {
  pads.forEach((pad) => pad.classList.remove('active', 'error'));
}


/* ---------------------------------------------------------------------
   7. ЛОГИКА ИГРЫ
   --------------------------------------------------------------------- */

/** Возвращает случайный номер сектора от 0 до 3. */
function randomIndex() {
  return Math.floor(Math.random() * PADS_COUNT);
}

/**
 * Показывает последовательность: по очереди подсвечивает сектора с паузами.
 * Очередь показа реализована через async/await + Promise + setTimeout.
 *
 * @param {number[]} sequence - что показывать
 * @param {number} runId - номер партии, для которой запущен показ
 * @returns {Promise<boolean>} true — показ дошёл до конца,
 *                             false — его прервали (рестарт или конец игры)
 */
async function playSequence(sequence, runId) {
  for (const index of sequence) {
    if (isStale(runId)) {
      return false;
    }

    // Включаем подсветку и звук
    lightPad(index, true);
    playTone(FREQUENCIES[index], LIGHT_MS);

    // Ждём время подсветки; false значит, что паузу отменили
    if (!(await wait(LIGHT_MS))) {
      return false;
    }
    lightPad(index, false);

    // Пауза между подсветками
    if (!(await wait(GAP_MS))) {
      return false;
    }
  }
  return true;
}

/**
 * Один раунд: показываем текущую последовательность и передаём ход игроку.
 * @param {number} runId - номер партии, чтобы прервать работу, если она устарела
 */
async function playRound(runId) {
  // На время показа блокируем клики
  setPhase(PHASE.SHOWING);
  state.playerInput = [];
  updateLevel();
  setStatus('Запоминайте последовательность…');

  // Небольшая пауза перед началом показа
  if (!(await wait(BEFORE_SHOW_MS)) || isStale(runId)) {
    return;
  }

  // Копия массива — чтобы показ не зависел от возможных изменений state.sequence
  const finished = await playSequence(state.sequence.slice(), runId);
  if (!finished || isStale(runId)) {
    return; // показ прервали — ход игроку не передаём
  }

  // Показ завершён — разрешаем ввод
  setPhase(PHASE.INPUT);
  setStatus('Ваш ход: повторите последовательность');
}

/**
 * Игрок правильно повторил всю последовательность:
 * добавляем новый случайный элемент и запускаем следующий раунд.
 */
async function finishRoundSuccessfully() {
  const runId = state.runId;

  // Сразу блокируем клики, пока не начался следующий показ,
  // и очищаем ввод игрока — в новом раунде он начнёт с нуля
  setPhase(PHASE.SHOWING);
  state.playerInput = [];
  setStatus('Верно! Следующий раунд…', 'ok');

  // К последовательности добавляется ещё один случайный элемент
  state.sequence.push(randomIndex());

  if (!(await wait(NEXT_ROUND_DELAY_MS)) || isStale(runId)) {
    return;
  }
  await playRound(runId);
}

/**
 * Игрок ошибся: останавливаем все таймеры, блокируем кнопки, выводим счёт.
 * @param {number} wrongIndex - сектор, по которому кликнул игрок
 */
function endGame(wrongIndex) {
  // 1. Гасим все таймеры и делаем текущую партию «устаревшей»
  clearAllTimers();
  state.runId += 1;

  // 2. Блокируем кнопки до повторного нажатия «Старт»
  setPhase(PHASE.GAME_OVER);

  // 3. Показываем, где произошла ошибка
  clearHighlights();
  pads[wrongIndex].classList.add('error');
  playTone(ERROR_FREQUENCY, 500);
  schedule(() => pads[wrongIndex].classList.remove('error'), ERROR_FLASH_MS);

  // 4. Выводим достигнутый результат — уровень равен длине последовательности
  const level = state.sequence.length;
  setStatus('Игра окончена! Вы дошли до уровня ' + level, 'error');
  startBtn.textContent = 'Старт';
}

/**
 * Обработчик нажатия на сектор (мышью или клавишей 1–4).
 * @param {number} index - номер нажатого сектора (0–3)
 */
function handlePadPress(index) {
  // Во время показа (и до старта / после конца игры) клики не засчитываются
  if (state.phase !== PHASE.INPUT) {
    return;
  }

  initAudio();

  // Какой элемент игрок должен нажать сейчас
  const step = state.playerInput.length;

  // Ошибка: игра завершается
  if (index !== state.sequence[step]) {
    endGame(index);
    return;
  }

  // Верный шаг: запоминаем его, подсвечиваем сектор и играем звук
  state.playerInput.push(index);
  flashPad(index, PLAYER_FLASH_MS);
  playTone(FREQUENCIES[index], PLAYER_FLASH_MS);

  // Если введена вся последовательность — раунд пройден
  if (state.playerInput.length === state.sequence.length) {
    finishRoundSuccessfully();
  }
}

/**
 * Начало новой игры (кнопка «Старт»). Можно нажимать и посреди партии:
 * старые таймеры будут отменены, а старый показ — прерван.
 */
function startGame() {
  initAudio(); // клик по «Старт» — подходящий момент для запуска звука

  // Останавливаем всё, что осталось от предыдущей партии
  clearAllTimers();
  state.runId += 1;
  const runId = state.runId;
  clearHighlights();

  // Новая партия: последовательность из одного случайного элемента
  state.sequence = [randomIndex()];
  state.playerInput = [];

  startBtn.textContent = 'Начать заново';
  playRound(runId);
}


/* ---------------------------------------------------------------------
   8. ПОДКЛЮЧЕНИЕ ОБРАБОТЧИКОВ СОБЫТИЙ
   --------------------------------------------------------------------- */

// Клики по секторам
pads.forEach((pad) => {
  pad.addEventListener('click', () => {
    handlePadPress(Number(pad.dataset.index));
  });
});

// Кнопка «Старт»
startBtn.addEventListener('click', startGame);

// Чекбокс «Звук»
soundToggle.addEventListener('change', () => {
  soundEnabled = soundToggle.checked;
});

// Клавиши 1–4 работают как клики по секторам 0–3
document.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return; // игнорируем автоповтор при удержании клавиши
  }
  const index = ['1', '2', '3', '4'].indexOf(event.key);
  if (index !== -1) {
    handlePadPress(index);
  }
});


/* ---------------------------------------------------------------------
   9. НАЧАЛЬНОЕ СОСТОЯНИЕ
   --------------------------------------------------------------------- */

setPhase(PHASE.IDLE);
updateLevel();
