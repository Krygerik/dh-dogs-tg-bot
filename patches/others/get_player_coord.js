'use strict';

/*
 * Frida Script: Unreal Engine 4.26 - Enhanced Actor Tracking with 5-Second Cooldown
 * 
 * Description:
 * - Hooks into the AActor::execK2_GetActorLocation function to log actor locations.
 * - Hooks into ADH_SpellManager::CastSpell to log spell casting events.
 * - Maintains a set of unique CastTarget actors and logs their locations once every 5 seconds.
 * 
 */

// ============================================================================
/* Constants and Configuration */
// ============================================================================

// Define the target module name.
// Replace with your actual module name if different.
const MODULE_NAME = "DreadHungerServer-Win64-Shipping.exe";

// Find the base address of the module.
const base = Process.getModuleByName(MODULE_NAME).base;

if (base === null) {
    throw new Error(`Failed to find base address of ${MODULE_NAME}`);
}

// Relative offsets of the target functions.
// Ensure these offsets are accurate for your specific game version.
const RELATIVE_OFFSET_EXECK2_GETACTORLOCATION = 0x2988E70;
const RELATIVE_OFFSET_CASTSPELL = 0xE634F0;

// Calculate the Virtual Addresses (VAs) of the target functions.
const execK2_GetActorLocation_VA = base.add(RELATIVE_OFFSET_EXECK2_GETACTORLOCATION);
const CastSpell_VA = base.add(RELATIVE_OFFSET_CASTSPELL);

// Log file path.
// IMPORTANT: Replace this path with a valid path where you have write permissions.
const LOG_FILE_PATH = "TheActorsLocationFinal.log"; // e.g., "C:\\Users\\YourName\\Desktop\\ActorLocation.log"

// ============================================================================
/* Logging Setup */
// ============================================================================

// Initialize the log file in append mode.
// Ensure that the directory exists and the script has write permissions.
const logFile = new File(LOG_FILE_PATH, "a");

// Helper function to write messages with a timestamp to the log file.
function writeLog(message) {
    const timestamp = new Date().toISOString();
    logFile.write(`[${timestamp}] ${message}\n`);
    logFile.flush(); // Ensure the message is written immediately.
}

// ============================================================================
/* Data Structures */
// ============================================================================

// Set to store unique CastTarget actor pointers.
// Using a Set ensures that each actor is only stored once.
const uniqueCastTargets = new Set();

// Map to store the last log time for each actor.
// Key: AActor* as string, Value: timestamp in milliseconds
const actorLastLogTime = new Map();

// ============================================================================
/* Hook: ADH_SpellManager::CastSpell */
// ============================================================================

/*
 * Function Signature:
 * ADH_SpellManager::CastSpell(AActor* Source, ADH_SpellManager* Manager, TSubclassOf<UDH_TotemSpell> SpellClass, AActor* Target, ETotemSpellTiers Tier)
 */
Interceptor.attach(CastSpell_VA, {
    onEnter: function(args) {
        /*
         * Arguments:
         * - args[0]: ADH_SpellManager* (SpellManager instance)
         * - args[1]: AActor* Source
         * - args[2]: ADH_SpellManager* Manager
         * - args[3]: TSubclassOf<UDH_TotemSpell> SpellClass
         * - args[4]: AActor* Target
         * - args[5]: ETotemSpellTiers Tier
         */
	
	
	// Extract the SourceActor_ptr (the caster)
        const SourceActor_ptr = args[1];
        
        // Validate the SourceActor_ptr
        if (!SourceActor_ptr.isNull()) {
            // Log the casting event
            const SpellClass_ptr = args[3];
            const TargetActor_ptr = args[4];
            const Tier = args[5].toInt32();
            
			const castTargetKey = SpellClass_ptr.toString();
            if (!uniqueCastTargets.has(castTargetKey)) {
                uniqueCastTargets.add(castTargetKey);
                writeLog(`[CastSpell] Added new CastTarget Actor Ptr: ${castTargetKey}`);
            }
            const logMessage = `[CastSpell] SourceActor: ${SourceActor_ptr}, SpellClass: ${TargetActor}, TargetActor: ${SpellClass_ptr}, Tier: ${Tier}`;
            writeLog(logMessage);
        }
    },
    onLeave: function(retval) {
        // Optional: Implement logic if needed after CastSpell execution
    }
});
        

// ============================================================================
/* Hook: AActor::execK2_GetActorLocation */
// ============================================================================

/*
 * Function Signature:
 * AActor::execK2_GetActorLocation(UObject* Context, FFrame& Stack, void* const Result)
 */
Interceptor.attach(execK2_GetActorLocation_VA, {
    onEnter: function(args) {
        /*
         * Arguments:
         * - args[0]: UObject* Context (AActor instance)
         * - args[1]: FFrame& Stack (unused)
         * - args[2]: void* const Result (pointer to FVector)
         */

        // Store the actor pointer and FVector pointer in the context for use in onLeave.
        this.actorPtr = args[0];
        this.fVectorPtr = args[2];
    },
    onLeave: function(retval) {
        /*
         * Upon leaving the function, read the FVector data from the provided memory location.
         * FVector Structure:
         * - float X
         * - float Y
         * - float Z
         */

        // Validate pointers to prevent reading invalid memory.
        if (this.actorPtr.isNull() || this.fVectorPtr.isNull()) {
            writeLog(`[execK2_GetActorLocation] Error: Null pointer encountered. Actor Ptr: ${this.actorPtr}, FVector Ptr: ${this.fVectorPtr}`);
            return;
        }

        try {
            // Read the X, Y, Z coordinates from the FVector memory location.
            const X = this.fVectorPtr.readFloat();
            const Y = this.fVectorPtr.add(4).readFloat(); // Offset 0x4 bytes for Y
            const Z = this.fVectorPtr.add(8).readFloat(); // Offset 0x8 bytes for Z

            const actorKey = this.actorPtr.toString();

            // Check if the actor is in the uniqueCastTargets set
            if (uniqueCastTargets.has(actorKey)) {
                // Get the current timestamp in milliseconds.
                const currentTime = Date.now();

                // Get the last log time for this actor.
                const lastLogTime = actorLastLogTime.get(actorKey) || 0;

                // Define the cooldown period (5 seconds = 5000 milliseconds).
                const COOLDOWN_MS = 5000;

                if (currentTime - lastLogTime >= COOLDOWN_MS) {
                    // Prepare the log message.
                    const logMessage = `[ActorLocation] Actor Ptr: ${this.actorPtr}, Location: X=${X.toFixed(2)}, Y=${Y.toFixed(2)}, Z=${Z.toFixed(2)}`;

                    // Write the log message to the file.
                    writeLog(logMessage);

                    // Update the last log time for this actor.
                    actorLastLogTime.set(actorKey, currentTime);
                }
            }

        } catch (error) {
            // Log any errors encountered during memory reading.
            writeLog(`[execK2_GetActorLocation] Exception: ${error.message}`);
        }
    }
});

// ============================================================================
/* Graceful Log Closure */
// ============================================================================

rpc.exports = {
    // Function to close the log file gracefully
    closeLogFile: function() {
        writeLog("Closing TheActorLocationTest.log");
        logFile.close();
    }
};
