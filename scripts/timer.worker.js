/*
 * timer.worker.js
 * Таймерът върви тук — в отделен thread.
 * Браузърът НЕ throttle-ва Web Workers дори при заключен екран / неактивен таб.
 *
 * Съобщения КЪМ worker-а:
 *   { cmd: 'start', totalSeconds: N }  — стартира отброяване от N секунди
 *   { cmd: 'stop' }                    — пауза / спиране
 *
 * Съобщения ОТ worker-а:
 *   { type: 'tick',  totalSeconds: N } — изпраща се веднъж в секунда
 *   { type: 'done' }                   — таймерът стигна 0
 */
'use strict';

let intervalId = null;
let remaining  = 0;

self.onmessage = function (e) {
    const { cmd, totalSeconds } = e.data;

    if (cmd === 'start') {
        if (intervalId !== null) { clearInterval(intervalId); }
        remaining = totalSeconds;

        intervalId = setInterval(function () {
            if (remaining <= 0) {
                clearInterval(intervalId);
                intervalId = null;
                self.postMessage({ type: 'done' });
                return;
            }
            remaining--;
            self.postMessage({ type: 'tick', totalSeconds: remaining });
        }, 1000);

    } else if (cmd === 'stop') {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }
};
