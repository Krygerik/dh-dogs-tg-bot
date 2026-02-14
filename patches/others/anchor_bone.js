// Find the base address of the game module
var base = Process.getModuleByName('DreadHungerServer-Win64-Shipping.exe').base;

// ADH_HumanCharacter::EndSpiritWalk(this)
var ADH_HumanCharacter_EndSpiritWalk = new NativeFunction(
  base.add(0xD53C30),
  'void',
  ['pointer'],
  'win64'
);

var ADH_PlayerController_SetDesiresThrallVision_Implementation = new NativeFunction(base.add(0xE4D980), 'void', ['bool'], 'win64');
Interceptor.attach(ADH_PlayerController_SetDesiresThrallVision_Implementation, {
  onEnter: function(args) {
      var ADH_PlayerController = args[0];
      var ADH_HumanCharacter = ADH_PlayerController.add(0x588).readPointer();

      // Check bSpiritWalking at offset 0xc71 in ADH_HumanCharacter
      var bSpiritWalking = ADH_HumanCharacter.add(0xc71).readU8();

      if (bSpiritWalking === 1) {
        send('Ending spirit walk now!');
        ADH_HumanCharacter_EndSpiritWalk(ADH_HumanCharacter);
      }
  },
});
