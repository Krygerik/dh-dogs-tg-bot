/**
 * Weapon Hit Logger Mod
 * 
 * Logs weapon damage using TakeDamage hook
 * 
 * IMPORTANT: TYPE_48 = CCT_POISON (Яд/Poison)
 */

var base = Process.getModuleByName('DreadHungerServer-Win64-Shipping.exe').base;

if (base === null) {
    send('[WeaponHitLogger] ERROR: Could not find module base address');
}

// ============================================================================
// Function addresses
// ============================================================================
var ADH_HumanCharacter_TakeDamage_addr = base.add(0xD73DB0);
var FName_GetPlainNameString = new NativeFunction(base.add(0x11604F0), 'void', ['pointer', 'pointer'], 'win64');

/*
 * ============================================================================
 * TESTED BUT NOT WORKING HOOKS (для справки):
 * ============================================================================
 * 
 * Следующие хуки были протестированы, но НЕ подходят для логирования урона:
 * 
 * 1. ADH_Weapon_Melee_ApplyMeleeDamage (0xF0A730)
 *    - Тест: не вызывается при ударах
 *    - Причина: возможно другая сигнатура или не используется в runtime
 * 
 * 2. ADH_Weapon_Melee_BeginSwing (0xDF8930)  
 *    - Тест: не вызывается при замахе
 *    - Причина: возможно обрабатывается на клиенте
 * 
 * 3. ADH_Weapon_Melee_ProcessHits (0xE14230)
 *    - Тест: не вызывается при попаданиях
 *    - Причина: возможно используется другой путь обработки
 * 
 * Рабочий хук: ADH_HumanCharacter_TakeDamage (0xD73DB0)
 * ============================================================================
 */

// ============================================================================
// EInventoryType values - ПОЛНЫЙ СПИСОК
// ============================================================================
var InventoryTypeNames = {
    0: 'UNDEFINED', 1: 'STICK', 2: 'STONE', 3: 'GUNPOWDER', 4: 'LEADINGOT',
    5: 'IRONINGOT', 6: 'WHETSTONE', 7: 'COAL', 8: 'WOLFPELT', 9: 'BLUBBER',
    10: 'SINEW', 11: 'BONE', 12: 'TRUTHPLANT', 13: 'HUMANBODYPART',
    14: 'ANIMALPART', 15: 'FLINT', 16: 'FIRE', 17: 'CODE', 18: 'NAILS',
    19: 'QUEST', 20: 'RAWMEAT', 21: 'COOKEDMEAT', 22: 'STEW', 23: 'TEA',
    24: 'BONEDAGGER', 25: 'BEARTRAP', 26: 'PISTOL', 27: 'MUSKET',
    28: 'SWORD', 29: 'OLDSWORD', 30: 'CLEAVER', 31: 'ICEAXE', 32: 'WOODAXE',
    33: 'HARPOON', 34: 'SHOVEL', 35: 'FISTS', 36: 'BOW', 37: 'COALBARREL',
    38: 'POWDERKEG', 39: 'NITRO', 40: 'LAUDANUM', 41: 'SYRINGE',
    42: 'LANTERN', 43: 'FLINTLOCKAMMO', 44: 'GUNPARTS', 45: 'SKELETONKEY',
    46: 'UNIFORM', 47: 'SPYGLASS', 48: 'POISON', 49: 'ANTIDOTE',
    50: 'HERBS', 51: 'CAPTAINKEY', 52: 'ARROWS', 53: 'PHONOGRAPH'
};

// ============================================================================
// Offsets
// ============================================================================
var OFFSET_InventoryType = 0x290;
var OFFSET_UClass = 0x10;

// ============================================================================
// Helpers
// ============================================================================
function logInfo(tag, info) {
    send('[' + tag + '] ' + info);
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
    return InventoryTypeNames[typeValue] || ('TYPE_' + typeValue);
}

// ============================================================================
// WORKING HOOK: TakeDamage - когда персонаж получает урон
// ============================================================================
Interceptor.attach(ADH_HumanCharacter_TakeDamage_addr, {
    onEnter: function(args) {
        var character = args[0];      // ADH_HumanCharacter* this (кто получает урон)
        var damageCauser = args[4];   // AActor* DamageCauser (кто нанёс урон)
        
        if (!isValidPointer(character)) return;
        
        try {
            var victimClass = getClassName(character);
            var causerClass = isValidPointer(damageCauser) ? getClassName(damageCauser) : 'Unknown';
            
            // Получаем тип предмета
            var causerType = -1;
            var causerTypeName = 'N/A';
            if (isValidPointer(damageCauser)) {
                try {
                    causerType = damageCauser.add(OFFSET_InventoryType).readU8();
                    causerTypeName = getTypeName(causerType);
                } catch(e) {}
            }
            
            logInfo('TakeDamage', 
                'Victim: ' + victimClass + ' | ' +
                'Causer: ' + causerClass + ' | ' +
                'CauserType: ' + causerTypeName + ' (' + causerType + ')');
        } catch(e) {
            logInfo('TakeDamage', 'Error: ' + e.message);
        }
    }
});

// ============================================================================
// Startup
// ============================================================================
send('[WeaponHitLogger] Loaded - using TakeDamage hook');
send('[WeaponHitLogger] TYPE_48 = CCT_POISON (Яд/Poison)');
