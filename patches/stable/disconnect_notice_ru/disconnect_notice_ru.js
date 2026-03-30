/**
 * Уведомления об отключениях и смерти (RU). Win64 DreadHungerServer-Win64-Shipping.
 * Хуки: SetIsDisconnected, AGameSession::KickPlayer, UDH_OnlineSession::OnPlayerLogout.
 */
var base = Process.getModuleByName('DreadHungerServer-Win64-Shipping.exe').base;

var FName_FName = new NativeFunction(base.add(0x1158F20), 'void', ['pointer', 'pointer', 'int8']);
var FText_FromName = new NativeFunction(base.add(0x1096370), 'pointer', ['pointer', 'pointer']);
var ADH_PlayerController_ReceiveThrallMessage = new NativeFunction(base.add(0xEE7810), 'void', ['pointer', 'pointer', 'pointer']);
var UGameplayStatics_GetPlayerController = new NativeFunction(base.add(0x25630D0), 'pointer', ['pointer', 'int32']);
var ADH_PlayerState_SetIsDead_addr = base.add(0xE4E700);
var ADH_PlayerState_SetIsDisconnected = base.add(0xE4E770);
var GWorld = base.add(0x46ED420);
var APlayerState_GetPlayerName = new NativeFunction(base.add(0x27CAED0), 'void', ['pointer', 'pointer']);

/** AGameSession::KickPlayer(APlayerController*, FText const&) */
var AGameSession_KickPlayer = base.add(0x256B770);
/** UDH_OnlineSession::OnPlayerLogout(AController*) — точка входа (thunk/exec) */
var UDH_OnlineSession_OnPlayerLogout = base.add(0xE0DE30);

/** true — сообщения о смерти; false — выключено */
var DeadNotice = false;
/** true — сообщения об отключении; false — выключено */
var DisconnectedNotice = true;

/** AController::PlayerState */
var OFFSET_Controller_PlayerState = 0x228;

var pendingDisconnectReason = {};

function markPending(playerState, reason) {
    if (!playerState || playerState.isNull()) {
        return;
    }
    var key = playerState.toString();
    var pri = { kick: 2, logout: 1 };
    var cur = pendingDisconnectReason[key];
    if (!cur || pri[reason] > pri[cur]) {
        pendingDisconnectReason[key] = reason;
    }
}

function takePending(playerState) {
    var key = playerState.toString();
    var r = pendingDisconnectReason[key];
    delete pendingDisconnectReason[key];
    return r;
}

function disconnectActionText(reason) {
    if (reason === 'kick') {
        return 'отключён сервером (кик)';
    }
    if (reason === 'logout') {
        return 'вышел из игры (logout)';
    }
    return 'потеря связи или аварийное отключение';
}

function GetGameState() {
    var AuthorityGameMode = GWorld.readPointer().add(0x118).readPointer();
    return AuthorityGameMode.add(0x280).readPointer();
}

function newFName(Name) {
    var FName_Buffer = Memory.alloc(8);
    var Buffer = Memory.alloc((Name.length + 4) * 2);
    Buffer.writeUtf16String('   ' + Name);
    FName_FName(FName_Buffer, Buffer, 1);
    return FName_Buffer;
}

function FNameToFText(FName) {
    var FText_Buffer = Memory.alloc(18);
    FText_FromName(FText_Buffer, FName);
    return FText_Buffer;
}

function SendThrallMessage(PlayerController, Message, Usound) {
    var FName_Message = newFName(Message);
    var FText_Message = FNameToFText(FName_Message);
    ADH_PlayerController_ReceiveThrallMessage(PlayerController, FText_Message, Usound);
}

function getArraySize(TArray) {
    return TArray.add(8).readU32();
}

function getArrayItemAddr(TArray, size, index) {
    var ArrNum = getArraySize(TArray);
    if (index > ArrNum) {
        return null;
    }
    return TArray.readPointer().add(index * size);
}

function roleToRu(englishRole) {
    var m = {
        Captain: 'Капитан',
        Chaplain: 'Капеллан',
        Cook: 'Повар',
        Doctor: 'Доктор',
        Engineer: 'Инженер',
        Hunter: 'Охотник',
        Marine: 'Морпех',
        Navigator: 'Штурман',
        OldSailor: 'Старый моряк',
        Explorer: 'Исследователь',
        Canibal: 'Каннибал',
        Cannibal: 'Каннибал',
        Witch: 'Ведьма',
    };
    return m[englishRole] || englishRole;
}

function getPlayerRoleName(PlayerState) {
    var NameString = 'unknown';
    var SelectedRole = PlayerState.add(0x590).readPointer();
    if (!SelectedRole.isNull()) {
        var p = SelectedRole.add(0x48).readPointer();
        if (!p.isNull()) {
            NameString = p.readUtf16String().toLowerCase();
        }
    }

    var roleMaps = {
        captain: 'Captain',
        chaplain: 'Chaplain',
        cook: 'Cook',
        doctor: 'Doctor',
        engineer: 'Engineer',
        hunter: 'Hunter',
        marine: 'Marine',
        navigator: 'Navigator',
        oldsailor: 'OldSailor',
        explorer: 'Explorer',
        cannibal: 'Cannibal',
        witch: 'Witch',
    };

    if (roleMaps[NameString]) {
        NameString = roleMaps[NameString];
    }

    return roleToRu(NameString);
}

function getPlayerUserName(PlayerState) {
    var NameString = Memory.alloc(16);
    NameString.writePointer(ptr(0));
    NameString.add(8).writeU32(0);
    NameString.add(12).writeU32(0);

    APlayerState_GetPlayerName(PlayerState, NameString);
    var PlayerName = 'Неизвестно';
    if (!NameString.readPointer().isNull() || NameString.add(8).readU32() === 0) {
        var p = NameString.readPointer();
        if (!p.isNull()) {
            PlayerName = p.readUtf16String();
        }
    }
    return PlayerName;
}

function NotifyPlayers(GameState) {
    var PlayerArray = GameState.add(0x238);
    var matchingPlayers = [];
    for (var i = 0; i < getArraySize(PlayerArray); i++) {
        var PlayerState = getArrayItemAddr(PlayerArray, 8, i).readPointer();
        var bIsDisconnected = PlayerState.add(0x571).readU8();
        var PlayerId = PlayerState.add(0x224).readU8();
        var PlayerController = UGameplayStatics_GetPlayerController(PlayerState, PlayerId);
        if (!bIsDisconnected) {
            matchingPlayers.push(PlayerController);
        }
    }
    return matchingPlayers;
}

function SendDeathMessage(PlayerState) {
    var rolename = getPlayerRoleName(PlayerState);
    var playername = getPlayerUserName(PlayerState);
    var DeathMessages = {
        0: playername + ' (' + rolename + ') в трюме',
        1: playername + ' (' + rolename + ') умер',
    };
    var DeathCount = PlayerState.add(0x630).readU32();
    var GameState = GetGameState();
    var DeathNews = DeathMessages[DeathCount];
    if (DeathNews === undefined) {
        return;
    }
    var PlayerController = NotifyPlayers(GameState);
    for (var i = 0; i < PlayerController.length; i++) {
        SendThrallMessage(PlayerController[i], DeathNews, ptr(0));
    }
}

function SendDisconnectedMessage(PlayerState, reason) {
    var rolename = getPlayerRoleName(PlayerState);
    var playername = getPlayerUserName(PlayerState);
    var action = disconnectActionText(reason);
    var News = playername + ' (' + rolename + ') ' + action;
    var GameState = GetGameState();
    var PlayerController = NotifyPlayers(GameState);
    for (var i = 0; i < PlayerController.length; i++) {
        SendThrallMessage(PlayerController[i], News, ptr(0));
    }
}

if (DisconnectedNotice) {
    Interceptor.attach(AGameSession_KickPlayer, {
        onEnter: function (args) {
            var pc = args[1];
            if (pc.isNull()) {
                return;
            }
            var ps = pc.add(OFFSET_Controller_PlayerState).readPointer();
            markPending(ps, 'kick');
        },
    });

    Interceptor.attach(UDH_OnlineSession_OnPlayerLogout, {
        onEnter: function (args) {
            var controller = args[1];
            if (controller.isNull()) {
                return;
            }
            var ps = controller.add(OFFSET_Controller_PlayerState).readPointer();
            markPending(ps, 'logout');
        },
    });

    Interceptor.attach(ADH_PlayerState_SetIsDisconnected, {
        onEnter: function (args) {
            var PlayerState = args[0];
            var disconnected = args[1].toInt32() & 1;
            if (!disconnected) {
                return;
            }
            var reason = takePending(PlayerState);
            SendDisconnectedMessage(PlayerState, reason);
        },
    });
}

if (DeadNotice) {
    Interceptor.attach(ADH_PlayerState_SetIsDead_addr, {
        onEnter: function (args) {
            var PlayerState = args[0];
            var DeadFlag = args[1].toInt32() & 1;
            if (DeadFlag) {
                SendDeathMessage(PlayerState);
            }
        },
    });
}
