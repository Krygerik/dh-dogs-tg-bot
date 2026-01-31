

var base = Module.findBaseAddress("DreadHungerServer-Win64-Shipping.exe");

var SpellSelection = [[0, 1, 3, 2, 4], [0, 1, 3, 2, 4]];
var Max = 0;

function logInfo(Info) {
    var f = new File('output.log', 'a');
    f.write('[Patches] ' + Info + '\n');
    f.close();
}
for(var i = 0; i < SpellSelection.length; i++)
{
    if(SpellSelection[i].length > Max) {
        Max = SpellSelection[i].length;
    }
}
/*

SpellSelection
0: Cannibals
1: White
2: Clone
3: Spirit
4: Hash

*/

//SpellManager
var ADH_SpellManager_SetEquippedSpells_addr = base.add(0xE81F00);

var UDH_GameInstance_GetInstance = new NativeFunction(base.add(0xD93240), 'pointer', ['pointer'], 'win64');

function getArraySize(TArray){
    return TArray.add(8).readU32();
}
function getArrayItemAddr(TArray, size, index){
    var ArrNum = getArraySize(TArray);
    if(index > ArrNum)
        return null;
    return TArray.readPointer().add(index * size);
}
//SetInThrall SpellManager



var Count = 0;
var SpellList = Memory.alloc(0x100);
SpellList.writePointer(SpellList.add(16));
SpellList.add(12).writeU32(Max);

Interceptor.attach(ADH_SpellManager_SetEquippedSpells_addr, {
    onEnter : function(args) {
        var SpellManager = args[0];
	    SpellManager.add(0x228).writeU32(Max);
        var GameInstance = UDH_GameInstance_GetInstance(SpellManager);
        var ThrallSpells = GameInstance.add(0x440);
        var Size = getArraySize(ThrallSpells);
        
        if(Count == SpellSelection.length) {
            Count = 0;
        }
        SpellList.add(8).writeU32(SpellSelection[Count].length);
        for(var i = 0; i < SpellSelection[Count].length; i++) {
            if(SpellSelection[Count][i] >= Size) {
                return;
            }
            var SpellType = getArrayItemAddr(ThrallSpells, 8, SpellSelection[Count][i]);
            SpellList.add(16 + 8 * i).writePointer(SpellType.readPointer());
        }
        args[1] = SpellList;
        Count++;
        
        
    }

});