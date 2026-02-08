var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

var ADH_HumanCharacter_AddStartingInventory_addr = base.add(0xD46F10);
var ADH_SpellManager_CastSpell_addr = base.add(0xE634F0);


function resetSpells(SpellManager) {
    if (SpellManager.isNull()) {
        return;
    }
    var SpellChargeLevel = SpellManager.add(0x284);
    SpellChargeLevel.writeFloat(SpellChargeLevel.readFloat() + 1);
}

Interceptor.attach(ADH_HumanCharacter_AddStartingInventory_addr, {
    onEnter: function (args) {
        var PlayerState = args[0].add(0x240).readPointer();
        var SpellManager = PlayerState.add(0x488).readPointer();
        resetSpells(SpellManager);
    }
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getArraySize(TArray) {
    return TArray.add(8).readU32();
}
function getArrayItemAddr(TArray, size, index) {
    var ArrNum = getArraySize(TArray);
    if (index > ArrNum)
        return null;
    return TArray.readPointer().add(index * size);
}
async function Reducecooling(SpellManager){
    await sleep(1000);
    var SpellCooldowns = SpellManager.add(0x2A8)
    for(var i = 0; i < getArraySize(SpellCooldowns); i++) {
        var SpellCooldown = getArrayItemAddr(SpellCooldowns, 16, i);
        var ServerUsedTime = SpellCooldown.add(8);
        ServerUsedTime.writeFloat(ServerUsedTime.readFloat() - 300);
        var SpellChargeLevel = SpellManager.add(0x284);
        SpellChargeLevel.writeFloat(SpellChargeLevel.readFloat() + 1);

    }
}

Interceptor.attach(ADH_SpellManager_CastSpell_addr, {
    onEnter : function(args) {
        var SpellManager = args[0];
        Reducecooling(SpellManager)
    }
});
