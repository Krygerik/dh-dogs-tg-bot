/**
 * Скрипт для фиксирования координат.
 * Для фиксирования координат необходимо выбрать в прицел нужную точку в пространстве и активировать чай/похлебку
 * записываются координаты, на которые нацелен персонаж.
 * 
 * Координаты выводятся мафским сообщением для применившего игрока.
 * В зависимости от настроек скрипта-фриды может записывать в файл.
 * Фиксирования координат - запас чая пополняется на 1 
 */

var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

var ADH_HumanCharacter_AddStartingInventory_addr = base.add(0xD46F10);

var UClass_GetPrivateStaticClass = new NativeFunction(base.add(0x11F02E0), 'pointer', [], 'win64');
var UDH_InventoryManager_AddInventory = new NativeFunction(base.add(0xDBC040), 'void', ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int8', 'pointer'], 'win64');
var StaticFindObject = new NativeFunction(base.add(0x137AAA0), 'pointer', ['pointer', 'pointer', 'pointer', 'int8'], 'win64');
var ADH_PlayerState_GetOwningController = new NativeFunction(base.add(0xE39820), 'pointer', ['pointer'], 'win64');

var QuestName = "/Game/Blueprints/Inventory/Quest/BP_Quest_Inventory.BP_Quest_Inventory_C";
var FlintlockName ='/Game/Blueprints/Inventory/Flintlock/BP_Flintlock_Inventory.BP_Flintlock_Inventory_C';
var FlintName ='/Game/Blueprints/Inventory/Flint/BP_GunParts_Inventory.BP_GunParts_Inventory_C';
var SwordName ='/Game/Blueprints/Inventory/Sword/BP_Sword_Inventory.BP_Sword_Inventory_C';
var WoodAxeName ='/Game/Blueprints/Inventory/WoodAxe/BP_WoodAxe_Inventory.BP_WoodAxe_Inventory_C';
var StewName = '/Game/Blueprints/Inventory/Meat/BP_Stew_Inventory.BP_Stew_Inventory_C';
var TeaName = '/Game/Blueprints/Inventory/Tea/BP_Tea_Inventory.BP_Tea_Inventory_C';

// START ***** ADD UTEM TO CHAR
function findObjectByName(ObjectName, Clazz) {
    var Buffer = Memory.alloc((ObjectName.length + 1) * 2);
    Buffer.writeUtf16String(ObjectName);
    return StaticFindObject(Clazz, ptr(0xFFFFFFFFFFFFFFFF), Buffer, 0);
}

function findClassByName(ClassName) {
    return findObjectByName(ClassName, UClass_GetPrivateStaticClass());
}

function InitItemState(State) {
    var prand = Math.floor(Math.random() * 25565);
    State.writeU32(prand);
    State.add(0x4).writeU8(1);
    State.add(0x8).writeFloat(1.0);
    State.add(0xC).writeU8(0);
    State.add(0xD).writeU8(0);
    State.add(0xE).writeU8(0);
    State.add(0x10).writePointer(ptr(0));
    State.add(0x18).writePointer(ptr(0));
    State.add(0x20).writePointer(ptr(0));
    State.add(0x28).writePointer(ptr(0));
    State.add(0x30).writePointer(ptr(0));
}

function AddItemByItemNameToHumanCharacter(HumanCharacter, ItemName) {
    var InventoryComponent = HumanCharacter.add(0x808).readPointer();
    var ItemClass = findClassByName(ItemName);
    var Array = Memory.alloc(16 + 56);
    Array.writePointer(Array.add(16));
    Array.add(8).writeU32(1);
    Array.add(12).writeU32(1);
    InitItemState(Array.readPointer());
    var Buffer = Memory.alloc(8);
    Buffer.writeU32(0);
    Buffer.add(4).writeU32(0xffffffff);
    UDH_InventoryManager_AddInventory(InventoryComponent, ItemClass, Array, Buffer, Buffer.add(4), 0, ptr(0));
}

Interceptor.attach(ADH_HumanCharacter_AddStartingInventory_addr, {
    onEnter: function(args) {
        this.HumanCharacter = args[0];
    },
    onLeave : function(ret) {
        AddItemByItemNameToHumanCharacter(this.HumanCharacter, StewName);
        AddItemByItemNameToHumanCharacter(this.HumanCharacter, TeaName);

        var PlayerState = this.HumanCharacter.add(0x240).readPointer();
        var PlayerController = ADH_PlayerState_GetOwningController(PlayerState);

        SendMessage(PlayerController, "Tea and stew are given to the player");
    }
});

// END ***** ADD UTEM TO CHAR

// START ***** ANNOUNCEMENT
var ADH_GameState_Tick = base.add(0xDAD420);
var ADH_HumanCharacter_GetSelectedInventory = new NativeFunction(base.add(0x0D59620), 'void', [], 'win64');
var ADH_HumanCharacter_GetWarmthRateOfChange = new NativeFunction(base.add(0x0D5A6B0), 'void', [], 'win64');
var UGameplayStatics_GetPlayerController = new NativeFunction(base.add(0x25630D0), 'pointer', ['pointer', 'int32']);

function getArraySize(TArray) {
    return TArray.add(8).readU32();
}

function getArrayItemAddr(TArray, size, index) {
    var ArrNum = getArraySize(TArray);
    if (index > ArrNum)
        return null;
    return TArray.readPointer().add(index * size);
}

function GetPlayerAddress(GameState) {
    var PlayerArray = GameState.add(0x238);
    var PlayerStateArray = []
    for (var i = 0; i < getArraySize(PlayerArray); i++) {
        var PlayerState = getArrayItemAddr(PlayerArray, 8, i).readPointer();
        PlayerStateArray.push(PlayerState);
    }
    return PlayerStateArray;
}

var FName_FName = new NativeFunction(base.add(0x1158F20), "void", ["pointer", "pointer", "int8"]);
var FText_FromName = new NativeFunction(base.add(0x1096370), "pointer", ["pointer","pointer"]);
var ADH_PlayerController_ReceiveThrallMessage = new NativeFunction(base.add(0xEE7810), "void", ["pointer", "pointer", "pointer"]);

function newFName(Name) {
    var FName_Buffer = Memory.alloc(8);
    var Buffer = Memory.alloc((Name.length + 4) * 2);
    Buffer.writeUtf16String("   " + Name);
    FName_FName(FName_Buffer,Buffer,1)
    return FName_Buffer
}
function FNameToFText(FName){
    var FText_Buffer = Memory.alloc(24)
    FText_FromName(FText_Buffer,FName)
    return FText_Buffer
}
function SendThrallMessage(PlayerController,Message,Usound){
    var FName_Message = newFName(Message)
    var FText_Message = FNameToFText(FName_Message)
    ADH_PlayerController_ReceiveThrallMessage(PlayerController,FText_Message,Usound)
}
function SendMessage(PlayerController, Info) {
    SendThrallMessage(PlayerController, Info, ptr(0));
    send(Info)
}

var ADH_PlayerController_SelectBoneDagger_Simulated = new NativeFunction(
    base.add(0xE4CE60),
    'void',
    ['pointer'],
    'win64'
);

var ADH_HumanCharacter_SetSpiritWalkAppearance = new NativeFunction(
    base.add(0xD713D0),
    'void',
    ['pointer', 'bool'],
    'win64'
);

var PrevGameState = {};
function GetMessageByThingValues(PlayerStateArray) {
    for (var i = 0; i < PlayerStateArray.length; i++) {
        var PlayerState = PlayerStateArray[i];
        var PlayerId = PlayerState.add(0x224).readU8();
        var HumanCharacter = PlayerState.add(0x280).readPointer();
        var WarmthBoostRemaining = HumanCharacter.add(0xff4).readFloat();
        var HungerBoostRemaining = HumanCharacter.add(0xff8).readFloat();
        var ReplicatedLookDir = HumanCharacter.add(0xaf4);
        const X = ReplicatedLookDir.readFloat();
        const Y = ReplicatedLookDir.add(4).readFloat(); // Offset 0x4 bytes for Y
        const Z = ReplicatedLookDir.add(8).readFloat(); // Offset 0x8 bytes for Z
        
        var PlayerController = UGameplayStatics_GetPlayerController(PlayerState, PlayerId)
 
        if (PrevGameState[PlayerId] && WarmthBoostRemaining > PrevGameState[PlayerId]['WarmthBoostRemaining'] && HungerBoostRemaining > PrevGameState[PlayerId]['HungerBoostRemaining']) {
            SendMessage(PlayerController, `Location: X=${X.toFixed(2)}, Y=${Y.toFixed(2)}, Z=${Z.toFixed(2)}`)
            AddItemByItemNameToHumanCharacter(HumanCharacter, TeaName);


            ADH_PlayerController_SelectBoneDagger_Simulated(PlayerController);
            ADH_HumanCharacter_SetSpiritWalkAppearance(HumanCharacter, 1);
        }

        PrevGameState[PlayerId] = {
            WarmthBoostRemaining: WarmthBoostRemaining,
            HungerBoostRemaining: HungerBoostRemaining,
        }
    }
}

Interceptor.attach(ADH_GameState_Tick, {
    onEnter: function(args) {
        var GameState = args[0];
        var PlayerArray = GetPlayerAddress(GameState);

        GetMessageByThingValues(PlayerArray);
    }
});
