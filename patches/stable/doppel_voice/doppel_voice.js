/*
 * DHDoppel — Windows dedicated-сервер, Frida x64.
 * Порт механики допеля из dhsolo.doppel-voice.js. Соло и камень сюда не входят.
 * Проверенная PE-сборка: e9be609267177b290a350fca426c6f316f6c8e8a14fa2eb6ca40348bdaab277d.
 * Только сервер: обмен привязками PlayerState/Pawn и смерть от противоядия цели.
 * Отключать через rpc.exports.stop(): возврат выполняется в игровом Tick до выгрузки.
 */
'use strict';
(function () {
    const NAME = 'DreadHungerServer-Win64-Shipping.exe';
    if (Process.platform !== 'windows' || Process.arch !== 'x64') throw new Error('Нужен Windows x64 dedicated-сервер');
    const module = Process.getModuleByName(NAME);
    const PROFILE = {
        CreateDoppelganger: [0xd4eeb0, '48 89 5c 24 18 55 56 57 41 54 41 55 41 56 41 57'],
        CurePoison: [0xd4f520, '40 56 57 41 56 48 83 ec 70 80 b9 50 12 00 00 00'],
        Consume: [0xdc3470, '4c 8b dc 55 53 56 57 41 56 49 8d 6b a1 48 81 ec'],
        Died: [0xd50cb0, '48 8b c4 53 56 57 48 81 ec 90 00 00 00 80 b9 f0'],
        Destroyed: [0xd4ff30, '48 89 5c 24 08 57 48 83 ec 20 48 8b f9 e8 7e ff'],
        ForceNetUpdate: [0x22d8050, '40 57 48 83 ec 20 80 b9 f0 00 00 00 03 48 8b f9'],
        Tick: [0xd74d60, '48 8b c4 55 57 41 56 48 8d 68 a1 48 81 ec a0 00'],
        EndPlay: [0x2744170, '48 89 5c 24 08 57 48 83 ec 20 8b fa 48 8b d9 85'],
        // Подтверждает именно вызов CurePoison из ветки противоядия Consume.
        AntidoteCall: [0xdc3716, 'e8 05 be f8 ff'],
        // Подтверждает Windows-смещение DoppelgangerReserveHealth 0xBCC.
        ReserveUpdate: [0xd75322, 'f3 0f 58 87 cc 0b 00 00 f3 0f 11 87 cc 0b 00 00'],
    };
    const OFF = { playerState: 0x240, pawnPrivate: 0x280, role: 0xf0,
        maxHealth: 0x7e0, reserve: 0xbcc, isDoppel: 0x11d2, index: 0xc };
    const address = name => module.base.add(PROFILE[name][0]);
    function bytes(pointer, count) {
        return Array.from(new Uint8Array(pointer.readByteArray(count)), n => n.toString(16).padStart(2, '0')).join(' ');
    }
    // Ни одного хука/записи до проверки всего профиля. ASLR учитывается через module.base.
    for (const [name, [rva, expected]] of Object.entries(PROFILE)) {
        if (bytes(module.base.add(rva), expected.split(' ').length) !== expected) {
            throw new Error('Сборка/код сервера не совпадает: ' + name + '. Перехваты не установлены.');
        }
    }
    const forceNetUpdate = new NativeFunction(address('ForceNetUpdate'), 'void', ['pointer'], 'win64');
    const active = new Map();
    const hooks = [];
    let stopping = false, stopped = false;
    const log = text => console.log('[DHDoppelWindows] ' + text);
    function identity(object) {
        return { pointer: ptr(object.toString()), index: object.add(OFF.index).readS32(), vtable: object.readPointer() };
    }
    function valid(id) {
        if (!id || id.pointer.isNull()) return false;
        try { return id.pointer.add(OFF.index).readS32() === id.index && id.pointer.readPointer().equals(id.vtable); }
        catch (_) { return false; }
    }
    function guard(fn) {
        return function (...args) {
            try { return fn.apply(this, args); }
            catch (error) { log('Ошибка перехвата: ' + error.message); }
        };
    }
    function attach(name, callbacks) {
        hooks.push(Interceptor.attach(address(name), callbacks));
    }
    function link(pawn, ps) {
        pawn.add(OFF.playerState).writePointer(ps);
        ps.add(OFF.pawnPrivate).writePointer(pawn);
    }
    function replicate(rec) {
        for (const id of [rec.doppel, rec.target, rec.thrallPS, rec.targetPS]) {
            if (valid(id)) forceNetUpdate(id.pointer);
        }
    }
    function restore(rec, reason) {
        if (!rec.swapped) return true;
        // Не перезаписываем привязки, которые игра уже изменила при новом Possess.
        const fixes = [
            [rec.doppel, OFF.playerState, rec.targetPS.pointer, rec.originalDoppelPS],
            [rec.target, OFF.playerState, rec.thrallPS.pointer, rec.originalTargetPS],
            [rec.thrallPS, OFF.pawnPrivate, rec.target.pointer, rec.originalThrallPawn],
            [rec.targetPS, OFF.pawnPrivate, rec.doppel.pointer, rec.originalTargetPawn],
        ];
        for (const [id, offset, swapped, original] of fixes) {
            if (valid(id) && id.pointer.add(offset).readPointer().equals(swapped)) {
                id.pointer.add(offset).writePointer(original);
            }
        }
        rec.swapped = false;
        replicate(rec);
        log('Привязки возвращены: ' + reason);
        return true;
    }
    function occupied(pointers) {
        return Array.from(active.values()).some(rec => rec.swapped && pointers.some(p =>
            [rec.doppel, rec.target, rec.thrallPS, rec.targetPS].some(id => id.pointer.equals(p))));
    }
    function gone(pawn, reason) {
        for (const [key, rec] of active) {
            if (rec.doppel.pointer.equals(pawn) || rec.target.pointer.equals(pawn)) {
                restore(rec, reason);
                active.delete(key);
            }
        }
    }
    attach('CreateDoppelganger', {
        onEnter: guard(function (args) { this.target = ptr(args[0].toString()); this.enabled = !stopping; }),
        onLeave: guard(function (retval) {
            if (!this.enabled || stopping || retval.isNull() || this.target.isNull()) return;
            const doppel = ptr(retval.toString()), target = this.target;
            if (target.add(OFF.role).readU8() !== 3 || doppel.add(OFF.isDoppel).readU8() === 0) return;
            if (active.has(doppel.toString()) || active.size >= 64) return;
            const thrallPS = doppel.add(OFF.playerState).readPointer();
            const targetPS = target.add(OFF.playerState).readPointer();
            if (thrallPS.isNull() || targetPS.isNull() || thrallPS.equals(targetPS)) {
                log('Обмен пропущен: нет двух различных PlayerState'); return;
            }
            const collision = occupied([doppel, target, thrallPS, targetPS]);
            const rec = { doppel: identity(doppel), target: identity(target), thrallPS: identity(thrallPS),
                targetPS: identity(targetPS), originalDoppelPS: thrallPS, originalTargetPS: targetPS,
                originalThrallPawn: thrallPS.add(OFF.pawnPrivate).readPointer(),
                originalTargetPawn: targetPS.add(OFF.pawnPrivate).readPointer(), swapped: !collision };
            active.set(doppel.toString(), rec);
            if (collision) {
                log('Обмен пропущен: участник уже занят; противоядие продолжает действовать'); return;
            }
            try {
                link(doppel, targetPS); link(target, thrallPS); replicate(rec);
                log('Допель создан: голосовые привязки предателя и цели обменены');
            } catch (error) {
                restore(rec, 'ошибка обмена'); active.delete(doppel.toString()); throw error;
            }
        }),
    });
    attach('Died', { onEnter: guard(function (args) { gone(args[0], 'смерть'); }) });
    attach('Destroyed', { onEnter: guard(function (args) { gone(args[0], 'уничтожение'); }) });
    attach('EndPlay', { onEnter: guard(function (args) { gone(args[0], 'выход персонажа / смена карты'); }) });
    attach('CurePoison', { onEnter: guard(function (args) {
        // ReturnAddress — адрес после подтверждённого выше call в ветке противоядия.
        if (!this.returnAddress.equals(module.base.add(0xdc371b))) return;
        for (const rec of active.values()) {
            if (!rec.target.pointer.equals(args[0]) || !valid(rec.doppel)) continue;
            const doppel = rec.doppel.pointer;
            if (doppel.add(OFF.isDoppel).readU8() === 0) continue;
            const max = doppel.add(OFF.maxHealth).readFloat();
            if (!Number.isFinite(max) || max <= 0) continue;
            doppel.add(OFF.reserve).writeFloat(Math.max(max, 100) * 10 + 100000);
            log('Цель выпила противоядие: допель умрёт на ближайшем игровом тике');
        }
    }) });
    attach('Tick', { onEnter: guard(function () {
        if (!stopping || stopped) return;
        for (const rec of active.values()) restore(rec, 'отключение мода');
        active.clear();
        stopped = true;
        for (const hook of hooks) hook.detach();
        log('Мод остановлен, привязки восстановлены');
    }) });
    rpc.exports = {
        status() { return { active: active.size, stopping, stopped, platform: 'windows-x64' }; },
        stop() {
            stopping = true;
            // Без активного обмена ожидание игрового тика не требуется.
            if (active.size === 0 && !stopped) {
                stopped = true; for (const hook of hooks) hook.detach();
            }
            return { active: active.size, stopped };
        },
    };
    log('Загружен: обмен голосами допеля и противоядие; Windows-профиль проверен');
})();
