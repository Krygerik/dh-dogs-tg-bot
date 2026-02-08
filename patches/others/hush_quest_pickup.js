/**
 * Hush Quest Pickup Mod
 * 
 * At game start: Removes Quest item from starting inventory
 * When Hush spell is cast: Spawns Quest pickup and player picks it up
 * 
 * Uses pickup action instead of direct AddInventory
 */

var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

// Function addresses
var ADH_HumanCharacter_AddStartingInventory_addr = base.add(0xD46F10);
var ADH_SpellManager_CastSpell_addr = base.add(0xE634F0);
var UClass_GetPrivateStaticClass = new NativeFunction(base.add(0x11F02E0), 'pointer', [], 'win64');
var StaticFindObject = new NativeFunction(base.add(0x137AAA0), 'pointer', ['pointer', 'pointer', 'pointer', 'int8'], 'win64');
var StaticLoadObject = new NativeFunction(base.add(0x137B290), 'pointer', ['pointer', 'pointer', 'pointer', 'pointer', 'int32', 'pointer', 'int8', 'pointer'], 'win64');
var ADH_PlayerState_GetOwningController = new NativeFunction(base.add(0xE39820), 'pointer', ['pointer'], 'win64');

// Spawn actor functions
var FActorSpawnParameters_FActorSpawnParameters = new NativeFunction(base.add(0x29584A0), 'void', ['pointer'], 'win64');
var UWorld_SpawnActor = new NativeFunction(base.add(0x2624510), 'pointer', ['pointer', 'pointer', 'pointer', 'pointer'], 'win64');
var UObject_GetWorld = new NativeFunction(base.add(0x13075A0), 'pointer', ['pointer'], 'win64');

// Pickup function - ADH_InventoryPickup::PickUp(AController*, int)
var ADH_InventoryPickup_PickUp = new NativeFunction(base.add(0xDDA3E0), 'void', ['pointer', 'pointer', 'int32'], 'win64');

// Remove item from inventory
var ADH_Inventory_DecreaseItemStack = new NativeFunction(base.add(0xDC56D0), 'void', ['pointer', 'int32', 'int8', 'int8'], 'win64');

// Logging helper
function logInfo(Info) {
    var f = new File('output.log', 'a');
    f.write('[HushQuestPickup] ' + Info + '\n');
    f.close();
}

// Find object by name
function findClassByName(ClassName) {
    return findObjectByName(ClassName, UClass_GetPrivateStaticClass());
}

function findObjectByName(ObjectName, Clazz) {
    var Buffer = Memory.alloc((ObjectName.length + 1) * 2);
    Buffer.writeUtf16String(ObjectName);
    return StaticFindObject(Clazz, ptr(0xFFFFFFFFFFFFFFFF), Buffer, 0);
}

function loadClassByName(ClassName) {
    return loadObjectByName(ClassName, UClass_GetPrivateStaticClass());
}

function loadObjectByName(ObjectName, Clazz) {
    var Buffer = Memory.alloc((ObjectName.length + 1) * 2);
    Buffer.writeUtf16String(ObjectName);
    return StaticLoadObject(Clazz, ptr(0), Buffer, ptr(0), 0, ptr(0), 1, ptr(0));
}

function getClass(ClassName) {
    var Clazz = findClassByName(ClassName);
    if (!Clazz.isNull()) {
        return Clazz;
    }
    return loadClassByName(ClassName);
}

// Array utilities
function getArraySize(TArray) {
    return TArray.add(8).readU32();
}

function getArrayItemAddr(TArray, size, index) {
    var ArrNum = getArraySize(TArray);
    if (index > ArrNum)
        return null;
    return TArray.readPointer().add(index * size);
}

// Get actor transform for spawning at player location
function getActorTransform(AActor) {
    var RootComponent = AActor.add(0x130).readPointer();
    if (RootComponent.isNull()) {
        return ptr(0);
    }
    var ComponentToWorld = RootComponent.add(0x1C0);
    return ComponentToWorld;
}

// Spawn actor at position
function spawnActor(World, Clazz, Position, Owner) {
    var Parameters = Memory.alloc(0x30);
    FActorSpawnParameters_FActorSpawnParameters(Parameters);
    if (!Owner.isNull()) {
        Parameters.add(0x10).writePointer(Owner);
    }
    return UWorld_SpawnActor(World, Clazz, Position, Parameters);
}

// Class names
var HushSpellName = '/Game/Blueprints/Game/Totems/TS_Hush.TS_Hush_C';
var QuestItemName = '/Game/Blueprints/Inventory/Quest/BP_Quest_Inventory.BP_Quest_Inventory_C';

// Cached class pointers
var HushSpellClass = ptr(0);
var QuestItemClass = ptr(0);
var QuestPickupClass = ptr(0);

var Init = false;

// Initialize classes
function initClasses() {
    HushSpellClass = findClassByName(HushSpellName);
    QuestItemClass = findClassByName(QuestItemName);
    
    if (HushSpellClass.isNull() || QuestItemClass.isNull()) {
        logInfo('Failed to find spell or item class');
        return false;
    }
    
    // Get pickup class from Quest inventory default object
    // ADH_Inventory has PickupClass at offset 0x2A8
    var DefaultObject = QuestItemClass.add(0x118).readPointer();
    if (!DefaultObject.isNull()) {
        QuestPickupClass = DefaultObject.add(0x2A8).readPointer();
        if (QuestPickupClass.isNull()) {
            logInfo('Quest item has no pickup class, using fallback');
            // Fallback: try to find a generic pickup or use another item's pickup
            // We'll spawn the inventory directly and use a workaround
        }
    }
    
    logInfo('Classes initialized - HushSpell: ' + HushSpellClass + ', QuestItem: ' + QuestItemClass);
    return true;
}

// Find Quest item in inventory
function findQuestInventory(InventoryManager) {
    if (InventoryManager.isNull()) {
        return ptr(0);
    }
    
    var StoredInventory = InventoryManager.add(0x138);
    var Size = getArraySize(StoredInventory);
    
    for (var i = 0; i < Size; i++) {
        var Inventory = getArrayItemAddr(StoredInventory, 8, i).readPointer();
        if (Inventory.isNull()) {
            continue;
        }
        var ItemClass = Inventory.add(0x10).readPointer();
        if (ItemClass.equals(QuestItemClass)) {
            return Inventory;
        }
    }
    return ptr(0);
}

// Remove Quest item from inventory
function removeQuestItem(QuestInventory) {
    if (QuestInventory.isNull()) {
        return false;
    }
    // DecreaseItemStack(Inventory, Amount, bDrop=false, bDestroy=true)
    ADH_Inventory_DecreaseItemStack(QuestInventory, 1, 0, 1);
    logInfo('Quest item removed from inventory');
    return true;
}

// Spawn Quest pickup at player and make them pick it up
function spawnAndPickupQuest(HumanCharacter, PlayerController) {
    var World = UObject_GetWorld(HumanCharacter);
    if (World.isNull()) {
        logInfo('World is null');
        return false;
    }
    
    // Get player position
    var Transform = getActorTransform(HumanCharacter);
    if (Transform.isNull()) {
        logInfo('Transform is null');
        return false;
    }
    
    // Check if we have a pickup class
    if (!QuestPickupClass.isNull()) {
        logInfo('Spawning Quest pickup at player location');
        var Pickup = spawnActor(World, QuestPickupClass, Transform, HumanCharacter);
        
        if (!Pickup.isNull()) {
            logInfo('Pickup spawned: ' + Pickup + ', calling PickUp');
            // Call PickUp(Controller, SlotIndex) - SlotIndex -1 means any available slot
            ADH_InventoryPickup_PickUp(Pickup, PlayerController, -1);
            logInfo('PickUp called successfully');
            return true;
        } else {
            logInfo('Failed to spawn pickup');
        }
    } else {
        // Fallback: spawn the inventory item directly and set it up
        logInfo('No pickup class, spawning inventory item directly');
        var Inventory = spawnActor(World, QuestItemClass, Transform, HumanCharacter);
        
        if (!Inventory.isNull()) {
            logInfo('Inventory item spawned: ' + Inventory);
            // The spawned inventory will be a pickup that player can interact with
            // or we need to use a different approach
            
            // Try to get the pickup class from the spawned inventory
            var PickupClassPtr = Inventory.add(0x2A8).readPointer();
            if (!PickupClassPtr.isNull()) {
                var ActualPickup = spawnActor(World, PickupClassPtr, Transform, HumanCharacter);
                if (!ActualPickup.isNull()) {
                    ADH_InventoryPickup_PickUp(ActualPickup, PlayerController, -1);
                    return true;
                }
            }
        }
    }
    
    return false;
}

// Track players who need Quest item when Hush is cast
var PlayersWithoutQuest = new Map();

// Hook AddStartingInventory - remove Quest at game start
Interceptor.attach(ADH_HumanCharacter_AddStartingInventory_addr, {
    onEnter: function(args) {
        this.HumanCharacter = args[0];
    },
    onLeave: function(ret) {
        if (!Init) {
            if (!initClasses()) {
                return;
            }
            Init = true;
        }
        
        var HumanCharacter = this.HumanCharacter;
        var InventoryManager = HumanCharacter.add(0x808).readPointer();
        
        if (InventoryManager.isNull()) {
            return;
        }
        
        // Find and remove Quest item
        var QuestInventory = findQuestInventory(InventoryManager);
        if (!QuestInventory.isNull()) {
            removeQuestItem(QuestInventory);
            
            // Mark this player as needing Quest when Hush is cast
            var PlayerState = HumanCharacter.add(0x240).readPointer();
            if (!PlayerState.isNull()) {
                PlayersWithoutQuest.set(PlayerState.toString(), true);
                logInfo('Quest removed at start, player marked for Hush reward');
            }
        }
    }
});

// Hook spell casting - give Quest back when Hush is cast
Interceptor.attach(ADH_SpellManager_CastSpell_addr, {
    onEnter: function(args) {
        if (!Init) {
            return;
        }
        
        var SpellManager = args[0];
        var SpellType = args[2];
        
        // Check if this is the Hush spell
        if (!SpellType.equals(HushSpellClass)) {
            return;
        }
        
        logInfo('Hush spell detected!');
        
        // Get PlayerState from SpellManager
        var PlayerState = SpellManager.add(0xE0).readPointer();
        if (PlayerState.isNull()) {
            logInfo('PlayerState is null');
            return;
        }
        
        // Check if this player needs the Quest item
        var playerKey = PlayerState.toString();
        if (!PlayersWithoutQuest.has(playerKey) || !PlayersWithoutQuest.get(playerKey)) {
            logInfo('Player already has Quest or not marked');
            return;
        }
        
        // Get PlayerController
        var PlayerController = ADH_PlayerState_GetOwningController(PlayerState);
        if (PlayerController.isNull()) {
            logInfo('PlayerController is null');
            return;
        }
        
        // Get HumanCharacter
        var HumanCharacter = PlayerController.add(0x588).readPointer();
        if (HumanCharacter.isNull()) {
            logInfo('HumanCharacter is null');
            return;
        }
        
        // Spawn and pickup Quest
        logInfo('Giving Quest item via pickup');
        if (spawnAndPickupQuest(HumanCharacter, PlayerController)) {
            // Mark player as having received Quest
            PlayersWithoutQuest.set(playerKey, false);
            logInfo('Quest item given successfully via pickup!');
        } else {
            logInfo('Failed to give Quest item');
        }
    }
});

logInfo('Hush Quest Pickup mod loaded');
console.log('[HushQuestPickup] Mod loaded - Quest removed at start, given back via pickup when Hush is cast');

