console.log("Frida script injected successfully!");

// Example: Log the current process ID and name
console.log("Process ID: " + Process.id);
console.log("Process Name: " + Process.name);


var base = Module.findBaseAddress("DreadHungerServer-Win64-Shipping.exe");
function randomNum(max) {
  return Math.floor(Math.random() * max);
}
var roles = [1, 2, 3, 4, 5, 6, 7, 8];

var ADH_PlayerState_SetPlayerRole = base.add(0xE4F390);
var UDH_PlayerRoleData_FindByType = new NativeFunction(base.add(0xE33300), "size_t", ["char", "pointer"], 'win64');
var ADH_PlayerState_SetPlayerRole_Interceptor = Interceptor.attach(ADH_PlayerState_SetPlayerRole, {
	onEnter : function (args) {
		var ADH_PlayerState=args[0];
		var index = randomNum(roles.length);
		var role = roles[index];
		var New_UDH_PlayerRoleData = UDH_PlayerRoleData_FindByType(role,ADH_PlayerState)
		roles.splice(index, 1);
        args[1] = ptr(New_UDH_PlayerRoleData)
	}
});
