// Find the base address of the game module
var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

// var ABP_Rigging_C__GetClimbableMesh = new NativeFunction(base.add(0x1355100), 'pointer', ['bool'], 'win64');
// Interceptor.attach(ABP_Rigging_C__GetClimbableMesh, {
//   onEnter: function(args) {
//     send("ABP_Rigging_C__GetClimbableMesh");
//   },
// });

var UDH_RadialMenuSpellsWidget__OnOptionSetVisible = new NativeFunction(base.add(0xF33E40), 'char', ['int'], 'win64');
Interceptor.attach(UDH_RadialMenuSpellsWidget__OnOptionSetVisible, {
  onEnter: function(args) {
    send("UDH_RadialMenuSpellsWidget__OnOptionSetVisible");
  },
});

// UDH_RadialMenuBaseWidget::Show_Internal(bool)	.text	0000000002A65920	00000030	00000010		R	.	.	.	.	S	.	T	.
var UDH_RadialMenuBaseWidget__Show_Internal = new NativeFunction(base.add(0xA65920), 'char', ['bool'], 'win64');
Interceptor.attach(UDH_RadialMenuBaseWidget__Show_Internal, {
  onEnter: function(args) {
    send("UDH_RadialMenuBaseWidget__Show_Internal");
  },
});

// Z_Construct_UFunction_UDH_SpellWidget_GetTooltipWidget(void)	.text	0000000141000580	0000002F	00000028		R	.	.	.	.	.	.	T	.
var Z_Construct_UFunction_UDH_SpellWidget_GetTooltipWidget = new NativeFunction(base.add(0x000580), 'char', [], 'win64');
Interceptor.attach(Z_Construct_UFunction_UDH_SpellWidget_GetTooltipWidget, {
  onEnter: function(args) {
    send("Z_Construct_UFunction_UDH_SpellWidget_GetTooltipWidget");
  },
});

// Z_Construct_UFunction_UDH_SpellWidget_Toggle(void)	.text	00000001410006B0	0000002F	00000028		R	.	.	.	.	.	.	T	.
var Z_Construct_UFunction_UDH_SpellWidget_Toggle = new NativeFunction(base.add(0x0006B0), 'char', [], 'win64');
Interceptor.attach(Z_Construct_UFunction_UDH_SpellWidget_Toggle, {
  onEnter: function(args) {
    send("Z_Construct_UFunction_UDH_SpellWidget_Toggle");
  },
});
