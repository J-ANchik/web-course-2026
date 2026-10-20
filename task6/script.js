// Лабораторная работа №6. Игра на Canvas («Змейка»)

(function () {
  'use strict'; 

  
  const CONFIG = {
    CELL_SIZE: 20,        // размер клетки в пикселях
    GRID_SIZE: 20,        // поле 20×20 клеток => 400×400 px
    INITIAL_LENGTH: 3,    // старт длина змейки
    MOVE_INTERVAL: 150,   //скорость  шаг змейки раз в 150 мс
    COLORS: {
      background: '#d9f7e8',
      grid: '#bfeadb', // сетка
      snakeHead: '#ff2e93',
      snakeBody: '#6c2bd9',
      apple: '#ff7a00',
      overlay: 'rgba(20, 33, 61, 0.8)',
      text: '#ffffff'// плавно затемняет всё игровое поле, чтобы текст «Игра окончена»
    } 
  };

  const KEY_DIRECTIONS = { // какая клавиша напрвляет вектор
    ArrowUp:    { x: 0,  y: -1 },
    ArrowDown:  { x: 0,  y: 1 },
    ArrowLeft:  { x: -1, y: 0 },
    ArrowRight: { x: 1,  y: 0 }
  };


  // Одинаковые ли клетки
  function isSamePosition(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  // Противоположные ли направления (сумма векторов равна нулю: вправо + влево)
  function isOppositeDirection(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  // 3. MODEL — состояние и правила игры
  class SnakeModel {
    // Приватные поля: снаружи состояние можно прочитать только через getSnapshot()
    #gridSize;
    #initialLength;
    #snake = []; // сегменты {x, y} в клетках; #snake[0] — голова
    #direction = { x: 1, y: 0 }; // направление последнего реального шага
    #nextDirection = { x: 1, y: 0 };  // направление, выбранное игроком для следующего шага
    #apple = null;  // координаты яблока {x, y}
    #score = 0;     // счёт = число съеденных яблок
    #gameOver = false;  // флаг окончания игры
    #isWin = false; // true, если змейка заняла всё поле

    constructor(gridSize, initialLength) {
      this.#gridSize = gridSize;
      this.#initialLength = initialLength;
      this.reset();                   // сразу готовим новую игру
    }

    get isGameOver() {
      return this.#gameOver;
    }

    // Начать новую игру
    reset() {
      const startX = Math.floor(this.#gridSize / 2);
      const startY = Math.floor(this.#gridSize / 2);

      this.#snake = [];
      for (let i = 0; i < this.#initialLength; i++) {
        this.#snake.push({ x: startX - i, y: startY });   // голова в центре, хвост левее
      }

      this.#direction = { x: 1, y: 0 };                   // начинаем движение вправо
      this.#nextDirection = { x: 1, y: 0 };
      this.#score = 0;
      this.#gameOver = false;
      this.#isWin = false;
      this.#spawnApple();
    }

    // Запоминает направление, выбранное игроком
    setDirection(newDirection) {
      if (this.#gameOver) {
        return;
      }
      // Выбранный вариант: разворот на 180° ИГНОРИРУЕТСЯ.
      // Сравниваем с #direction (реальным последним ходом), а не с #nextDirection:
      // так быстрые нажатия «вверх, потом влево» при движении вправо не приведут к развороту.
      if (isOppositeDirection(newDirection, this.#direction)) {
        return;
      }
      this.#nextDirection = newDirection;                 // применится на ближайшем шаге в update()
    }

    // Один шаг игры. Вызывается контроллером раз в MOVE_INTERVAL мс
    update() {
      if (this.#gameOver) {
        return;
      }

      this.#direction = this.#nextDirection;              // применяем выбор игрока ровно один раз за шаг

      const newHead = this.#getNextHead();
      const willEat = this.#apple !== null && isSamePosition(newHead, this.#apple);   // попала ли голова на яблоко

      if (this.#checkCollision(newHead, willEat)) {
        this.#gameOver = true;                            // стена или хвост — конец игры
        return;
      }

      this.#moveSnake(newHead, willEat);

      if (willEat) {
        this.#score += 1;                                 // +1 к счёту за яблоко
        this.#spawnApple();                               // яблоко ставится после роста, поэтому не попадёт на тело
      }
    }

    // Копия данных для View: View не может изменить состояние модели
    getSnapshot() {
      return {
        snake: this.#snake.map(segment => ({ ...segment })),
        apple: this.#apple ? { ...this.#apple } : null,
        score: this.#score,
        gameOver: this.#gameOver,
        isWin: this.#isWin
      };
    }

    // Клетка, в которую придёт голова на этом шаге
    #getNextHead() {
      const head = this.#snake[0];
      return { x: head.x + this.#direction.x, y: head.y + this.#direction.y };
    }

    // Столкновение новой головы со стеной или телом; willGrow — съест ли змейка яблоко
    #checkCollision(newHead, willGrow) {
      const hitWall =
        newHead.x < 0 || newHead.x >= this.#gridSize ||
        newHead.y < 0 || newHead.y >= this.#gridSize;     // вышли за границы поля
      if (hitWall) {
        return true;
      }
      // Если змейка не растёт, кончик хвоста освободит клетку на этом шаге — его не проверяем
      const bodyToCheck = willGrow ? this.#snake : this.#snake.slice(0, -1);
      return bodyToCheck.some(segment => isSamePosition(segment, newHead));
    }

    // Сдвиг змейки: новая голова в начало, хвост убираем (если не растём)
    #moveSnake(newHead, willGrow) {
      this.#snake.unshift(newHead);                       // добавили голову
      if (!willGrow) {
        this.#snake.pop();                                // убрали хвост — длина прежняя
      }
    }

    // Яблоко в случайной СВОБОДНОЙ клетке
    #spawnApple() {
      const freeCells = [];
      for (let x = 0; x < this.#gridSize; x++) {
        for (let y = 0; y < this.#gridSize; y++) {
          const isBusy = this.#snake.some(segment => isSamePosition(segment, { x, y }));
          if (!isBusy) {
            freeCells.push({ x, y });                     // собираем только клетки без змейки
          }
        }
      }

      if (freeCells.length === 0) {                       // свободных клеток нет — победа
        this.#apple = null;
        this.#isWin = true;
        this.#gameOver = true;
        return;
      }

      this.#apple = freeCells[Math.floor(Math.random() * freeCells.length)];   // выбор из списка исключает зависание поиска
    }
  }


  // 4. VIEW — Canvas и HTML (только отображение, логики игры нет)
  class SnakeView {
    #canvas;
    #ctx;
    #scoreEl;
    #restartBtn;
    #config;

    constructor(canvas, scoreEl, restartBtn, config) {
      this.#canvas = canvas;
      this.#ctx = canvas.getContext('2d');                // контекст рисования 2D
      this.#scoreEl = scoreEl;
      this.#restartBtn = restartBtn;
      this.#config = config;

      canvas.width = config.CELL_SIZE * config.GRID_SIZE; // размер canvas считается из конфигурации,
      canvas.height = config.CELL_SIZE * config.GRID_SIZE;// чтобы поле и сетка всегда совпадали
    }

    // Подписка на клавиатуру: handler получает название клавиши и возвращает true, если клавиша обработана
    bindKeyDown(handler) {
      document.addEventListener('keydown', event => {
        if (handler(event.key)) {
          event.preventDefault();                         // стрелки не должны прокручивать страницу
        }
      });
    }

    // Подписка на кнопку «Начать заново»
    bindRestart(handler) {
      this.#restartBtn.addEventListener('click', handler);
    }

    // Обновление HTML-элементов: счёт и кнопка
    updateUI(snapshot) {
      this.#scoreEl.textContent = snapshot.score;         // текущий счёт рядом с полем
      this.#restartBtn.hidden = !snapshot.gameOver;       // кнопка видна только после проигрыша
    }

    // Отрисовка кадра по данным из модели (порядок важен: фон → объекты → надпись)
    render(snapshot) {
      this.#drawBackground();
      this.#drawApple(snapshot.apple);
      this.#drawSnake(snapshot.snake);
      if (snapshot.gameOver) {
        this.#drawGameOver(snapshot);
      }
    }

    #drawBackground() {
      const { CELL_SIZE, GRID_SIZE, COLORS } = this.#config;
      const size = CELL_SIZE * GRID_SIZE;

      this.#ctx.fillStyle = COLORS.background;
      this.#ctx.fillRect(0, 0, size, size);               // заливаем всё поле

      this.#ctx.strokeStyle = COLORS.grid;
      this.#ctx.lineWidth = 1;
      this.#ctx.beginPath();
      for (let i = 1; i < GRID_SIZE; i++) {
        const p = i * CELL_SIZE;
        this.#ctx.moveTo(p, 0);                           // вертикальная линия сетки
        this.#ctx.lineTo(p, size);
        this.#ctx.moveTo(0, p);                           // горизонтальная линия сетки
        this.#ctx.lineTo(size, p);
      }
      this.#ctx.stroke();
    }

    #drawSnake(snake) {
      const { CELL_SIZE, COLORS } = this.#config;
      snake.forEach((segment, index) => {
        this.#ctx.fillStyle = index === 0 ? COLORS.snakeHead : COLORS.snakeBody;   // голова другого цвета
        this.#ctx.fillRect(
          segment.x * CELL_SIZE + 1,                      // клетки -> пиксели
          segment.y * CELL_SIZE + 1,
          CELL_SIZE - 2,                                  // отступ 1px, чтобы сегменты различались
          CELL_SIZE - 2
        );
      });
    }

    #drawApple(apple) {
      if (!apple) {
        return;                                           // яблока нет (поле заполнено)
      }
      const { CELL_SIZE, COLORS } = this.#config;
      this.#ctx.fillStyle = COLORS.apple;
      this.#ctx.beginPath();
      this.#ctx.arc(
        apple.x * CELL_SIZE + CELL_SIZE / 2,              // центр клетки по X
        apple.y * CELL_SIZE + CELL_SIZE / 2,              // центр клетки по Y
        CELL_SIZE / 2 - 2,                                // радиус круга
        0,
        Math.PI * 2
      );
      this.#ctx.fill();
    }

    #drawGameOver(snapshot) {
      const { CELL_SIZE, GRID_SIZE, COLORS } = this.#config;
      const size = CELL_SIZE * GRID_SIZE;

      this.#ctx.fillStyle = COLORS.overlay;
      this.#ctx.fillRect(0, 0, size, size);               // затемняем поле

      this.#ctx.fillStyle = COLORS.text;
      this.#ctx.textAlign = 'center';
      this.#ctx.textBaseline = 'middle';

      this.#ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
      this.#ctx.fillText(snapshot.isWin ? 'Вы победили!' : 'Игра окончена', size / 2, size / 2 - 50);

      this.#ctx.font = '24px "Trebuchet MS", sans-serif';
      this.#ctx.fillText('Счёт: ' + snapshot.score, size / 2, size / 2 - 10);   // итоговый счёт
    }
  }

  // 5. CONTROLLER — ввод игрока и игровой цикл
  class SnakeController {
    #model;
    #view;
    #moveInterval;
    #rafId = null;            // id текущего кадра (нужен для отмены)
    #lastMoveTime = null;     // время последнего шага змейки, мс

    constructor(model, view, moveInterval) {
      this.#model = model;
      this.#view = view;
      this.#moveInterval = moveInterval;
    }

    // Подключаем обработчики и запускаем первую игру
    init() {
      this.#view.bindKeyDown(key => this.#handleKey(key));
      this.#view.bindRestart(() => this.start());         // кнопка «Начать заново»
      this.start();
    }

    // Старт и перезапуск игры без перезагрузки страницы
    start() {
      if (this.#rafId !== null) {
        cancelAnimationFrame(this.#rafId);                // отменяем старый цикл, чтобы не было двух сразу
      }
      this.#model.reset();
      this.#lastMoveTime = null;                          // сбрасываем отсчёт времени шага
      this.#view.updateUI(this.#model.getSnapshot());     // счёт 0, кнопка скрыта
      this.#rafId = requestAnimationFrame(this.#tick);
    }

    // Клавиатура: возвращает true, если клавиша обработана
    #handleKey(key) {
      if (key === 'Enter' && this.#model.isGameOver) {    // Enter после проигрыша = «Начать заново»
        this.start();
        return true;
      }
      const direction = KEY_DIRECTIONS[key];
      if (!direction) {
        return false;                                     // не стрелка — игнорируем
      }
      this.#model.setDirection(direction);
      return true;
    }

    // Игровой цикл на requestAnimationFrame; currentTime — время кадра в мс от браузера
    #tick = (currentTime) => {
      if (this.#lastMoveTime === null) {
        this.#lastMoveTime = currentTime;                 // первый кадр: точка отсчёта
      }

      let stepped = false;
      const elapsed = currentTime - this.#lastMoveTime;   // сколько мс прошло с последнего шага
      if (elapsed >= this.#moveInterval) {
        this.#model.update();                             // логика — только по прошествии интервала
        this.#lastMoveTime = currentTime - (elapsed % this.#moveInterval);   // остаток сохраняем: скорость ровная на любом FPS
        stepped = true;
      }

      const snapshot = this.#model.getSnapshot();
      this.#view.render(snapshot);                        // рисуем каждый кадр
      if (stepped) {
        this.#view.updateUI(snapshot);                    // HTML обновляем только после шага
      }

      // Пока игра идёт — планируем следующий кадр, после проигрыша цикл останавливается
      this.#rafId = snapshot.gameOver ? null : requestAnimationFrame(this.#tick);
    };
  }

  // ---------- 6. ЗАПУСК: сборка MVC ----------
  const model = new SnakeModel(CONFIG.GRID_SIZE, CONFIG.INITIAL_LENGTH);
  const view = new SnakeView(
    document.getElementById('game-canvas'),
    document.getElementById('score'),
    document.getElementById('restart-btn'),
    CONFIG
  );
  const controller = new SnakeController(model, view, CONFIG.MOVE_INTERVAL);
  controller.init();                                      // привязка событий и старт игры
})();
