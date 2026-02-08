/**
 * Starting Tools Mod
 * 
 * Adds IceAxe (кирка) and WoodAxe (топор) to player inventory at game start
 * 
 * Based on quest_system.js approach
 */

var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

if (base === null) {
    send('[StartingTools] ERROR: Could not find module base address');
}

// ============================================================================
// Function addresses
// ============================================================================
var UDH_InventoryManager_AddInventory = new NativeFunction(
    base.add(0xDBC040), 
    'void', 
    ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int8', 'pointer'], 
    'win64'
);

var UClass_GetPrivateStaticClass = new NativeFunction(
    base.add(0x11F02E0), 
    'pointer', 
    [], 
    'win64'
);

var StaticFindObject = new NativeFunction(
    base.add(0x137AAA0), 
    'pointer', 
    ['pointer', 'pointer', 'pointer', 'int8'], 
    'win64'
);

var ADH_HumanCharacter_AddStartingInventory_addr = base.add(0xD46F10);

// ============================================================================
// Item class paths
// ============================================================================
var ICEAXE_CLASS = '/Game/Blueprints/Inventory/IceAxe/BP_IceAxe_Inventory.BP_IceAxe_Inventory_C';
var WOODAXE_CLASS = '/Game/Blueprints/Inventory/WoodAxe/BP_WoodAxe_Inventory.BP_WoodAxe_Inventory_C';
var BONEDAGGER_CLASS = '/Game/Blueprints/Inventory/BoneDagger/BP_BoneDagger_Inventory.BP_BoneDagger_Inventory_C';

// ============================================================================
// Items to add at start
// ============================================================================
var ITEMS_TO_ADD = [
    ICEAXE_CLASS,    // Кирка / Ледоруб
    WOODAXE_CLASS,   // Топор дровосека
    // BONEDAGGER_CLASS, // Костяной нож (uncomment if needed)
];

// ============================================================================
// Helper functions
// ============================================================================
function logInfo(info) {
    send('[StartingTools] ' + info);
}

function findClassByName(ClassName) {
    return findObjectByName(ClassName, UClass_GetPrivateStaticClass());
}

function findObjectByName(ObjectName, Clazz) {
    var Buffer = Memory.alloc((ObjectName.length + 1) * 2);
    Buffer.writeUtf16String(ObjectName);
    return StaticFindObject(Clazz, ptr(0xFFFFFFFFFFFFFFFF), Buffer, 0);
}

function InitItemState(State) {
    var prand = Math.floor(Math.random() * 25565);
    State.writeU32(prand);          // Random ID
    State.add(0x4).writeU8(1);      // Stack count
    State.add(0x8).writeFloat(1.0); // Durability
    State.add(0xC).writeU8(0);
    State.add(0xD).writeU8(0);
    State.add(0xE).writeU8(0);
    State.add(0x10).writePointer(ptr(0));
    State.add(0x18).writePointer(ptr(0));
    State.add(0x20).writePointer(ptr(0));
    State.add(0x28).writePointer(ptr(0));
    State.add(0x30).writePointer(ptr(0));
}

function addInventoryItem(HumanCharacter, ClassName) {
    try {
        var ItemClass = findClassByName(ClassName);
        if (ItemClass.isNull()) {
            logInfo('ERROR: Could not find class: ' + ClassName);
            return false;
        }
        
        var InventoryComponent = HumanCharacter.add(0x808).readPointer();
        if (InventoryComponent.isNull()) {
            logInfo('ERROR: InventoryComponent is null');
            return false;
        }
        
        // Create item state array
        var Array = Memory.alloc(16 + 56);
        Array.writePointer(Array.add(16));
        Array.add(8).writeU32(1);   // Array num
        Array.add(12).writeU32(1); // Array max
        InitItemState(Array.readPointer());
        
        // Create buffer for slot indices
        var Buffer = Memory.alloc(8);
        Buffer.writeU32(0);
        Buffer.add(4).writeU32(0xffffffff);
        
        // Add inventory
        UDH_InventoryManager_AddInventory(
            InventoryComponent, 
            ItemClass, 
            Array, 
            Buffer, 
            Buffer.add(4), 
            0,  // bAllowStacking
            ptr(0)  // Pawn
        );
        
        // Extract item name for logging
        var itemName = ClassName.split('/').pop().replace('.BP_', ' ').replace('_Inventory_C', '');
        logInfo('Added: ' + itemName);
        return true;
        
    } catch(e) {
        logInfo('ERROR adding item: ' + e.message);
        return false;
    }
}

// ============================================================================
// HOOK: AddStartingInventory - add items when player gets starting inventory
// ============================================================================
Interceptor.attach(ADH_HumanCharacter_AddStartingInventory_addr, {
    onEnter: function(args) {
        this.HumanCharacter = args[0];
    },
    onLeave: function(ret) {
        var HumanCharacter = this.HumanCharacter;
        
        logInfo('Player spawned, adding starting tools...');
        
        // Add all configured items
        for (var i = 0; i < ITEMS_TO_ADD.length; i++) {
            addInventoryItem(HumanCharacter, ITEMS_TO_ADD[i]);
        }
        
        logInfo('Starting tools added successfully!');
    }
});

// ============================================================================
// Startup
// ============================================================================
send('[StartingTools] Loaded!');
send('  Items to add at game start:');
send('    - IceAxe (Кирка/Ледоруб)');
send('    - WoodAxe (Топор дровосека)');
send('  Hook: ADH_HumanCharacter::AddStartingInventory (0xD46F10)');

