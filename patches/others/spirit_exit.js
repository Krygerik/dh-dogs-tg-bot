var base = Module.findBaseAddress("DreadHungerServer-Win64-Shipping.exe");

// Unreal Engine functions to locate objects by name
var UClass_GetPrivateStaticClass = new NativeFunction(base.add(0x11F02E0), 'pointer', [], 'win64');
var StaticFindObject = new NativeFunction(base.add(0x137AAA0), 'pointer', ['pointer', 'pointer', 'pointer', 'int8'], 'win64');

// File for logging
var logFile = new File("SpiritWalk1.log", "a");

// Helper function to write logs
function writeLog(message) {
    var timestamp = new Date().toISOString();
    logFile.write(`[${timestamp}] ${message}\n`);
    logFile.flush(); // Ensure it gets written immediately
}

// Helper to find classes by name
function findClassByName(ClassName) {
    var Buffer = Memory.allocUtf16String(ClassName);
    return StaticFindObject(UClass_GetPrivateStaticClass(), ptr("0xFFFFFFFFFFFFFFFF"), Buffer, 0);
}

// Locate Spirit Walk class
var SpiritWalkClass = findClassByName('/Game/Blueprints/Game/Totems/TS_SpiritWalk.TS_SpiritWalk_C');

if (SpiritWalkClass.isNull()) {
    writeLog("[ERROR] Failed to locate Spirit Walk class!");
} else {
    writeLog("[INFO] Located Spirit Walk class!");
}

// Intercept function to check if Spirit Walk is cast
Interceptor.attach(base.add(0xE634F0), { // Replace with the actual function address
    onEnter: function (args) {
        writeLog("[Function Hooked] Called with arguments:");
        
        for (var i = 0; i <= 10; i++) {
            try {
                // Log the pointer address
                writeLog(`Arg[${i}] Address: ${args[i].toString()}`);

                // Dereference the pointer and log its value
                var dereferencedValue = args[i].readPointer();
                writeLog(`Arg[${i}] Dereferenced Value: ${dereferencedValue.toString()}`);
            } catch (e) {
                // Handle cases where the pointer cannot be dereferenced
                writeLog(`Arg[${i}] Cannot be dereferenced: ${e.message}`);
            }
        }
    },
    onLeave: function (retval) {
        writeLog("[Function Hooked] Completed execution.");
    }
});

// Hook for spell expiration
Interceptor.attach(base.add(0xEFB400), { // Expire function
    onEnter: function (args) {
        writeLog(`[ExpireSpell] Function address: ${base.add(0xEFB400)}`);
        
        for (var i = 0; i <= 10; i++) {
            try {
                // Log the pointer address
                writeLog(`[ExpireSpell] Arg[${i}] Address: ${args[i].toString()}`);

                // Dereference the pointer and log its value
                var dereferencedValue = args[i].readPointer();
                writeLog(`[ExpireSpell] Arg[${i}] Dereferenced Value: ${dereferencedValue.toString()}`);
            } catch (err) {
                // Handle cases where the pointer cannot be dereferenced
                writeLog(`[ExpireSpell] Arg[${i}] Cannot be dereferenced: ${err.message}`);
            }
        }

        writeLog("[SpiritWalk] Spell expired or ended.");
    },
    onLeave: function (retval) {
        writeLog("[ExpireSpell] Function execution completed.");
        writeLog(`[ExpireSpell] Return value: ${retval}`);
    }
});

