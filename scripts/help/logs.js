function monitorModuleFunctions(moduleName) {
    // Specify the path for the log file
    var logFile = "C:\\Users\\Administrator\\Desktop\\WindowsServer\\all_function_calls_log.txt";

    // Enumerate all exported functions from the module
    var exportedFunctions = Module.enumerateExports(moduleName);

    exportedFunctions.forEach(function(exp) {
        try {
            // Attach an interceptor to each function
            Interceptor.attach(exp.address, {
                onEnter: function(args) {
                    // Prepare the log entry for function call
                    var logEntry = "Function called: " + exp.name + " at " + exp.address + "\n";
                    logEntry += "Arguments:\n";
                    
                    // Safely log each argument, only if it exists
                    for (var i = 0; i < this.context.argc; i++) {
                        if (i < args.length) {
                            logEntry += "arg[" + i + "]: " + args[i].toString() + "\n";
                        } else {
                            logEntry += "arg[" + i + "]: [undefined or inaccessible]\n";
                        }
                    }

                    // Log the function call to the console
                    console.log(logEntry);

                    // Write the log entry to the file
                    var f = new File(logFile, "a");  // Open file in append mode
                    f.write(logEntry);
                    f.close();
                },
                onLeave: function(retval) {
                    // Prepare the log entry for the return value
                    var logEntry = "Function " + exp.name + " returned: " + retval.toString() + "\n";
                    logEntry += "----------------------------------------\n";

                    // Log the return value to the console
                    console.log(logEntry);

                    // Write the return value to the log file
                    var f = new File(logFile, "a");  // Open file in append mode
                    f.write(logEntry);
                    f.close();
                }
            });
        } catch (e) {
            console.error("Error intercepting function at " + exp.address + ": " + e.message);

            // Optionally, log this error to the file as well
            var f = new File(logFile, "a");
            f.write("Error intercepting function at " + exp.address + ": " + e.message + "\n");
            f.close();
        }
    });
}

function monitorProcessModules() {
    // Monitor when the target module gets loaded
    var moduleName = "DreadHungerServer-Win64-Shipping.exe";

    Process.enumerateModules({
        onMatch: function(module) {
            if (module.name === moduleName) {
                console.log("Module loaded: " + module.name + " at " + module.base);
                monitorModuleFunctions(module.name);
            }
        },
        onComplete: function() {
            // You can add other modules to monitor here
        }
    });
}

// Start monitoring
monitorProcessModules();
