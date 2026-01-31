var base = Module.findBaseAddress('DreadHungerServer-Win64-Shipping.exe');

var FTransform_Identity = base.add(0x4559220);
var FActorSpawnParameters_FActorSpawnParameters = new NativeFunction(base.add(0x29584A0), 'void', ['pointer'], 'win64');
var UWorld_SpawnActor = new NativeFunction(base.add(0x2624510), 'pointer', ['pointer', 'pointer', 'pointer', 'pointer'], 'win64');
var UObject_GetWorld = new NativeFunction(base.add(0x13075A0), 'pointer', ['pointer'], 'win64');

var UClass_GetPrivateStaticClass = new NativeFunction(base.add(0x11F02E0), 'pointer', [], 'win64');

var StaticLoadObject = new NativeFunction(base.add(0x137B290), 'pointer', ['pointer', 'pointer', 'pointer', 'pointer', 'int32', 'pointer', 'int8', 'pointer'], 'win64');
var StaticFindObject = new NativeFunction(base.add(0x137AAA0), 'pointer', ['pointer', 'pointer', 'pointer', 'int8'], 'win64');

function logInfo(Info) {
    var f = new File('output.log', 'a');
    f.write('[Patches] ' + Info + '\n');
    f.close();
}

function findClassByName(ClassName) {
    return findObjectByName(ClassName, UClass_GetPrivateStaticClass());
}

function findObjectByName(ObjectName, Clazz) {
    var Buffer = Memory.alloc((ObjectName.length + 1) * 2);
    Buffer.writeUtf16String(ObjectName);
    return StaticFindObject(Clazz, ptr(0xFFFFFFFFFFFFFFFF), Buffer, 0);
}

function loadClassByName(ClassName) {
    return loadObjectByName(ClassName, UClass_GetPrivateStaticClass());
}

function loadObjectByName(ObjectName, Clazz) {
    var Buffer = Memory.alloc((ObjectName.length + 1) * 2);
    Buffer.writeUtf16String(ObjectName);
    return StaticLoadObject(Clazz, ptr(0), Buffer, ptr(0), 0, ptr(0), 1, ptr(0));
}

function spawnActor(World, Clazz, Position, Owner) {
    var Parameters = Memory.alloc(0x30);
    FActorSpawnParameters_FActorSpawnParameters(Parameters);
    Parameters.add(0x10).writePointer(Owner);
    return UWorld_SpawnActor(World, Clazz, Position, Parameters);
}

function getClass(ClassName) {
    var Clazz = findClassByName(ClassName);
    if (!Clazz.isNull()) {
        return Clazz;
    }
    return loadClassByName(ClassName);
}

function eulerToQuaternion(pitch, roll, yaw) {
    // Convert degrees to radians
    var p = pitch * Math.PI / 180;
    var r = roll * Math.PI / 180;
    var y = yaw * Math.PI / 180;

    var c1 = Math.cos(y * 0.5);
    var s1 = Math.sin(y * 0.5);
    var c2 = Math.cos(r * 0.5);
    var s2 = Math.sin(r * 0.5);
    var c3 = Math.cos(p * 0.5);
    var s3 = Math.sin(p * 0.5);

    return {
        x: Number((s1 * s2 * c3 + c1 * c2 * s3).toFixed(2)),
        y: Number((s1 * c2 * c3 + c1 * s2 * s3).toFixed(2)),
        z: Number((c1 * s2 * c3 - s1 * c2 * s3).toFixed(2)),
        w: Number((c1 * c2 * c3 - s1 * s2 * s3).toFixed(2))
    };
}

function makeTransform(Pos, Rot, Scale) {
    var TransformBuffer = Memory.alloc(16 * 3);
    TransformBuffer.add(0).writeFloat(Pos[0]);
    TransformBuffer.add(4).writeFloat(Pos[1]);
    TransformBuffer.add(8).writeFloat(Pos[2]);

    // Check if rotation is [0, 0, 0]
    if (Rot[0] === 0 && Rot[1] === 0 && Rot[2] === 0) {
        // Write Identity Quaternion [0, 0, 0, 1]
        TransformBuffer.add(12).writeFloat(0.0); // X
        TransformBuffer.add(16).writeFloat(0.0); // Y
        TransformBuffer.add(20).writeFloat(0.0); // Z
        TransformBuffer.add(24).writeFloat(1.0); // W
    } else {
        // Convert Euler angles to Quaternion
        var quaternion = eulerToQuaternion(Rot[0], Rot[1], Rot[2]);

        // Log Quaternion for Debugging
        logInfo(`Quaternion: x=${quaternion.x}, y=${quaternion.y}, z=${quaternion.z}, w=${quaternion.w}`);

        // Write Rotation (Quaternion) in [X, Y, Z, W] order
        TransformBuffer.add(12).writeFloat(0.7071); // X
        TransformBuffer.add(16).writeFloat(0); // Y
        TransformBuffer.add(20).writeFloat(0); // Z
        TransformBuffer.add(24).writeFloat(0.7071); // W
		
		
    }
	
	TransformBuffer.add(32).writeFloat(Scale[0]);
    TransformBuffer.add(36).writeFloat(Scale[1]);
    TransformBuffer.add(40).writeFloat(Scale[2]);

    // **Added Closing Brace and Return Statement**
    return TransformBuffer;
}

var GWorld = base.add(0x46ED420);

function getGameState() {
    var AuthorityGameMode = GWorld.readPointer().add(0x118).readPointer();
    var GameState = AuthorityGameMode.add(0x280).readPointer();
    return GameState;
}

var ActorToSpawn = [
    //['/Game/Blueprints/Game/Crafting/BP_WorkBench.BP_WorkBench_C', [0, 0, 0], [-31882.83, -184.14, 19.18], [1, 1, 1]],
    ['/Game/Blueprints/Game/Crafting/BP_WorkBench_CenterLight.BP_WorkBench_CenterLight_C', [0, 0, 90], [-30901.6, -478.58, 50.18], [1, 1, 1]],
    //['/Game/Blueprints/Game/Crafting/BP_WorkBench.BP_WorkBench_C', [0, -0.3827, 0.9239], [-29966.18, -118.64, 50.18], [1, 1, 1]],
];

var ADH_HumanCharacter_AddStartingInventory_addr = base.add(0xD46F10);

Interceptor.attach(ADH_HumanCharacter_AddStartingInventory_addr, {
    onEnter: function(args) {
        // You can add code here if needed when the function is entered
    },
    onLeave: function(ret) {
        for (var i = 0; i < ActorToSpawn.length; i++) {
            var ActorClass = getClass(ActorToSpawn[i][0]);
            var Transform = makeTransform(
                ActorToSpawn[i][2],
                ActorToSpawn[i][1],
                ActorToSpawn[i][3]
            );
            spawnActor(
                GWorld.readPointer(),
                ActorClass,
                Transform,
                getGameState()
            );
        }
    }
});
