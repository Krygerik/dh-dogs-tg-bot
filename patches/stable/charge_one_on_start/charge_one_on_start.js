console.log("Mana-on-start script injected successfully.");

var base = Process.getModuleByName("DreadHungerServer-Win64-Shipping.exe").base;

var ADH_HumanCharacter_AddStartingInventory_addr = base.add(0xD46F10);
var ADH_SpellManager_CastSpell_addr = base.add(0xE634F0);


function resetSpells(SpellManager) {
    if (SpellManager.isNull()) {
        return;
    }
    var SpellChargeLevel = SpellManager.add(0x284);
    SpellChargeLevel.writeFloat(SpellChargeLevel.readFloat() + 0.20);
}

Interceptor.attach(ADH_HumanCharacter_AddStartingInventory_addr, {
    onEnter: function (args) {
        var PlayerState = args[0].add(0x240).readPointer();
        var SpellManager = PlayerState.add(0x488).readPointer();
        resetSpells(SpellManager);
    }
});
