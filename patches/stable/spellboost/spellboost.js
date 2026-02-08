

var base = Module.findBaseAddress("DreadHungerServer-Win64-Shipping.exe");
var ADH_SpellManager_CastSpell_addr = base.add(0xE634F0);

var UClass_GetPrivateStaticClass = new NativeFunction(base.add(0x11F02E0), 'pointer', [], 'win64');
var StaticFindObject = new NativeFunction(base.add(0x137AAA0), 'pointer', ['pointer', 'pointer', 'pointer', 'int8'], 'win64');
var ADH_PlayerState_GetOwningController = new NativeFunction(base.add(0xE39820), 'pointer', ['pointer'], 'win64');


function findClassByName(ClassName) {
    return findObjectByName(ClassName, UClass_GetPrivateStaticClass());
}
function findObjectByName(ObjectName, Clazz) {
    var Buffer = Memory.alloc((ObjectName.length + 1) * 2);
    Buffer.writeUtf16String(ObjectName);
    return StaticFindObject(Clazz, ptr(0xFFFFFFFFFFFFFFFF), Buffer, 0);
}
var TotemSpells = [
    '/Game/Blueprints/Game/Totems/TS_SpiritWalk.TS_SpiritWalk_C',
    '/Game/Blueprints/Game/Totems/TS_Whiteout.TS_Whiteout_C',
    '/Game/Blueprints/Game/Totems/TS_Hush.TS_Hush_C',
    '/Game/Blueprints/Game/Totems/TS_Doppelganger.TS_Doppelganger_C',
    '/Game/Blueprints/Game/Totems/TS_CannibalAttack.TS_CannibalAttack_C'
];

function initSpellClass() {
    var NewClasses = [];
    for (var i = 0; i < TotemSpells.length; i++) {
        var Clazz = findClassByName(TotemSpells[i]);
        if(Clazz.isNull()) {
            return false;
        }
        NewClasses.push(Clazz);
    }
    TotemSpells = NewClasses;
    return true;
}
var HealTier = [    
    [0, 0, 0],          // Spirit Form
    [25, 35, 50],          // White
    [25, 35, 50],          // Silence
    [25, 35, 50],        // Doppelgänger
    [25, 35, 60]          // Cannibals
];
var HungerTier = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
];
var WarmthTier = [
    [0, 0, 0],
    [10, 20, 30],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
];
var Init = false;
Interceptor.attach(ADH_SpellManager_CastSpell_addr, {
    onEnter : function(args) {
        if(!Init) {
            if(!initSpellClass()) {
                return;
            }
            Init = true;
        }
        
        var SpellManager = args[0];
        var SpellType = args[2] ;
        //var CastTarget = args[3];
        var SpellTier = (args[4] & 0xff) - 2;
        var PlayerState = SpellManager.add(0xE0).readPointer();
        if(PlayerState.isNull()) {
            return;
        }
        var PlayerController = ADH_PlayerState_GetOwningController(PlayerState);
        if(PlayerController.isNull()) {
            return;
        }
        var ControlledHuman = PlayerController.add(0x588).readPointer();
        if(ControlledHuman.isNull()) {
            return;
        }

        for(var i = 0; i < TotemSpells.length; i++) {
            if(SpellType.equals(TotemSpells[i])) {
                var WarmthBoost = WarmthTier[i], HungerBoost = HungerTier[i], HealBoost = HealTier[i];
                var WarmthBoostRemaining = ControlledHuman.add(0xFF4);
                WarmthBoostRemaining.writeFloat(WarmthBoostRemaining.readFloat() + WarmthBoost[SpellTier]);
                var HungerBoostRemaining = ControlledHuman.add(0xFF8);
                HungerBoostRemaining.writeFloat(HungerBoostRemaining.readFloat() + HungerBoost[SpellTier]);
                var HealthBoostRemaining = ControlledHuman.add(0xFFC);
                HealthBoostRemaining.writeFloat(HealthBoostRemaining.readFloat() + HealBoost[SpellTier]);
                break;
            }
    
        }
        
    }
});
