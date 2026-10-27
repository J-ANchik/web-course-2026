// =====================================================================
// Лабораторная №7. Лента постов с бесконечным скроллом
// Архитектура: MVC. Слои:
//   CONFIG     — константы
//   PostsApi   — слой доступа к данным (fetch)
//   Model      — состояние и бизнес-логика (загрузка порций, фильтрация)
//   View       — всё, что касается DOM (отрисовка, привязка событий)
//   Controller — связывает Model и View, реагирует на действия пользователя
// Весь код обёрнут в IIFE, поэтому глобальных переменных нет:
// каждая const/let ниже видна только внутри этой функции.
// =====================================================================
(() => {
  'use strict'; // строгий режим: ловит неявные глобальные переменные

  // ===================================================================
  // 1. КОНФИГУРАЦИЯ
  // ===================================================================
  const CONFIG = Object.freeze({
    API_URL: 'https://jsonplaceholder.typicode.com/posts', // адрес API
    PAGE_SIZE: 10,          // сколько постов подгружаем за один запрос
    MAX_POSTS: 100,         // всего постов в API — дальше грузить нечего
    SCROLL_THRESHOLD: 200,  // за сколько px до конца страницы начинаем подгрузку
    DEBOUNCE_DELAY: 300     // задержка дебаунса поиска, мс
  });

  // ===================================================================
  // 2. СЛОЙ ДАННЫХ (API)
  // Отвечает только за сетевые запросы. Ничего не знает ни о DOM, ни о состоянии.
  // ===================================================================
  const PostsApi = {
    // Запрашивает одну «страницу» постов. Бросает Error с понятным текстом.
    async fetchPage(page, limit) {
      const url = `${CONFIG.API_URL}?_page=${page}&_limit=${limit}`; // пагинация на стороне сервера

      try { // каждый fetch обёрнут в try/catch
        const response = await fetch(url);

        if (!response.ok) { // fetch не бросает ошибку на 404/500, проверяем статус сами
          throw new Error(`Сервер вернул ошибку ${response.status}. Попробуйте позже.`);
        }

        return await response.json(); // разбор тела ответа в массив объектов
      } catch (error) {
        // Преобразуем технические ошибки в сообщения, понятные пользователю
        if (error instanceof TypeError) {   // fetch кидает TypeError при сбое сети
          throw new Error('Нет соединения с сервером. Проверьте интернет и повторите попытку.');
        }
        if (error instanceof SyntaxError) { // response.json() не смог разобрать ответ
          throw new Error('Сервер вернул некорректные данные.');
        }
        throw error; // наша собственная ошибка про статус — пробрасываем как есть
      }
    }
  };

  // ===================================================================
  // 3. MODEL
  // Хранит состояние и правила его изменения. DOM не трогает.
  // Об изменениях сообщает подписчикам (паттерн «наблюдатель»).
  // ===================================================================
  const createPostsModel = (api) => {
    // Состояние живёт в замыкании — снаружи его можно изменить только через методы модели
    const state = {
      posts: [],        // ВСЕ загруженные посты (единый массив, из него идёт отрисовка и фильтр)
      page: 0,          // номер последней загруженной страницы
      isLoading: false, // идёт ли сейчас запрос
      hasMore: true,    // есть ли ещё посты на сервере
      error: null,      // текст ошибки или null
      query: ''         // текущая строка поиска
    };

    const listeners = []; // подписчики на изменения (в нашем случае — один, из контроллера)

    const notify = () => listeners.forEach((listener) => listener()); // уведомляем всех

    // Фильтрация по уже загруженным данным (без запросов к серверу)
    const getVisiblePosts = () => {
      const query = state.query.trim().toLowerCase(); // регистр не учитываем
      if (query === '') {
        return [...state.posts]; // фильтра нет — отдаём копию, чтобы не отдавать внутренний массив
      }
      return state.posts.filter((post) => post.title.toLowerCase().includes(query)); // поиск по подстроке в title
    };

    // Можно ли сейчас запросить следующую порцию
    const canLoadMore = () => !state.isLoading && state.hasMore && state.error === null;

    return {
      // Подписка на изменения состояния
      subscribe(listener) {
        listeners.push(listener);
      },

      // Снимок состояния для View (копия/производные данные, а не сам объект state)
      getState() {
        return {
          visiblePosts: getVisiblePosts(), // отфильтрованные посты
          totalLoaded: state.posts.length, // сколько всего загружено
          isLoading: state.isLoading,
          hasMore: state.hasMore,
          error: state.error,
          query: state.query
        };
      },

      canLoadMore,

      // Меняем строку поиска и уведомляем подписчиков
      setQuery(query) {
        state.query = query;
        notify();
      },

      // Сбрасываем ошибку (нужно для кнопки «Повторить»)
      clearError() {
        state.error = null;
      },

      // Загружает следующую порцию постов
      async loadNextPage() {
        if (!canLoadMore()) return; // защита от параллельных запросов и лишних вызовов

        state.isLoading = true; // включаем индикатор загрузки
        state.error = null;
        notify();

        try {
          const nextPage = state.page + 1;
          const batch = await api.fetchPage(nextPage, CONFIG.PAGE_SIZE);

          if (!Array.isArray(batch)) { // проверяем, что пришёл именно массив
            throw new Error('Сервер вернул некорректные данные.');
          }

          state.posts = [...state.posts, ...batch]; // добавляем новую порцию в конец общего массива
          state.page = nextPage;                    // запоминаем, какая страница загружена
          // Постов больше нет, если порция неполная или достигнут лимит API
          state.hasMore = batch.length === CONFIG.PAGE_SIZE && state.posts.length < CONFIG.MAX_POSTS;
        } catch (error) {
          state.error = error.message; // сохраняем текст ошибки — View покажет его пользователю
        } finally {
          state.isLoading = false; // выключаем индикатор в любом случае
          notify();
        }
      }
    };
  };

  // ===================================================================
  // 4. VIEW
  // Единственный слой, который работает с DOM. Логики загрузки здесь нет.
  // ===================================================================
  const createView = () => {
    // Находим элементы один раз при создании View
    const elements = {
      list: document.getElementById('posts'),
      search: document.getElementById('search'),
      counter: document.getElementById('counter'),
      loader: document.getElementById('loader'),
      error: document.getElementById('error'),
      errorText: document.getElementById('error-text'),
      retry: document.getElementById('retry'),
      end: document.getElementById('end'),
      empty: document.getElementById('empty')
    };

    let renderedKey = ''; // «отпечаток» уже показанного списка — чтобы не перерисовывать его зря

    // Создаёт DOM-карточку одного поста
    const createCard = (post) => {
      const card = document.createElement('article');
      card.className = 'post';

      const meta = document.createElement('p');
      meta.className = 'post__meta';
      const postId = document.createElement('span');
      postId.textContent = `Пост #${post.id}`;
      const author = document.createElement('span');
      author.textContent = `Автор: ${post.userId}`; // userId автора
      meta.append(postId, author);

      const title = document.createElement('h2');
      title.className = 'post__title';
      title.textContent = post.title; // textContent вместо innerHTML — защита от внедрения HTML

      const body = document.createElement('p');
      body.className = 'post__body';
      body.textContent = post.body;

      card.append(meta, title, body);
      return card;
    };

    // Перерисовывает список карточек
    const renderPosts = (posts) => {
      const key = posts.map((post) => post.id).join(','); // состав списка → строка
      if (key === renderedKey) return; // список не изменился (например, просто мигнул индикатор) — выходим
      renderedKey = key;

      const fragment = document.createDocumentFragment(); // собираем карточки вне DOM и вставляем одним действием
      posts.forEach((post) => fragment.append(createCard(post)));
      elements.list.replaceChildren(fragment); // заменяем содержимое списка целиком
    };

    return {
      // Главный метод: отрисовывает всё по снимку состояния из модели
      render(state) {
        renderPosts(state.visiblePosts);

        // Счётчик
        elements.counter.textContent =
          `Показано ${state.visiblePosts.length} из ${state.totalLoaded} загруженных`;

        // Блоки статусов показываем/скрываем через атрибут hidden
        elements.loader.hidden = !state.isLoading; // «Загрузка…» — пока идёт запрос
        elements.error.hidden = state.error === null; // ошибка — если она есть
        elements.errorText.textContent = state.error ?? '';
        elements.end.hidden = state.hasMore || state.isLoading || state.error !== null; // «Больше постов нет»
        elements.empty.hidden =
          state.visiblePosts.length > 0 || state.totalLoaded === 0 || state.isLoading; // фильтр ничего не нашёл
      },

      // Дошёл ли пользователь почти до конца страницы
      isNearBottom(threshold) {
        const scrolled = window.innerHeight + window.scrollY; // нижняя граница видимой области
        const pageHeight = document.documentElement.scrollHeight; // полная высота страницы
        // Если страница короче экрана, условие тоже выполнится — это нужно, чтобы подгрузка
        // не «застревала» при коротком списке (например, после фильтрации)
        return scrolled >= pageHeight - threshold;
      },

      // Привязка событий. View лишь вызывает переданные обработчики, сам решений не принимает
      bindSearch(handler) {
        elements.search.addEventListener('input', (event) => handler(event.target.value));
      },

      bindRetry(handler) {
        elements.retry.addEventListener('click', handler);
      },

      bindScroll(handler) {
        window.addEventListener('scroll', handler, { passive: true }); // passive — не тормозим прокрутку
      }
    };
  };

  // ===================================================================
  // 5. CONTROLLER
  // Принимает действия пользователя, управляет моделью и обновляет View.
  // ===================================================================
  const createController = (model, view) => {
    // Дебаунс: вызывает fn только после паузы delay мс с момента последнего вызова
    const debounce = (fn, delay) => {
      let timerId = null; // таймер хранится в замыкании, а не в глобальной переменной
      return (...args) => {
        clearTimeout(timerId); // сбрасываем предыдущий таймер — пользователь ещё печатает
        timerId = setTimeout(() => fn(...args), delay); // ставим новый
      };
    };

    // Подгружает порцию и сразу проверяет, не нужна ли следующая
    const loadMore = async () => {
      await model.loadNextPage();
      checkScrollPosition(); // если страница всё ещё не заполнена — грузим дальше
    };

    // Подгружаем, если пользователь у конца страницы и загрузка разрешена
    function checkScrollPosition() {
      if (model.canLoadMore() && view.isNearBottom(CONFIG.SCROLL_THRESHOLD)) {
        loadMore();
      }
    }

    // Ввод в поиске (вызывается уже после дебаунса)
    const handleSearch = (query) => {
      model.setQuery(query);  // фильтрация идёт по загруженным данным, без запросов к серверу
      checkScrollPosition();  // после фильтрации страница могла стать короче экрана
    };

    // Кнопка «Повторить» после ошибки
    const handleRetry = () => {
      model.clearError();
      loadMore();
    };

    return {
      init() {
        // Любое изменение модели → перерисовка View
        model.subscribe(() => view.render(model.getState()));

        // Привязываем действия пользователя
        view.bindSearch(debounce(handleSearch, CONFIG.DEBOUNCE_DELAY)); // дебаунс ~300 мс
        view.bindScroll(checkScrollPosition);
        view.bindRetry(handleRetry);

        view.render(model.getState()); // первая отрисовка (пустой список)
        loadMore();                    // загрузка первой порции из 10 постов
      }
    };
  };

  // ===================================================================
  // 6. ТОЧКА ВХОДА
  // Создаём слои и соединяем их между собой.
  // ===================================================================
  const model = createPostsModel(PostsApi);
  const view = createView();
  const controller = createController(model, view);

  controller.init();
})();
