
var CAP_STAMINA = 4.5;
var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');
var fn = base.add(0x2752480); // ADH_HumanCharacter::SetPlayerState

function getString(fstrPtr){
    var len = fstrPtr.add(8).readU32();
    var data = fstrPtr.readPointer();
    return data.readUtf16String(len);
}

Interceptor.attach(fn, {
    onEnter: function(args){
        var self = args[0];
        var ps = args[1];
        if (ps.isNull()) return;
        var selectedRole = ps.add(0x590).readPointer();
        if (selectedRole.isNull()) return;
        var namePtr = selectedRole.add(0x48);
        var name = getString(namePtr);
        if (name === "Captain") {
            self.add(0xA48).writeFloat(CAP_STAMINA); // set stamina
        }
    }
});
