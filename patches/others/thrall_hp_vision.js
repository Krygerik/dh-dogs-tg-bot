// Find the base address of the game module
var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

// void UpdateListenerPosition(float DeltaTime); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.UpdateListenerPosition // (Public|BlueprintCallable|BlueprintEvent) // @ game+0x1355100
// void OnChangedTarget(struct AActor* NewTarget); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.OnChangedTarget // (Public|BlueprintCallable|BlueprintEvent) // @ game+0x1355100
// char GetUseState(enum class EInputEvent InputEvent); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.GetUseState // (Event|Public|HasOutParms|BlueprintCallable|BlueprintEvent) // @ game+0x1355100
// void OnAimed(bool bNewIsAiming); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.OnAimed // (Event|Public|BlueprintEvent) // @ game+0x1355100
// void ReceiveTick(float DeltaSeconds); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.ReceiveTick // (Event|Public|BlueprintEvent) // @ game+0x1355100
// void ExecuteUbergraph_BP_Spyglass_Inventory(int32_t EntryPoint); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.ExecuteUbergraph_BP_Spyglass_Inventory // (Final|UbergraphFunction) // @ game+0x1355100
// void ClearTarget(); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.ClearTarget // (Public|BlueprintCallable|BlueprintEvent) // @ game+0x1355100
// void UpdateTarget(); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.UpdateTarget // (Public|HasDefaults|BlueprintCallable|BlueprintEvent) // @ game+0x1355100
// void ReceiveDestroyed(); // Function BP_Spyglass_Inventory.BP_Spyglass_Inventory_C.ReceiveDestroyed // (Event|Public|BlueprintEvent) // @ game+0x1355100

send('run thrall hp vision script!');

var Z_Construct_UDelegateFunction_UDH_MessageBus_OnSpyingChangedSignature__DelegateSignature = new NativeFunction(base.add(0xEDEA90), 'void', [], 'win64');
Interceptor.attach(Z_Construct_UDelegateFunction_UDH_MessageBus_OnSpyingChangedSignature__DelegateSignature, {
  onEnter: function(args) {
    send('Z_Construct_UDelegateFunction_UDH_MessageBus_OnSpyingChangedSignature__DelegateSignature');
  },
});

var UDH_SpiedActorInfoWidget_OnSpyingChanged = new NativeFunction(base.add(0xF6E4E0), 'void', ['bool'], 'win64');
Interceptor.attach(UDH_SpiedActorInfoWidget_OnSpyingChanged, {
  onEnter: function(args) {
    send('UDH_SpiedActorInfoWidget_OnSpyingChanged');
  },
});

var UDH_SpiedActorInfoWidget_execOnSpyingChanged = new NativeFunction(base.add(0xFE8950), 'void', ['pointer', 'pointer', 'pointer'], 'win64');
Interceptor.attach(UDH_SpiedActorInfoWidget_execOnSpyingChanged, {
  onEnter: function(args) {
    send('UDH_SpiedActorInfoWidget_execOnSpyingChanged');
  },
});

var Z_Construct_UFunction_UDH_SpiedActorInfoWidget_OnSpyingChanged = new NativeFunction(base.add(0x1000B20), 'void', [], 'win64');
Interceptor.attach(Z_Construct_UFunction_UDH_SpiedActorInfoWidget_OnSpyingChanged, {
  onEnter: function(args) {
    send('Z_Construct_UFunction_UDH_SpiedActorInfoWidget_OnSpyingChanged');
  },
});

// ADH_HumanCharacter::EndSpiritWalk(this)
var ADH_HumanCharacter_EndSpiritWalk = new NativeFunction(
  base.add(0xD53C30),
  'void',
  ['pointer'],
  'win64'
);

Interceptor.attach(ADH_HumanCharacter_EndSpiritWalk, {
  onEnter: function(args) {
    send('ADH_HumanCharacter_EndSpiritWalk');
  },
});