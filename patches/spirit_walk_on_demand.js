
// Find the base address of the game module
var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

// Simple helper for file logging

// Ensure these offsets are accurate for your specific game version.

const CastSpell_VA = base.add(0xE634F0);

function logInfo(info) {
    var f = new File('output.log', 'a');
    f.write('[DH] ' + info + '\n');  
    f.close();
}

var ADH_HumanCharacter_SelectBoneDagger_Simulated = new NativeFunction(
    base.add(0xD6D560),
    'void',            // Return type
    ['pointer'],       // Parameters: (this)
    'win64'
);

// ADH_HumanCharacter::EndSpiritWalk(this)
var ADH_HumanCharacter_EndSpiritWalk = new NativeFunction(
  base.add(0xD53C30),  
  'void',
  ['pointer'],
  'win64'
);

// ADH_BoneDagger::PutDown(this)
var ADH_BoneDagger_PutDown = new NativeFunction(
  base.add(0xE7E020),  
  'void',
  ['pointer'],
  'win64'
);

var Humanptr;
//trace Spirit Walk 
//needed to make it work from Prison Cell
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
		send("asd");
        ADH_HumanCharacter_SelectBoneDagger_Simulated(Humanptr);
        // Validate the SourceActor_ptr
        if (!SourceActor_ptr.isNull()) {
            // Log the casting event
            const SpellClass_ptr = args[3];
            const TargetActor_ptr = args[4];
            const Tier = args[5].toInt32();
            
			const castTargetKey = SpellClass_ptr.toString();
            
            const logMessage = `[CastSpell] SourceActor: ${SourceActor_ptr}, SpellClass: ${TargetActor}, TargetActor: ${SpellClass_ptr}, Tier: ${Tier}`;
            writeLog(logMessage);
        }
    },
    onLeave: function(retval) {
        // Optional: Implement logic if needed after CastSpell execution
    }
});

// Hook ADH_BoneDagger::PutDown
Interceptor.attach(ADH_BoneDagger_PutDown, {
  onEnter: function (args) {
    // args[0] = ADH_BoneDagger* (this)
    this.BoneDaggerPtr = args[0];

    logInfo('[ADH_BoneDagger::PutDown] Enter');

    // Retrieve HumanOwner pointer at offset 0x268
    var humanOwnerPtr = this.BoneDaggerPtr.add(0x268).readPointer();
	Humanptr = humanOwnerPtr;
    if (humanOwnerPtr.isNull()) {
      logInfo('No valid HumanOwner found at offset 0x268!');
      return;
    }

    // Check bSpiritWalking at offset 0xc71 in ADH_HumanCharacter
    var bSpiritWalking = humanOwnerPtr.add(0xc71).readU8();
    logInfo('bSpiritWalking = ' + bSpiritWalking);

    // If spirit walking, end it 
    if (bSpiritWalking === 1) {
      logInfo('Ending spirit walk now!');
	  //ADH_HumanCharacter_SelectBoneDagger_Simulated(humanOwnerPtr);
	  
      ADH_HumanCharacter_EndSpiritWalk(humanOwnerPtr);
      
    }
  },
  onLeave: function (retval) {
    logInfo('[ADH_BoneDagger::PutDown] Leave');
  }
});
