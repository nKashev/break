/*
 * Break — обединен скрипт (без ES модули).
 * Тази версия работи при отваряне на index.html директно с двоен клик (file://),
 * без локален сървър. Всичко е събрано в един обикновен <script>.
 *
 * index.html ползва само този файл.
 */
(function () {
    'use strict';

    /* ======================================================================
     * МУЗИКА
     * 1) Опитва да пусне видеото от YouTube (работи сигурно на GitHub Pages;
     *    локално през file:// понякога не тръгва — браузърнo ограничение).
     * 2) Ако YouTube не успее, при клик върху логото свири public/melody.mp3.
     *
     * Може да сложиш цял линк ИЛИ само ID-то. Празна стойност ('') = само mp3.
     * Може и през URL, без да пипаш кода: index.html?yt=ВИДЕО_ID
     * ====================================================================== */
    const MUSIC_STREAM_ID = 'https://www.youtube.com/watch?v=36YnV9STBqc';

    /* ----- elements.js ----- */
    const elements = {
        time: {
            minutes: () => document.querySelector('.time .m'),
            seconds: () => document.querySelector('.time .s'),
            container: () => document.querySelector('.time-container'),
            innerLayer: () => document.querySelector('.inner-layer'),
            time: () => document.querySelector('.time')
        },
        slider: {
            slider: () => document.querySelector('div.slider'),
            partnersWrapper: () => document.querySelector('#partners'),
            partners: () => document.querySelectorAll('div.partner')
        },
        info: {
            timerState: () => document.querySelector('#timer-toggle')
        },
        modal: {
            modal: () => document.querySelector('#modal'),
            modalOverlay: () => document.querySelector('#modal-overlay'),
            closeButton: () => document.querySelector('#close-button'),
            form: () => document.querySelector('form.time-form'),
            suggestions: () => document.querySelector('.suggestions')
        },
        audio: {
            audio: () => document.querySelector('audio'),
            muteButton: () => document.querySelector('header')
        }
    };

    /* ----- partners.js ----- */
    const partners = [
        { src: "./public/partners/port_pilates_logo.png", name: "Port Pilates" },
        { src: "./public/partners/propilateslogo.png", name: "Pro Pilates" },
        { src: "./public/partners/janet_logo.webp", name: "Janet's Reformer Boutique" },
        { src: "./public/partners/panther_logo.png", name: "Panther Pilates Reformers" },
        { src: "./public/partners/gmfit.webp", name: "GM FIT" },
        { src: "./public/partners/NA_logo.svg", name: "NA Luxury Curves" },
        { src: "./public/partners/sculpt&beauty.svg", name: "Sculpt&Beauty" },
        { src: "./public/partners/sq_pilates_reformer.svg", name: "SQ Pilates Reformer" },
        { src: "./public/partners/tn_logo.png", name: "TN Pilates" },
        { src: "./public/partners/Margo_no_bg_circle.png", name: "So Personal by Margo" },
        { src: "./public/partners/sb_logo_no_bg.png", name: "Soul & Body" }    
    ];

    /* ----- slider.js ----- */
    const slider = {
        appendPartner({ src, name }) {
            const partnerWrapper = createHTMLElement('div', ['partner']);
            const partnerLogoWrapper = createHTMLElement('div', ['partner-logo-wrapper']);
            const partnerImg = createHTMLElement('img', ['partner-logo'], null, [{ k: 'src', v: src }]);
            const partnerTitleWrapper = createHTMLElement('div', ['partner-name-wrapper']);
            const partnerTitle = createHTMLElement('h4', ['partner-name'], name);

            partnerLogoWrapper.appendChild(partnerImg);
            partnerTitleWrapper.appendChild(partnerTitle);
            partnerWrapper.appendChild(partnerLogoWrapper);
            partnerWrapper.appendChild(partnerTitleWrapper);

            elements.slider.partnersWrapper().appendChild(partnerWrapper);
        }
    };

    function createHTMLElement(tagName, classNames, textContent, attributes) {
        let element = document.createElement(tagName);
        if (classNames) { element.classList.add(...classNames); }
        if (textContent) { element.textContent = textContent; }
        if (attributes) {
            attributes.forEach((attr) => { element.setAttribute(attr.k, attr.v); });
        }
        return element;
    }

    /* ----- time.js ----- */
    function getCurrentValue(move) {
        if (move < 0) { return 1; }
        if (move > 0) { return -1; }
    }

    function eventHandler(e) {
        const move = e.deltaY;
        const element = e.currentTarget;
        const time = Number(element.textContent);
        const changedTime = getCurrentValue(move) + time;
        const maxRange = 59;
        if (changedTime >= 0 && changedTime <= maxRange) {
            element.textContent = changedTime > 9 ? changedTime : `0${changedTime}`;
        }
    }

    const timeHandlers = {
        minutes: eventHandler,
        seconds: eventHandler
    };

    /* ======================================================================
     * WEB WORKER ТАЙМЕР
     * Върви в background thread — не спира при заключен екран или неактивен таб.
     * Ако браузърът не поддържа Workers (много рядко), пада на requestAnimationFrame.
     * ====================================================================== */
    let timerWorker = null;
    let workerSupported = (typeof Worker !== 'undefined');

    // requestAnimationFrame fallback (оригиналната логика)
    let animationId;
    let lastTimeCalled = 0;

    function rafTick(elapsedTime) {
        if ((elapsedTime - lastTimeCalled) >= 1000 || lastTimeCalled === 0) {
            lastTimeCalled = elapsedTime;
            tickDown();
        }
        animationId = requestAnimationFrame(rafTick);
    }

    // Обща функция за едно тактуване надолу — ползва се и от Worker, и от RAF.
    function tickDown() {
        const mEl = elements.time.minutes();
        const sEl = elements.time.seconds();
        const minutes = Number(mEl.textContent);
        const seconds = Number(sEl.textContent);

        if (seconds > 0) {
            sEl.textContent = formatTimeContent(seconds - 1);
        } else if (minutes > 0) {
            mEl.textContent = formatTimeContent(minutes - 1);
            sEl.textContent = '59';
        } else {
            // Таймерът е достигнал 00:00
            onTimerDone();
            return;
        }

        // Актуализира worker-а с реалното оставащо време (за синхрон след пауза)
        // — не е нужно при Worker режим, там worker-ът е водещ.
    }

    // Извиква се при 00:00 — от Worker или от RAF
    function onTimerDone() {
        // Спира таймера
        if (isStarted) {
            isStarted = false;
            stopTimer();
            toggleTimerState(elements.info.timerState(), false);
        }
        // Нулира дисплея
        elements.time.minutes().textContent = '00';
        elements.time.seconds().textContent = '00';

        // Спира музиката
        stopMusic();
    }

    function startTimer(totalSeconds) {
        if (workerSupported) {
            if (!timerWorker) {
                // Определя пътя до worker файла спрямо app.js
                const workerUrl = new URL('./timer.worker.js', import.meta.url || (document.currentScript && document.currentScript.src) || location.href).href;
                try {
                    timerWorker = new Worker(workerUrl);
                } catch (e) {
                    workerSupported = false;
                }
            }
            if (timerWorker) {
                timerWorker.onmessage = function (e) {
                    if (e.data.type === 'tick') {
                        const mins = Math.floor(e.data.totalSeconds / 60);
                        const secs = e.data.totalSeconds % 60;
                        elements.time.minutes().textContent = formatTimeContent(mins);
                        elements.time.seconds().textContent = formatTimeContent(secs);
                    } else if (e.data.type === 'done') {
                        onTimerDone();
                    }
                };
                timerWorker.postMessage({ cmd: 'start', totalSeconds });
                return;
            }
        }
        // RAF fallback
        lastTimeCalled = 0;
        animationId = requestAnimationFrame(rafTick);
    }

    function stopTimer() {
        if (timerWorker) {
            timerWorker.postMessage({ cmd: 'stop' });
        }
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        lastTimeCalled = 0;
    }

    /* ----- controls.js ----- */
    let isStarted = false;
    const { timerState } = elements.info;

    function controlCenter() {
        isStarted = !isStarted;
        if (isStarted) {
            const mins = Number(elements.time.minutes().textContent);
            const secs = Number(elements.time.seconds().textContent);
            const total = mins * 60 + secs;
            if (total <= 0) {
                // Няма какво да отброява — не стартира
                isStarted = false;
                return;
            }
            startTimer(total);
        } else {
            stopTimer();
        }
        toggleTimerState(timerState(), isStarted);
    }

    function isStartedYet() {
        return isStarted;
    }

    /* ----- modal.js ----- */
    const { closeButton, form, modalOverlay, modal, suggestions } = elements.modal;
    const { time, minutes, seconds } = elements.time;

    function setupModal() {
        closeButton().addEventListener("click", toggleModal);
        time().addEventListener("click", toggleModal);
        form().addEventListener('submit', setTheTimer);
        suggestions().addEventListener('click', pickSuggestedTime);
    }

    function toggleTimerState(timerStateEl, isStarted) {
        timerStateEl.classList.remove('timer-on', 'timer-off');
        timerStateEl.classList.add(isStarted ? 'timer-on' : 'timer-off');
        timerStateEl.setAttribute('aria-checked', isStarted ? 'true' : 'false');
    }

    function setTheTimer(e) {
        e.preventDefault();
        const [minutesVal, secondsVal] = [...document.querySelectorAll('form input')].map((el) => formatTimeContent(el.value));
        const suggestedPick = e.suggestedPick !== undefined ? e.suggestedPick : false;
        const timeFromForm = formatTimeContent(minutesVal);

        if (suggestedPick !== false) {
            // 60 → зарежда 59:59; всички останали → MM:00
            const num = Number(suggestedPick);
            if (num >= 60) {
                minutes().textContent = '59';
                seconds().textContent = '59';
            } else {
                minutes().textContent = formatTimeContent(num);
                seconds().textContent = '00';
            }
        } else {
            minutes().textContent = timeFromForm;
            seconds().textContent = formatTimeContent(secondsVal);
        }

        toggleModal();

        if (!isStartedYet()) { elements.info.timerState().click(); }
    }

    function toggleModal() {
        modal().classList.toggle("closed");
        modalOverlay().classList.toggle("closed");
    }

    function pickSuggestedTime(e) {
        const { textContent } = e.target;
        const trimmed = textContent.trim();
        // Приема 2- или 3-символни стойности (напр. "05", "30", "60")
        if (trimmed.length < 2 || trimmed.length > 3 || isNaN(Number(trimmed))) { return; }
        setTheTimer({
            suggestedPick: trimmed,
            preventDefault: () => { }
        });
    }

    /* ----- utils.js ----- */
    function parseQueryString(query) {
        if (!query) {
            return null;
        } else {
            const tokens = query.split('?')[1].split('&').map(t => t.split('='));
            return tokens.reduce((p, [k, v]) => Object.assign(p, { [k]: v }), {});
        }
    }

    function extractTimeQuery(queryObj = {}) {
        return Object.keys(queryObj).reduce((acc, curr) => {
            if (curr === 'm' || curr === 's') {
                let value = queryObj[curr];
                if (value < 10) {
                    value = `0${value}`;
                } else if (value >= 59) {
                    value = 59;
                }
                Object.assign(acc, { [curr]: value });
            }
            return acc;
        }, {});
    }

    function manageQueryString(search) {
        const queries = parseQueryString(search);
        if (queries) {
            const { on, mod, prep } = queries;
            const { m, s } = extractTimeQuery(queries);

            if (m) {
                elements.time.minutes().textContent = formatTimeContent(m || 0);
                elements.time.seconds().textContent = formatTimeContent(s || 0);
            } else if (prep) {
                elements.time.minutes().textContent = formatTimeContent(getMinutesToSet());
            }

            if (on === "true") { elements.info.timerState().click(); }
            if (mod === "false") { elements.modal.closeButton().click(); }
        }
    }

    function formatTimeContent(value) {
        return Number(value).toString().padStart(2, 0);
    }

    let ytPlayer = null;
    let ytReady = false;

    // Приема цял YouTube линк или само ID и връща чистото 11-символно ID.
    function extractYouTubeId(input) {
        if (!input) { return ''; }
        input = String(input).trim();
        if (/^[\w-]{11}$/.test(input)) { return input; }
        const m = input.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
        return m ? m[1] : '';
    }

    function setupMusic() {
        const raw = (parseQueryString(location.search)?.yt) || MUSIC_STREAM_ID;
        const streamId = extractYouTubeId(raw);
        if (!streamId) { return; } // няма валиден YouTube ID → ползва се само mp3

        window.onYouTubeIframeAPIReady = function () {
            try {
                ytPlayer = new YT.Player('yt-player', {
                    videoId: streamId,
                    playerVars: {
                        autoplay: 0, controls: 1, playsinline: 1, rel: 0, modestbranding: 1
                    },
                    events: {
                        onReady: function () { ytReady = true; },
                        onError: function () { ytReady = false; ytPlayer = null; }
                    }
                });
            } catch (e) {
                ytReady = false;
                ytPlayer = null;
            }
        };

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = function () { ytReady = false; ytPlayer = null; };
        document.head.appendChild(tag);
    }

    function manageMusic() {
        // 1) Ако YouTube е готов — управлява него.
        if (ytReady && ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
            if (ytPlayer.getPlayerState() === 1) { // 1 = playing
                ytPlayer.pauseVideo();
            } else {
                ytPlayer.playVideo();
            }
            return;
        }
        // 2) Иначе — локалната mp3.
        const audio = elements.audio.audio();
        if (!audio) { return; }
        if (audio.paused) { audio.play(); } else { audio.pause(); }
    }

    // Спира музиката при достигане на 00:00 (без toggle — само пауза)
    function stopMusic() {
        if (ytReady && ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
            if (ytPlayer.getPlayerState() === 1) { // спира само ако свири
                ytPlayer.pauseVideo();
            }
            return;
        }
        const audio = elements.audio.audio();
        if (audio && !audio.paused) { audio.pause(); }
    }

    function getMinutesToSet() {
        const currentMinutes = new Date().getMinutes();
        const currentHalf = Number(currentMinutes) >= 30 ? 60 : 30;
        return (currentHalf - currentMinutes);
    }

    function setupEvents() {
        elements.time.minutes().addEventListener('wheel', timeHandlers.minutes);
        elements.time.seconds().addEventListener('wheel', timeHandlers.seconds);
        elements.info.timerState().addEventListener('click', controlCenter);
        elements.audio.muteButton().addEventListener('click', manageMusic);
    }

    function appendPartnersElements() {
        partners.concat(partners).forEach(slider.appendPartner);
    }

    /* ----- bootstrap (index.js) ----- */
    function init() {
        setupEvents();
        appendPartnersElements();
        setupModal();
        setupMusic();
        manageQueryString(location.search);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
