const MODULE_NAME = "DreadHungerServer-Win64-Shipping.exe";
const base = Module.findBaseAddress(MODULE_NAME);

if (base === null) {
    throw new Error(`Failed to find base address of ${MODULE_NAME}`);
}

// Relative offset of AActor::execK2_GetActorLocation
const RELATIVE_OFFSET_EXECK2_GETACTORLOCATION = 0x2988E70;

// Calculate the Virtual Address (VA) of execK2_GetActorLocation
const execK2_GetActorLocation_VA = base.add(RELATIVE_OFFSET_EXECK2_GETACTORLOCATION);

// Log file path.
// IMPORTANT: Replace this path with a valid path where you have write permissions.
const LOG_FILE_PATH = "ActorLocation.log"; // e.g., "C:\\Users\\YourName\\Desktop\\ActorLocation.log"

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
/* Hook: AActor::execK2_GetActorLocation */
// ============================================================================

Interceptor.attach(execK2_GetActorLocation_VA, {
    onEnter: function(args) {
        /*
         * Function Signature:
         * AActor::execK2_GetActorLocation(UObject*, FFrame&, void* const)
         * 
         * Arguments:
         * - args[0]: UObject* (this pointer to AActor instance)
         * - args[1]: FFrame& (execution frame, typically unused here)
         * - args[2]: void* const (pointer to FVector where the location will be stored)
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

            // Prepare the log message.
            const logMessage = `[execK2_GetActorLocation] Actor Ptr: ${this.actorPtr}, Location: X=${X.toFixed(2)}, Y=${Y.toFixed(2)}, Z=${Z.toFixed(2)}`;

            // Write the log message to the file.
            writeLog(logMessage);
        } catch (error) {
            // Log any errors encountered during memory reading.
            writeLog(`[execK2_GetActorLocation] Exception: ${error.message}`);
        }
    }
});

// ============================================================================
/* Graceful Log Closure */
// ============================================================================

// Expose an RPC method to close the log file gracefully.
// This can be called externally to ensure all data is written and the file is closed.
rpc.exports = {
    closeLogFile: function() {
        writeLog("Closing ActorLocation.log");
        logFile.close();
    }
};