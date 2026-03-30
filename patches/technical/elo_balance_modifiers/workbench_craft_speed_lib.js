'use strict';

/**
 * Множитель скорости крафта, лутания, разделывания и создания проектов (UDH_CraftingComponent).
 * globalThis.__DH_WORKBENCH_CRAFT_SPEED_MULT из elo-balance (craftspeed), нейтраль 1.
 * Масштабирование RemainingTime/TotalTime в конце UDH_CraftingComponent::TickComponent (и
 * UDH_WorkbenchRepairComponent::TickComponent при наличии символа). GroundCrafting не трогаем.
 */

function installWorkbenchCraftSpeedHooks(base) {
  if (globalThis.__DH_WORKBENCH_CRAFT_INSTALLED) {
    return;
  }

  if (!base) {
    throw new Error('[workbench_craft] installWorkbenchCraftSpeedHooks: base is null');
  }

  const OFF = {
    PROJECT_REMAINING: 0x48,
    PROJECT_TOTAL: 0x4c,
    PROJECT_RECIPE: 0x28,
    COMPONENT_CURRENT_PROJECTS_DATA: 0x248,
    COMPONENT_CURRENT_PROJECTS_NUM: 0x250,
    RECIPE_CRAFTING_TIME: 0x4c,
  };

  function effectiveMult() {
    const v = globalThis.__DH_WORKBENCH_CRAFT_SPEED_MULT;
    if (typeof v === 'number' && v > 0 && Number.isFinite(v)) return v;
    return 1;
  }

  function wbSend(message) {
    try {
      send({ type: 'workbench_craft_speed_log', hook: 'TickComponent', message: String(message) });
    } catch (_e) {}
  }

  function safeReadPointer(addr) {
    try {
      const p = addr.readPointer();
      return p && !p.isNull() ? p : null;
    } catch (_e) {
      return null;
    }
  }

  function readRecipeCraftTime(recipePtr) {
    if (!recipePtr || recipePtr.isNull()) return -1;
    try {
      const t = recipePtr.add(OFF.RECIPE_CRAFTING_TIME).readFloat();
      return Number.isFinite(t) ? t : -1;
    } catch (_e) {
      return -1;
    }
  }

  function looksAlreadyScaledForRecipe(project, m) {
    const recipe = safeReadPointer(project.add(OFF.PROJECT_RECIPE));
    const rt = readRecipeCraftTime(recipe);
    if (!(rt > 0)) return false;
    let tot0 = 0;
    try {
      tot0 = project.add(OFF.PROJECT_TOTAL).readFloat();
    } catch (_e) {
      return false;
    }
    if (!Number.isFinite(tot0)) return false;
    const expected = rt / m;
    return Math.abs(tot0 - expected) < Math.max(0.02, rt * 0.001);
  }

  function applySpeedToProject(project) {
    const m = effectiveMult();
    if (!(m > 0) || !Number.isFinite(m) || !project || project.isNull()) {
      return;
    }
    if (Math.abs(m - 1) < 1e-5) {
      return;
    }
    let rem0 = 0;
    let tot0 = 0;
    try {
      rem0 = project.add(OFF.PROJECT_REMAINING).readFloat();
      tot0 = project.add(OFF.PROJECT_TOTAL).readFloat();
    } catch (_e) {
      return;
    }
    if (!Number.isFinite(rem0) || !Number.isFinite(tot0) || tot0 <= 0 || tot0 > 1e7) {
      return;
    }
    if (looksAlreadyScaledForRecipe(project, m)) {
      return;
    }
    const rem1 = rem0 / m;
    const tot1 = tot0 / m;
    try {
      project.add(OFF.PROJECT_REMAINING).writeFloat(Math.min(rem1, tot1));
      project.add(OFF.PROJECT_TOTAL).writeFloat(tot1);
    } catch (_e) {
      wbSend('write FAILED: ' + _e);
    }
  }

  function forEachProjectInComponent(component, fn) {
    if (!component || component.isNull()) return;
    try {
      const data = safeReadPointer(component.add(OFF.COMPONENT_CURRENT_PROJECTS_DATA));
      const num = component.add(OFF.COMPONENT_CURRENT_PROJECTS_NUM).readU32();
      if (!data || num <= 0 || num > 64) return;
      for (let i = 0; i < num; i += 1) {
        const p = safeReadPointer(data.add(i * 8));
        if (p) fn(p);
      }
    } catch (_e) {}
  }

  function attachTickAtAddress(addr, label) {
    Interceptor.attach(addr, {
      onEnter(args) {
        this._comp = args[0];
      },
      onLeave() {
        try {
          const comp = this._comp;
          if (!comp || comp.isNull()) return;
          forEachProjectInComponent(comp, applySpeedToProject);
        } catch (e) {
          wbSend('leave error: ' + e);
        }
      },
    });
    wbSend('attached @ ' + label);
  }

  try {
    let mod = Process.getModuleByAddress(base);
    if (!mod) {
      mod = Process.getModuleByName('DreadHungerServer-Win64-Shipping.exe');
    }
    if (!mod) {
      wbSend('cannot resolve module from base');
      return;
    }
    const syms = Module.enumerateSymbols(mod.name);
    const seen = new Set();
    let nAttached = 0;
    for (let i = 0; i < syms.length; i += 1) {
      const n = syms[i].name || '';
      if (n.indexOf('TickComponent') < 0) continue;
      if (n.indexOf('GroundCrafting') >= 0) continue;
      const isCraftingTick =
        n.indexOf('UDH_CraftingComponent') >= 0 ||
        n.indexOf('UDH_WorkbenchRepairComponent') >= 0;
      if (!isCraftingTick) continue;
      const addr = syms[i].address;
      if (!addr || addr.isNull()) continue;
      const key = addr.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        attachTickAtAddress(addr, n);
        nAttached += 1;
      } catch (e) {
        wbSend('skip ' + n + ': ' + e);
      }
    }
    if (nAttached === 0) {
      wbSend('no TickComponent symbol (stripped exe)');
    } else {
      wbSend('total hooks: ' + nAttached);
    }
  } catch (e) {
    wbSend('attach FAILED: ' + e);
    return;
  }
  globalThis.__DH_WORKBENCH_CRAFT_INSTALLED = true;
}
