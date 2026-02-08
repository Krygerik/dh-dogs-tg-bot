
var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

var FActorSpawnParameters_FActorSpawnParameters = new NativeFunction(base.add(0x29584A0), 'void', ['pointer'], 'win64');
var UWorld_SpawnActor = new NativeFunction(base.add(0x2624510), 'pointer', ['pointer', 'pointer', 'pointer', 'pointer'], 'win64');
var UObject_GetWorld = new NativeFunction(base.add(0x13075A0), 'pointer', ['pointer'], 'win64');

var UClass_GetPrivateStaticClass = new NativeFunction(base.add(0x11F02E0), 'pointer', [], 'win64');

var StaticLoadObject = new NativeFunction(base.add(0x137B290), 'pointer', ['pointer', 'pointer', 'pointer', 'pointer', 'int32', 'pointer', 'int8', 'pointer'], 'win64');
var StaticFindObject = new NativeFunction(base.add(0x137AAA0), 'pointer', ['pointer', 'pointer', 'pointer', 'int8'], 'win64');


var ADH_SpellManager_CastSpell = new NativeFunction(base.add(0xE634A0), 'pointer', ['pointer', 'pointer', 'pointer'], 'win64');
var ADH_SpellManager_SetEquippedSpells = new NativeFunction(base.add(0xE81F00), 'pointer', ['pointer', 'pointer'], 'win64');
var UDH_GameInstance_GetInstance = new NativeFunction(base.add(0xD93240), 'pointer', ['pointer'], 'win64');
var ADH_SpellManager_SetSpellChargeTier = new NativeFunction(base.add(0xE82CF0), 'void', ['pointer', 'int8'], 'win64');

var FTransform_Identity = base.add(0x4559220);


function logInfo(Info) {
    var f = new File('output.log', 'a');
    f.write('[Patches] ' + Info + '\n');
    f.close();
}

function findClassByName(ClassName) {
    return findObjectByName(ClassName, UClass_GetPrivateStaticClass());
}
function findObjectByName(ObjectName, Clazz) {
    var Buffer = Memory.alloc((ObjectName.length + 1) * 2);
    Buffer.writeUtf16String(ObjectName);
    return StaticFindObject(Clazz, ptr(0xFFFFFFFFFFFFFFFF), Buffer, 0);
}

function spawnActor(World, Clazz, Position, Owner) {
    var Parameters = Memory.alloc(0x30);
    FActorSpawnParameters_FActorSpawnParameters(Parameters);
    Parameters.add(0x10).writePointer(Owner);
    return UWorld_SpawnActor(World, Clazz, Position, Parameters);
}

function getActorTransform(AActor) {
    var RootComponent = AActor.add(0x130).readPointer();
    if(RootComponent.isNull()) {
        return ptr(0);
    }
    var ComponentToWorld = RootComponent.add(0x1C0);
    return ComponentToWorld;
}
var GWorld = base.add(0x46ED420);
function getGameState()
{
    var AuthorityGameMode = GWorld.readPointer().add(0x118).readPointer();
    var GameState = AuthorityGameMode.add(0x280).readPointer();
    return GameState;
}

function castSpell(Caster, SpellName, CastTarget, SpellChargeLevel){
    var World = UObject_GetWorld(Caster);
    var SpellManagerClass = findClassByName('/Game/Blueprints/Game/Totems/BP_PlayerSpellManager.BP_PlayerSpellManager_C');
    if(SpellManagerClass.isNull()) {
        return false;
    }
    var SpellManager = spawnActor(World, SpellManagerClass, FTransform_Identity, Caster);
    var SpellClass = findClassByName(SpellName);
    if(SpellManager.isNull() || SpellClass.isNull()) {
        return false;
    }
    var GameInstance = UDH_GameInstance_GetInstance(SpellManager);
    var ThrallSpells = GameInstance.add(0x440);
    ADH_SpellManager_SetEquippedSpells(SpellManager, ThrallSpells);
    ADH_SpellManager_SetSpellChargeTier(SpellManager, SpellChargeLevel + 0);
    /*
    SpellChargeLevel + 

    0 = 1 Level
    1 = 2 Level
    2 = 3 Level
    */
    var Spell = ADH_SpellManager_CastSpell(SpellManager, SpellClass, CastTarget);
    return true;
}
/*

[0, '/Game/Blueprints/Game/Totems/TS_Hush.TS_Hush_C'], 
1 Level = 30s
2 Level = 45s
3 Level = 60s

[1, '/Game/Blueprints/Game/Totems/TS_Whiteout.TS_Whiteout_C'] 
1 Level = 50s
2 Level = 70s
3 Level = 90s

*/
var ADH_HumanCharacter_AddStartingInventory_addr = base.add(0xD46F10);
Interceptor.attach(ADH_HumanCharacter_AddStartingInventory_addr, {
    onEnter : function(args) {
        var GameState = getGameState();
        castSpell(GameState, '/Game/Blueprints/Game/Totems/TS_Hush.TS_Hush_C', ptr(0), 2);
    }
});
