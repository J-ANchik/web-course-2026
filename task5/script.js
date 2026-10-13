'use strict';

/* =====================================================================
   Лабораторная работа №5. Игра Simon («Симон говорит»)
   Архитектура: Объектно-ориентированная (без глобальных переменных)
   ===================================================================== */

class SimonGame {
  // 1. КОНСТАНТЫ КЛАССА (Статические свойства)
  static PADS_COUNT = 4;
  static LIGHT_MS = 500;
  static GAP_MS = 250;
  static BEFORE_SHOW_MS = 700;
  static NEXT_ROUND_DELAY_MS = 900;
  static PLAYER_FLASH_MS = 250;
  static ERROR_FLASH_MS = 700;

  static PHASE = {
    IDLE: 'idle',
    SHOWING: 'showing',
    INPUT: 'input',
    GAME_OVER: 'gameover'
  };

  static FREQUENCIES =[34,56,78,102, 120];
  static ERROR_FREQUENCY = 110;

  constructor() {
    // 2. СОСТОЯНИЕ ИГРЫ (Текущие свойства экземпляра)
    this.state = {
      phase: SimonGame.PHASE.IDLE,
      sequence: [],
      playerInput: [],
      runId: 0
    };

    this.timers = new Map();
    this.soundEnabled = true;
    this.audioCtx = null;

    // 3. ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ
    this.pads = Array.from(document.querySelectorAll('.pad'));
    this.startBtn = document.getElementById('start-btn');
    this.statusEl = document.getElementById('status');
    this.levelEl = document.getElementById('level');
    this.soundToggle = document.getElementById('sound-toggle');

    // Инициализация обработчиков событий
    this.initEvents();
    this.setPhase(SimonGame.PHASE.IDLE);
    this.updateLevel();
  }

  /* ---------------------------------------------------------------------
     4. УПРАВЛЕНИЕ ТАЙМЕРАМИ
     --------------------------------------------------------------------- */

  schedule(callback, ms, onCancel = null) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, ms);
    this.timers.set(id, onCancel);
    return id;
  }

  wait(ms) {
    return new Promise((resolve) => {
      this.schedule(() => resolve(true), ms, () => resolve(false));
    });
  }

  clearAllTimers() {
    for (const [id, onCancel] of this.timers) {
      clearTimeout(id);
      if (onCancel) {
        onCancel();
      }
    }
    this.timers.clear();
  }

  isStale(runId) {
    return runId !== this.state.runId;
  }

  /* ---------------------------------------------------------------------
     5. РАБОТА СО ЗВУКОМ
     --------------------------------------------------------------------- */

  initAudio() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (err) {
      this.audioCtx = null;
    }
  }

  playTone(frequency, durationMs) {
    if (!this.soundEnabled || !this.audioCtx) {
      return;
    }
    try {
      const now = this.audioCtx.currentTime;
      const duration = durationMs / 1000;

      const oscillator = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.connect(gain);
      gain.connect(this.audioCtx.destination);

      oscillator.start(now);
      oscillator.stop(now + duration + 0.05);
    } catch (err) {
      // Игнорируем ошибки звука
    }
  }

  /* ---------------------------------------------------------------------
     6. ФУНКЦИИ ИНТЕРФЕЙСА
     --------------------------------------------------------------------- */

  setStatus(text, kind = '') {
    this.statusEl.textContent = text;
    this.statusEl.className = 'status' + (kind ? ' status--' + kind : '');
  }

  updateLevel() {
    this.levelEl.textContent = this.state.sequence.length;
  }

  setPhase(phase) {
    this.state.phase = phase;
    const canClick = phase === SimonGame.PHASE.INPUT;
    this.pads.forEach((pad) => {
      pad.disabled = !canClick;
    });
  }

  lightPad(index, isOn) {
    if (this.pads[index]) {
      this.pads[index].classList.toggle('active', isOn);
    }
  }

  flashPad(index, ms) {
    this.lightPad(index, true);
    this.schedule(() => this.lightPad(index, false), ms);
  }

  clearHighlights() {
    this.pads.forEach((pad) => pad.classList.remove('active', 'error'));
  }

  /* ---------------------------------------------------------------------
     7. ЛОГИКА ИГРЫ
     --------------------------------------------------------------------- */

  randomIndex() {
    return Math.floor(Math.random() * SimonGame.PADS_COUNT);
  }

  async playSequence(sequence, runId) {
    for (const index of sequence) {
      if (this.isStale(runId)) {
        return false;
      }

      this.lightPad(index, true);
      this.playTone(SimonGame.FREQUENCIES[index], SimonGame.LIGHT_MS);

      if (!(await this.wait(SimonGame.LIGHT_MS))) {
        return false;
      }
      this.lightPad(index, false);

      if (!(await this.wait(SimonGame.GAP_MS))) {
        return false;
      }
    }
    return true;
  }

  async playRound(runId) {
    this.setPhase(SimonGame.PHASE.SHOWING);
    this.state.playerInput = [];
    this.updateLevel();
    this.setStatus('Запоминайте последовательность…');

    if (!(await this.wait(SimonGame.BEFORE_SHOW_MS)) || this.isStale(runId)) {
      return;
    }

    const finished = await this.playSequence(this.state.sequence.slice(), runId);
    if (!finished || this.isStale(runId)) {
      return;
    }

    this.setPhase(SimonGame.PHASE.INPUT);
    this.setStatus('Ваш ход: повторите последовательность');
  }

  async finishRoundSuccessfully() {
    const runId = this.state.runId;

    this.setPhase(SimonGame.PHASE.SHOWING);
    this.state.playerInput = [];
    this.setStatus('Верно! Следующий раунд…', 'ok');

    this.state.sequence.push(this.randomIndex());

    if (!(await this.wait(SimonGame.NEXT_ROUND_DELAY_MS)) || this.isStale(runId)) {
      return;
    }
    await this.playRound(runId);
  }

  endGame(wrongIndex) {
    this.clearAllTimers();
    this.state.runId += 1;

    this.setPhase(SimonGame.PHASE.GAME_OVER);

    this.clearHighlights();
    if (this.pads[wrongIndex]) {
      this.pads[wrongIndex].classList.add('error');
      this.playTone(SimonGame.ERROR_FREQUENCY, 500);
      this.schedule(() => this.pads[wrongIndex].classList.remove('error'), SimonGame.ERROR_FLASH_MS);
    }

    const level = this.state.sequence.length;
    this.setStatus('Игра окончена! Вы дошли до уровня ' + level, 'error');
    this.startBtn.textContent = 'Старт';
  }

  handlePadPress(index) {
    if (this.state.phase !== SimonGame.PHASE.INPUT) {
      return;
    }

    this.initAudio();

    const step = this.state.playerInput.length;

    if (index !== this.state.sequence[step]) {
      this.endGame(index);
      return;
    }

    this.state.playerInput.push(index);
    this.flashPad(index, SimonGame.PLAYER_FLASH_MS);
    this.playTone(SimonGame.FREQUENCIES[index], SimonGame.PLAYER_FLASH_MS);

    if (this.state.playerInput.length === this.state.sequence.length) {
      this.finishRoundSuccessfully();
    }
  }

  startGame() {
    this.initAudio();

    this.clearAllTimers();
    this.state.runId += 1;
    const runId = this.state.runId;
    this.clearHighlights();

    this.state.sequence = [this.randomIndex()];
    this.state.playerInput = [];

    this.startBtn.textContent = 'Начать заново';
    this.playRound(runId);
  }

  /* ---------------------------------------------------------------------
     8. ПОДКЛЮЧЕНИЕ ОБРАБОТЧИКОВ СОБЫТИЙ
     --------------------------------------------------------------------- */
  initEvents() {
    // Нажатия на сектора
    this.pads.forEach((pad) => {
      pad.addEventListener('click', () => {
        this.handlePadPress(Number(pad.dataset.index));
      });
    });

    // Кнопка «Старт»
    this.startBtn.addEventListener('click', () => this.startGame());

    // Чекбокс «Звук»
    this.soundToggle.addEventListener('change', () => {
      this.soundEnabled = this.soundToggle.checked;
    });

    // Клавиатура 1–4
    document.addEventListener('keydown', (event) => {
      if (event.repeat) {
        return;
      }
      const index = ['1', '2', '3', '4'].indexOf(event.key);
      if (index !== -1) {
        this.handlePadPress(index);
      }
    });
  }
}

// 9. ИНИЦИАЛИЗАЦИЯ ИГРЫ
// Создаем экземпляр игры при загрузке страницы. Глобальная область чиста.
document.addEventListener('DOMContentLoaded', () => {
  new SimonGame();
});
