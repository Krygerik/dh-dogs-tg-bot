/**
 * Climbing Ability Mod - Strategy v6 (Full Chain)
 * 
 * Allows ANY item to climb ice walls by hooking the FULL interaction chain
 * 
 * Interaction chain:
 * 1. CanInteractWith (checks if can interact at all) <- BLOCK HERE?
 * 2. CanBeInteractedWith (asks target if it allows)
 * 3. CanClimb (climbing specific check)
 * 4. AddClimber (actual climbing starts)
 */

var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

if (base === null) {
    send('[ClimbMod] ERROR: Could not find module base address');
}

// ============================================================================
// Function addresses
// ============================================================================
var FName_GetPlainNameString = new NativeFunction(base.add(0x11604F0), 'void', ['pointer', 'pointer'], 'win64');

// EARLY checks - before climbing
var ADH_HumanCharacter_CanInteractWith_addr = base.add(0xD4B9E0);     // 0x182 bytes - main check!
var UDH_InteractComponent_CanInteractWith_addr = base.add(0xE2EB90); // 0x5A0 bytes - component check

// Climbing checks
var ADH_Character_CanClimb_addr = base.add(0xD4B5C0);
var ADH_HumanCharacter_CanClimb_addr = base.add(0xD4B6F0);
// ClimbableActor_CanBeInteractedWith_addr is now ADH_ClimbableActor_CanBeInteractedWith_addr above

// ALL ADH_ClimbableActor methods
var ADH_ClimbableActor_BeginPlay_addr = base.add(0xDBDD60);
var ADH_ClimbableActor_AddClimber_addr = base.add(0xDBAA30);
var ADH_ClimbableActor_RemoveClimber_addr = base.add(0xDDF420);
var ADH_ClimbableActor_CanBeInteractedWith_addr = base.add(0xDC2520);
var ADH_ClimbableActor_OnInteract_addr = base.add(0xDD6DF0);
var ADH_ClimbableActor_GetClimberRotation_addr = base.add(0xDC9DB0);
var ADH_ClimbableActor_GetMovementDirection_addr = base.add(0xDCEDC0);
var ADH_ClimbableActor_GetPathPoint_addr = base.add(0xDCF7F0);
var ADH_ClimbableActor_InitSplineMesh_addr = base.add(0xDD34C0);
var ADH_ClimbableActor_OnConstruction_addr = base.add(0xDD6A30);
var ADH_ClimbableActor_GetClimbableMesh_addr = base.add(0xEA6B50);

// Inventory
var ADH_Inventory_Equip_addr = base.add(0xDC7AB0);
var ADH_Inventory_Use_addr = base.add(0xECC140);

// ============================================================================
// Constants
// ============================================================================
var OFFSET_InventoryType = 0x290;
var OFFSET_UClass = 0x10;

// ADH_ClimbableActor offsets (from Script_DreadHunger_class.h)
var OFFSET_RequiredInventory = 0x240;  // class ADH_Inventory* RequiredInventory
var OFFSET_MaxClimbers = 0x238;        // int32_t MaxClimbers
var OFFSET_ClimbingType = 0x278;       // enum class FEClimbableActorType ClimbingType

// ============================================================================
// Helpers
// ============================================================================
function logInfo(info) {
    send('[ClimbMod] ' + info);
}

function newFString(Length) {
    var FString = Memory.alloc(16 + Length * 2);
    FString.writePointer(FString.add(16));
    FString.add(8).writeU32(0);
    FString.add(12).writeU32(Length);
    return FString;
}

function isValidPointer(p) {
    try { return p && !p.isNull(); } catch(e) { return false; }
}

function getObjectName(UObject) {
    if (!isValidPointer(UObject)) return 'NULL';
    try {
        var NameBuffer = newFString(100);
        FName_GetPlainNameString(UObject.add(0x18), NameBuffer);
        var strPtr = NameBuffer.readPointer();
        if (!isValidPointer(strPtr)) return 'INVALID';
        return strPtr.readUtf16String();
    } catch(e) { return 'ERROR'; }
}

function getClassName(UObject) {
    if (!isValidPointer(UObject)) return 'NULL';
    try {
        var UClass = UObject.add(OFFSET_UClass).readPointer();
        return getObjectName(UClass);
    } catch(e) { return 'ERROR'; }
}

function getTypeName(typeValue) {
    var names = {
        24: 'BONEDAGGER', 31: 'ICEAXE', 32: 'WOODAXE',
        28: 'SWORD', 30: 'CLEAVER', 34: 'SHOVEL', 35: 'FISTS'
    };
    return names[typeValue] || ('TYPE_' + typeValue);
}

function getInventoryType(inventory) {
    if (!isValidPointer(inventory)) return -1;
    try {
        return inventory.add(OFFSET_InventoryType).readU8();
    } catch(e) { return -1; }
}

function isClimbableTarget(targetName) {
    if (!targetName) return false;
    var climbableKeywords = ['Climb', 'Ice', 'Wall', 'Rock', 'ColorMask', 'Axe', 'Wood', 'axe', 'wood'];
    for (var i = 0; i < climbableKeywords.length; i++) {
        if (targetName.indexOf(climbableKeywords[i]) !== -1) return true;
    }
    return false;
}

// ============================================================================
// HOOK 1: ADH_HumanCharacter::CanInteractWith - EARLIEST CHECK
// This is called BEFORE CanClimb to check if character can interact with target
// ============================================================================
Interceptor.attach(ADH_HumanCharacter_CanInteractWith_addr, {
    onEnter: function(args) {
        this.character = args[0];
        this.targetActor = args[1];
        this.targetName = isValidPointer(args[1]) ? getClassName(args[1]) : 'NULL';
    },
    onLeave: function(retval) {
        // Check if target is climbable
        if (isClimbableTarget(this.targetName)) {
            var originalResult = retval.toInt32();
            if (originalResult === 0) {
                retval.replace(ptr(1));
                logInfo('[CanInteractWith-Human] FORCED ALLOW for: ' + this.targetName);
            }
            // Removed spam logging for "Already allowed"
        }
    }
});

// ============================================================================
// HOOK 2: UDH_InteractComponent::CanInteractWith - COMPONENT CHECK
// ============================================================================
Interceptor.attach(UDH_InteractComponent_CanInteractWith_addr, {
    onEnter: function(args) {
        this.component = args[0];
        this.primitive = args[1];
        // args[2], args[3] are vectors
        // args[4] is bool
    },
    onLeave: function(retval) {
        var originalResult = retval.toInt32();
        if (originalResult === 0) {
            retval.replace(ptr(1));
            logInfo('[CanInteractWith-Component] FORCED ALLOW');
        }
    }
});

// ============================================================================
// HOOK 3: CanBeInteractedWith - Target asks if it allows interaction
// KEY: Clear RequiredInventory to remove item restriction!
// ============================================================================
Interceptor.attach(ADH_ClimbableActor_CanBeInteractedWith_addr, {
    onEnter: function(args) {
        this.climbableActor = args[0];
        
        // IMPORTANT: Clear RequiredInventory to allow climbing without specific item!
        if (isValidPointer(args[0])) {
            try {
                var requiredInv = args[0].add(OFFSET_RequiredInventory).readPointer();
                if (isValidPointer(requiredInv)) {
                    var reqClassName = getClassName(requiredInv);
                    logInfo('[CanBeInteractedWith] Original RequiredInventory: ' + reqClassName);
                    
                    // Set RequiredInventory to NULL - removes item restriction!
                    args[0].add(OFFSET_RequiredInventory).writePointer(ptr(0));
                    logInfo('[CanBeInteractedWith] RequiredInventory CLEARED - no item needed!');
                }
            } catch(e) {
                logInfo('[CanBeInteractedWith] Error clearing RequiredInventory: ' + e.message);
            }
        }
    },
    onLeave: function(retval) {
        var originalResult = retval.toInt32();
        if (originalResult === 0) {
            retval.replace(ptr(1));
            logInfo('[CanBeInteractedWith] FORCED ALLOW');
        }
    }
});

// ============================================================================
// HOOK 4: ADH_Character::CanClimb - Main climbing check
// ============================================================================
Interceptor.attach(ADH_Character_CanClimb_addr, {
    onLeave: function(retval) {
        var originalResult = retval.toInt32();
        if (originalResult === 0) {
            retval.replace(ptr(1));
            logInfo('[CanClimb-Base] FORCED ALLOW');
        }
    }
});

// ============================================================================
// HOOK 5: ADH_HumanCharacter::CanClimb
// ============================================================================
Interceptor.attach(ADH_HumanCharacter_CanClimb_addr, {
    onLeave: function(retval) {
        var originalResult = retval.toInt32();
        if (originalResult === 0) {
            retval.replace(ptr(1));
            logInfo('[CanClimb-Human] FORCED ALLOW');
        }
    }
});

// ============================================================================
// HOOK 6: AddClimber - When climbing actually starts
// ============================================================================
Interceptor.attach(ADH_ClimbableActor_AddClimber_addr, {
    onEnter: function(args) {
        try {
            var climbable = args[0];
            var character = args[1];
            var climbableClass = isValidPointer(climbable) ? getClassName(climbable) : 'Unknown';
            var characterClass = isValidPointer(character) ? getClassName(character) : 'Unknown';
            logInfo('[AddClimber] SUCCESS! Wall: ' + climbableClass + ' | Char: ' + characterClass);
        } catch(e) {}
    }
});

// ============================================================================
// HOOK 7: OnInteract - Interaction happens
// ============================================================================
Interceptor.attach(ADH_ClimbableActor_OnInteract_addr, {
    onEnter: function(args) {
        try {
            var actorClass = isValidPointer(args[0]) ? getClassName(args[0]) : 'Unknown';
            logInfo('[OnInteract] Climbing: ' + actorClass);
        } catch(e) {}
    }
});

// ============================================================================
// HOOK 8: Equip - log items
// ============================================================================
Interceptor.attach(ADH_Inventory_Equip_addr, {
    onEnter: function(args) {
        var inventory = args[0];
        if (!isValidPointer(inventory)) return;
        try {
            var invType = getInventoryType(inventory);
            var className = getClassName(inventory);
            if (className.indexOf('Dagger') !== -1 || className.indexOf('Axe') !== -1) {
                logInfo('[Equip] ' + className + ' | Type: ' + getTypeName(invType) + ' (' + invType + ')');
            }
        } catch(e) {}
    }
});

// ============================================================================
// ADH_ClimbableActor METHOD LOGGING
// ============================================================================

// HOOK 9: BeginPlay - when climbable actor is created
Interceptor.attach(ADH_ClimbableActor_BeginPlay_addr, {
    onEnter: function(args) {
        try {
            var actor = args[0];
            var className = getClassName(actor);
            var reqInv = actor.add(OFFSET_RequiredInventory).readPointer();
            var reqInvName = isValidPointer(reqInv) ? getClassName(reqInv) : 'NONE';
            var maxClimbers = actor.add(OFFSET_MaxClimbers).readS32();
            var climbType = actor.add(OFFSET_ClimbingType).readU8();
            logInfo('[BeginPlay] ' + className + ' | RequiredInventory: ' + reqInvName + ' | MaxClimbers: ' + maxClimbers + ' | ClimbType: ' + climbType);
        } catch(e) { logInfo('[BeginPlay] Error: ' + e.message); }
    }
});

// HOOK 10: RemoveClimber - when character stops climbing
Interceptor.attach(ADH_ClimbableActor_RemoveClimber_addr, {
    onEnter: function(args) {
        try {
            var actor = args[0];
            var character = args[1];
            logInfo('[RemoveClimber] Wall: ' + getClassName(actor) + ' | Char: ' + getClassName(character));
        } catch(e) {}
    }
});

// HOOK 11: GetClimberRotation - during climbing
Interceptor.attach(ADH_ClimbableActor_GetClimberRotation_addr, {
    onEnter: function(args) {
        try {
            var actor = args[0];
            var character = args[1];
            logInfo('[GetClimberRotation] Wall: ' + getClassName(actor) + ' | Char: ' + getClassName(character));
        } catch(e) {}
    }
});

// HOOK 12: GetMovementDirectionFromAcceleration - climbing movement
Interceptor.attach(ADH_ClimbableActor_GetMovementDirection_addr, {
    onEnter: function(args) {
        try {
            var actor = args[0];
            var character = args[1];
            logInfo('[GetMovementDirection] Wall: ' + getClassName(actor) + ' | Char: ' + getClassName(character));
        } catch(e) {}
    }
});

// HOOK 13: GetPathPointClosestToWorldLocation
Interceptor.attach(ADH_ClimbableActor_GetPathPoint_addr, {
    onEnter: function(args) {
        try {
            var actor = args[0];
            logInfo('[GetPathPoint] Wall: ' + getClassName(actor));
        } catch(e) {}
    }
});

// HOOK 14: InitSplineMesh - spline initialization
Interceptor.attach(ADH_ClimbableActor_InitSplineMesh_addr, {
    onEnter: function(args) {
        try {
            var actor = args[0];
            logInfo('[InitSplineMesh] Wall: ' + getClassName(actor));
        } catch(e) {}
    }
});

// HOOK 15: OnConstruction - actor construction
Interceptor.attach(ADH_ClimbableActor_OnConstruction_addr, {
    onEnter: function(args) {
        try {
            var actor = args[0];
            logInfo('[OnConstruction] Wall: ' + getClassName(actor));
        } catch(e) {}
    }
});

// HOOK 16: GetClimbableMesh
Interceptor.attach(ADH_ClimbableActor_GetClimbableMesh_addr, {
    onEnter: function(args) {
        try {
            var actor = args[0];
            logInfo('[GetClimbableMesh] Wall: ' + getClassName(actor));
        } catch(e) {}
    }
});

// ============================================================================
// Startup
// ============================================================================
send('[ClimbMod v8] Loaded - Full ADH_ClimbableActor Logging!');
send('  Strategy: Clear RequiredInventory (0x240) + force all checks');
send('  ADH_ClimbableActor hooks:');
send('    - BeginPlay (0xDBDD60) - logs RequiredInventory, MaxClimbers, ClimbType');
send('    - CanBeInteractedWith (0xDC2520) - CLEARS RequiredInventory');
send('    - OnInteract (0xDD6DF0)');
send('    - AddClimber (0xDBAA30)');
send('    - RemoveClimber (0xDDF420)');
send('    - GetClimberRotation (0xDC9DB0)');
send('    - GetMovementDirection (0xDCEDC0)');
send('    - GetPathPoint (0xDCF7F0)');
send('    - InitSplineMesh (0xDD34C0)');
send('    - OnConstruction (0xDD6A30)');
send('    - GetClimbableMesh (0xEA6B50)');
send('  Other hooks: CanInteractWith, CanClimb, Equip');
