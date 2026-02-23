
// Class DreadHungerUI.DH_PlayerReportCardAvatarWidget
// Size: 0x288 (Inherited: 0x260)
struct UDH_PlayerReportCardAvatarWidget : UUserWidget {
	struct UDH_ScoreboardPlayerListItemViewWidget* View; // 0x260(0x08)
	struct UButton* BaseButton; // 0x268(0x08)
	struct UDH_PlayerContextMenuWidget* ContextMenu; // 0x270(0x08)
	struct UDH_ScoreboardPlayerListItemTooltipWidget* AvatarTooltipClass; // 0x278(0x08)
	struct UDH_ScoreboardPlayerListItemTooltipWidget* AvatarTooltip; // 0x280(0x08)

	void OnBaseButtonClicked(); // Function DreadHungerUI.DH_PlayerReportCardAvatarWidget.OnBaseButtonClicked // (Final|Native|Private) // @ game+0xff0410
};


// Class DreadHungerUI.DH_PlayerStatsWidget
// Size: 0x608 (Inherited: 0x308)
struct UDH_PlayerStatsWidget : UDH_JournalPageWidget {
	struct TMap<enum class EPlayerTeamRole, struct UDH_PlayerRoleData*> DesignTimeRoles; // 0x308(0x50)
	struct TArray<struct UDH_MapData*> DesignTimeMaps; // 0x358(0x10)
	struct UDH_ScoreboardDataAsset* DesignTimeScoreboardData; // 0x368(0x08)
	struct UImage* AvatarImage; // 0x370(0x08)
	struct UDH_TextBlockWidget* NameLabel; // 0x378(0x08)
	struct UImage* PlayerRankBadge; // 0x380(0x08)
	struct UDH_RoleExperienceBarWidget* ExperienceBar; // 0x388(0x08)
	struct UImage* BackgroundImage; // 0x390(0x08)
	struct TMap<enum class EPlayerTeam, struct UTexture2D*> BackgroundImages; // 0x398(0x50)
	struct UDH_TextBlockWidget* GamesAsTeamPercentageLabel; // 0x3e8(0x08)
	struct UDH_TextBlockWidget* MostPlayedRoleAsThisTeamLabel; // 0x3f0(0x08)
	struct UDH_TextBlockWidget* MostSuccessfulRoleAsThisTeamLabel; // 0x3f8(0x08)
	struct UDH_TextBlockWidget* MostPlayedMapAsThisTeamLabel; // 0x400(0x08)
	struct UDH_TextBlockWidget* MostSuccessfulMapAsThisTeamLabel; // 0x408(0x08)
	struct UDH_TextBlockWidget* GamesAsThisTeamLabel; // 0x410(0x08)
	struct UDH_TextBlockWidget* WinsAsTeamPercentageLabel; // 0x418(0x08)
	struct UDH_TextBlockWidget* WinsAsThisTeamLabel; // 0x420(0x08)
	struct UDH_TextBlockWidget* AverageGradeLabel; // 0x428(0x08)
	struct UDH_PlayerGradeWidget* GradeWidgetClass; // 0x430(0x08)
	struct UDH_PlayerStatBarWidget* StatBarWidgetClass; // 0x438(0x08)
	struct UHorizontalBox* GradesList; // 0x440(0x08)
	struct UHorizontalBox* GamesByMapList; // 0x448(0x08)
	struct UHorizontalBox* GamesByTeamList; // 0x450(0x08)
	struct UHorizontalBox* GamesByRoleList; // 0x458(0x08)
	struct UImage* EarlyAccessBadge; // 0x460(0x08)
	struct UImage* PlaytesterBadge; // 0x468(0x08)
	char pad_470[0x198]; // 0x470(0x198)

	void UpdateStats(enum class EPlayerTeam InTeam); // Function DreadHungerUI.DH_PlayerStatsWidget.UpdateStats // (Final|Native|Private|BlueprintCallable) // @ game+0xff0cb0
};


// Class DreadHungerUI.DH_ScoreboardGameReportWidget
// Size: 0x288 (Inherited: 0x260)
struct UDH_ScoreboardGameReportWidget : UUserWidget {
	struct USoundBase* AllPlayersSelectedSound; // 0x260(0x08)
	struct USoundBase* AllPlayersDeselectedSound; // 0x268(0x08)
	struct URichTextBlock* OutcomeLabel; // 0x270(0x08)
	struct UButton* SelectAllPlayersButton; // 0x278(0x08)
	struct UDH_ScoreboardPlayerListWidget* PlayerList; // 0x280(0x08)

	void OnShowScoreboard(bool bShowScoreboard, bool bReplayJustLoaded); // Function DreadHungerUI.DH_ScoreboardGameReportWidget.OnShowScoreboard // (Final|Native|Private) // @ game+0xffe4d0
	void OnSelectAllPlayersButtonClicked(); // Function DreadHungerUI.DH_ScoreboardGameReportWidget.OnSelectAllPlayersButtonClicked // (Final|Native|Private) // @ game+0xffe1a0
	void BP_OnSetExpeditionDates(struct FDateTime& StartDate, struct FDateTime& EndDate); // Function DreadHungerUI.DH_ScoreboardGameReportWidget.BP_OnSetExpeditionDates // (Event|Protected|HasOutParms|HasDefaults|BlueprintEvent) // @ game+0x1355100
};


// Class DreadHungerUI.DH_ScoreboardPlayerListItemTooltipWidget
// Size: 0x268 (Inherited: 0x260)
struct UDH_ScoreboardPlayerListItemTooltipWidget : UUserWidget {
	struct UDH_TextBlockWidget* TitleTextBlock; // 0x260(0x08)
};

// Class DreadHungerUI.DH_ScoreboardPlayerListItemViewWidget
// Size: 0x2f0 (Inherited: 0x260)
struct UDH_ScoreboardPlayerListItemViewWidget : UUserWidget {
	float WidgetScale; // 0x260(0x04)
	float DefaultImageSize; // 0x264(0x04)
	float DefaultPadding; // 0x268(0x04)
	char pad_26C[0x4]; // 0x26c(0x04)
	struct TArray<struct UObject*> DeathMarkerTextures; // 0x270(0x10)
	struct UObject* UnknownPlayerImage; // 0x280(0x08)
	struct TArray<struct UTexture2D*> BorderMasks; // 0x288(0x10)
	struct UMaterialInterface* BorderMIDParent; // 0x298(0x08)
	int32_t DesignTimePrestigeLevel; // 0x2a0(0x04)
	struct FLinearColor DesignTimePlayerImageTint; // 0x2a4(0x10)
	bool bDesignTimeThrall; // 0x2b4(0x01)
	bool bDesignTimeSelected; // 0x2b5(0x01)
	bool bDesignTimeDead; // 0x2b6(0x01)
	char pad_2B7[0x1]; // 0x2b7(0x01)
	struct UObject* DesignTimePlayerImageTexture; // 0x2b8(0x08)
	struct UImage* DeathMarker; // 0x2c0(0x08)
	struct UImage* PlayerImage; // 0x2c8(0x08)
	struct UImage* SelectedImage; // 0x2d0(0x08)
	struct UImage* PlayerBorder; // 0x2d8(0x08)
	struct UMaterialInstanceDynamic* BorderMID; // 0x2e0(0x08)
	char pad_2E8[0x8]; // 0x2e8(0x08)

	void SetSelected(bool bSelected); // Function DreadHungerUI.DH_ScoreboardPlayerListItemViewWidget.SetSelected // (Final|Native|Public|BlueprintCallable) // @ game+0xffed20
	void SetPlayerImageTint(struct FLinearColor& InTint); // Function DreadHungerUI.DH_ScoreboardPlayerListItemViewWidget.SetPlayerImageTint // (Final|Native|Public|HasOutParms|HasDefaults|BlueprintCallable) // @ game+0xffec90
	void SetDead(bool bDead); // Function DreadHungerUI.DH_ScoreboardPlayerListItemViewWidget.SetDead // (Final|Native|Public|BlueprintCallable) // @ game+0xffea50
};


// Class DreadHungerUI.DH_ScoreboardPlayerListItemWidget
// Size: 0x2b0 (Inherited: 0x260)
struct UDH_ScoreboardPlayerListItemWidget : UUserWidget {
	struct UDH_ScoreboardPlayerListItemTooltipWidget* ListItemTooltipClass; // 0x260(0x08)
	struct USoundBase* ReplayPlayerSelectSound; // 0x268(0x08)
	struct USoundBase* ReplayPlayerDeselectSound; // 0x270(0x08)
	struct UDH_ScoreboardPlayerListItemViewWidget* View; // 0x278(0x08)
	struct UDH_TextBlockWidget* PlayerLabel; // 0x280(0x08)
	struct UButton* BaseButton; // 0x288(0x08)
	struct UTexture2D* Avatar; // 0x290(0x08)
	char pad_298[0x8]; // 0x298(0x08)
	struct UDH_ScoreboardPlayerListItemTooltipWidget* ListItemTooltip; // 0x2a0(0x08)
	char pad_2A8[0x8]; // 0x2a8(0x08)

	void SetIsSelected(bool bNewIsSelected); // Function DreadHungerUI.DH_ScoreboardPlayerListItemWidget.SetIsSelected // (Final|Native|Public|BlueprintCallable) // @ game+0xffec00
	void OnBaseButtonClicked(); // Function DreadHungerUI.DH_ScoreboardPlayerListItemWidget.OnBaseButtonClicked // (Final|Native|Private) // @ game+0xffdf30
};

// Class DreadHungerUI.DH_ScoreboardPlayerListWidget
// Size: 0x280 (Inherited: 0x260)
struct UDH_ScoreboardPlayerListWidget : UUserWidget {
	struct UDH_ScoreboardPlayerListItemWidget* ItemClass; // 0x260(0x08)
	struct UWrapBox* PlayerList; // 0x268(0x08)
	struct TArray<struct UDH_ScoreboardPlayerListItemWidget*> Items; // 0x270(0x10)

	void OnShowScoreboard(bool bShowScoreboard, bool bReplayJustLoaded); // Function DreadHungerUI.DH_ScoreboardPlayerListWidget.OnShowScoreboard // (Final|Native|Private) // @ game+0xffe5a0
	void BP_OnItemCreated(struct UDH_ScoreboardPlayerListItemWidget* CreatedItem); // Function DreadHungerUI.DH_ScoreboardPlayerListWidget.BP_OnItemCreated // (Event|Protected|BlueprintEvent) // @ game+0x1355100
};


// Class DreadHungerUI.DH_ScoreboardPlayerReportCardStoryDataAsset
// Size: 0x180 (Inherited: 0x30)
struct UDH_ScoreboardPlayerReportCardStoryDataAsset : UDataAsset {
	struct FText CannibalDescription; // 0x30(0x18)
	struct FText MurderDescription; // 0x48(0x18)
	struct FText KillDescription; // 0x60(0x18)
	struct FText BoilerFuelDescription; // 0x78(0x18)
	struct TMap<enum class ECharacterDeathState, struct FText> DeathStateDescriptions; // 0x90(0x50)
	struct TMap<enum class EPlayerTeam, struct FText> TeamDescriptions; // 0xe0(0x50)
	struct TMap<enum class EPlayerMatchStatType, struct FText> StatDescriptions; // 0x130(0x50)
};

// Class DreadHungerUI.DH_ScoreboardPlayerReportCardWidget
// Size: 0x308 (Inherited: 0x260)
struct UDH_ScoreboardPlayerReportCardWidget : UUserWidget {
	struct UDH_ScoreboardPlayerStatWidget* StatClass; // 0x260(0x08)
	struct UDH_ScoreboardDataAsset* ScoreboardDataAsset; // 0x268(0x08)
	struct USoundBase* FinalGradeSound; // 0x270(0x08)
	struct UDH_PlayerReportCardAvatarWidget* Avatar; // 0x278(0x08)
	struct UDH_TextBlockWidget* TotalScoreLabel; // 0x280(0x08)
	struct UDH_TextBlockWidget* GradeLabel; // 0x288(0x08)
	struct UDH_TextBlockWidget* NameLabel; // 0x290(0x08)
	struct UDH_TextBlockWidget* RoleLabel; // 0x298(0x08)
	struct UScrollBox* DeedsList; // 0x2a0(0x08)
	struct USizeBox* DeedsListSizeBox; // 0x2a8(0x08)
	struct USizeBox* PlayerNameSizeBox; // 0x2b0(0x08)
	struct UBorder* GradeBorder; // 0x2b8(0x08)
	struct UWidgetAnimation* ShowFinalGradeAnimation; // 0x2c0(0x08)
	struct TArray<struct UDH_ScoreboardPlayerStatWidget*> Stats; // 0x2c8(0x10)
	struct TArray<struct UDH_ScoreboardPlayerStatWidget*> StatsToShow; // 0x2d8(0x10)
	char pad_2E8[0x20]; // 0x2e8(0x20)

	void ShowDeeds(); // Function DreadHungerUI.DH_ScoreboardPlayerReportCardWidget.ShowDeeds // (Final|Native|Public|BlueprintCallable) // @ game+0xffeef0
	void OnTimelineFrameChanged(); // Function DreadHungerUI.DH_ScoreboardPlayerReportCardWidget.OnTimelineFrameChanged // (Final|Native|Private) // @ game+0xffe960
	void OnSelectedIndicesChanged(struct TSet<int32_t>& InSelectedIndices); // Function DreadHungerUI.DH_ScoreboardPlayerReportCardWidget.OnSelectedIndicesChanged // (Final|Native|Private|HasOutParms) // @ game+0xffe1c0
	void HideDeeds(); // Function DreadHungerUI.DH_ScoreboardPlayerReportCardWidget.HideDeeds // (Final|Native|Public|BlueprintCallable) // @ game+0xffde40
};

// Class DreadHungerUI.DH_ScoreboardPlayerReportListWidget
// Size: 0x280 (Inherited: 0x260)
struct UDH_ScoreboardPlayerReportListWidget : UUserWidget {
	struct UDH_ScoreboardPlayerReportCardWidget* ReportCardClass; // 0x260(0x08)
	struct UWrapBox* ReportsList; // 0x268(0x08)
	struct TArray<struct UDH_ScoreboardPlayerReportCardWidget*> Items; // 0x270(0x10)

	void OnShowScoreboard(bool bShowScoreboard, bool bReplayJustLoaded); // Function DreadHungerUI.DH_ScoreboardPlayerReportListWidget.OnShowScoreboard // (Final|Native|Private) // @ game+0xffe670
	void OnSelectedIndicesChanged(struct TSet<int32_t>& InSelectedIndices); // Function DreadHungerUI.DH_ScoreboardPlayerReportListWidget.OnSelectedIndicesChanged // (Final|Native|Private|HasOutParms) // @ game+0xffe300
};


// Class DreadHungerUI.DH_ScoreboardPlayerStatWidget
// Size: 0x2a8 (Inherited: 0x260)
struct UDH_ScoreboardPlayerStatWidget : UUserWidget {
	struct UDH_ScoreboardDataAsset* ScoreboardDataAsset; // 0x260(0x08)
	struct UDH_TextBlockWidget* ValueLabel; // 0x268(0x08)
	struct UDH_TextBlockWidget* CountLabel; // 0x270(0x08)
	struct UDH_TextBlockWidget* DescriptionLabel; // 0x278(0x08)
	struct UWidgetAnimation* CountUpAnimation; // 0x280(0x08)
	struct UWidgetAnimation* FadeInAnimation; // 0x288(0x08)
	char pad_290[0x18]; // 0x290(0x18)

	int32_t GetScoreTotal(); // Function DreadHungerUI.DH_ScoreboardPlayerStatWidget.GetScoreTotal // (Final|Native|Public|BlueprintCallable|BlueprintPure|Const) // @ game+0xfde1f0
};


// Class DreadHungerUI.DH_ScoreboardTimelineWidget
// Size: 0xbd0 (Inherited: 0x260)
struct UDH_ScoreboardTimelineWidget : UUserWidget {
	struct USoundBase* ScrubSound; // 0x260(0x08)
	struct USoundBase* PlaybackSound; // 0x268(0x08)
	struct UTexture2D* ShipIcon; // 0x270(0x08)
	struct UObject* DoppelgangerIcon; // 0x278(0x08)
	struct TMap<enum class EPlayerMatchStatType, struct FScoreEventEffect> ScoreEventEffects; // 0x280(0x50)
	struct FScoreEventEffect PlayerDeathEffect; // 0x2d0(0x28)
	struct FScoreEventEffect DoppelDeathEffect; // 0x2f8(0x28)
	struct TArray<float> PlaybackSpeeds; // 0x320(0x10)
	struct FButtonStyle PlayStyle; // 0x330(0x278)
	struct FButtonStyle PauseStyle; // 0x5a8(0x278)
	struct FButtonStyle ReplayStyle; // 0x820(0x278)
	struct UMaterialInterface* MapOverheadParent; // 0xa98(0x08)
	struct FLinearColor MapTint; // 0xaa0(0x10)
	struct USoundBase* PlaybackSpeedChangedSound; // 0xab0(0x08)
	struct USoundBase* PlayingStartSound; // 0xab8(0x08)
	struct USoundBase* PlayingStopSound; // 0xac0(0x08)
	struct UButton* PlayButton; // 0xac8(0x08)
	struct UButton* PlaybackSpeedButton; // 0xad0(0x08)
	struct UDH_TextBlockWidget* CurrentTimeLabel; // 0xad8(0x08)
	struct UDH_TextBlockWidget* PlaybackSpeedLabel; // 0xae0(0x08)
	struct UImage* MapOverheadImage; // 0xae8(0x08)
	struct USlider* TimelineSlider; // 0xaf0(0x08)
	char pad_AF8[0x80]; // 0xaf8(0x80)
	struct TMap<enum class EPlayerTeamRole, struct FRoleIconSet> RoleIcons; // 0xb78(0x50)
	char pad_BC8[0x8]; // 0xbc8(0x08)

	void StopScrubbing(); // Function DreadHungerUI.DH_ScoreboardTimelineWidget.StopScrubbing // (Final|Native|Private) // @ game+0xffef50
	void StartScrubbing(); // Function DreadHungerUI.DH_ScoreboardTimelineWidget.StartScrubbing // (Final|Native|Private) // @ game+0xffef30
	void SetIsPlaying(bool bNewIsPlaying); // Function DreadHungerUI.DH_ScoreboardTimelineWidget.SetIsPlaying // (Final|Native|Public|BlueprintCallable) // @ game+0xffeb70
	void ScrollPlaybackSpeed(); // Function DreadHungerUI.DH_ScoreboardTimelineWidget.ScrollPlaybackSpeed // (Final|Native|Private) // @ game+0xffea30
	void OnSliderValueChanged(float Value); // Function DreadHungerUI.DH_ScoreboardTimelineWidget.OnSliderValueChanged // (Final|Native|Private) // @ game+0xffe8e0
	void OnShowScoreboard(bool bShowScoreboard, bool bReplayJustLoaded); // Function DreadHungerUI.DH_ScoreboardTimelineWidget.OnShowScoreboard // (Final|Native|Private) // @ game+0xffe740
	void OnScoreboardHidden(); // Function DreadHungerUI.DH_ScoreboardTimelineWidget.OnScoreboardHidden // (Final|Native|Private) // @ game+0xffe180
	void OnPlayButtonClicked(); // Function DreadHungerUI.DH_ScoreboardTimelineWidget.OnPlayButtonClicked // (Final|Native|Private) // @ game+0xffe040
};

// Class DreadHungerUI.DH_ScoreboardUtility
// Size: 0x28 (Inherited: 0x28)
struct UDH_ScoreboardUtility : UObject {
};


// Class DreadHungerUI.DH_ScoreboardWidget
// Size: 0x370 (Inherited: 0x2e0)
struct UDH_ScoreboardWidget : UDH_VisibilityWidget {
	char pad_2E0[0x8]; // 0x2e0(0x08)
	struct USoundBase* OpenMusic; // 0x2e8(0x08)
	struct USoundBase* CloseSound; // 0x2f0(0x08)
	struct USoundBase* CopyReplaySound; // 0x2f8(0x08)
	struct UDH_CloseButtonWidget* CloseButton; // 0x300(0x08)
	struct UButton* CopyMatchIDButton; // 0x308(0x08)
	struct UDH_ScoreboardGameReportWidget* GameReport; // 0x310(0x08)
	char pad_318[0x58]; // 0x318(0x58)

	void SetSelectedIndices(struct TSet<int32_t>& InSelectedIndices); // Function DreadHungerUI.DH_ScoreboardWidget.SetSelectedIndices // (Final|Native|Private|HasOutParms) // @ game+0xffedb0
	void RemoveSelectedIndex(int32_t InSelectedIndex); // Function DreadHungerUI.DH_ScoreboardWidget.RemoveSelectedIndex // (Final|Native|Private) // @ game+0xffe9a0
	void OnShowScoreboard(bool bShowScoreboard, bool bReplayJustLoaded); // Function DreadHungerUI.DH_ScoreboardWidget.OnShowScoreboard // (Final|Native|Private) // @ game+0xffe810
	void OnCopyMatchIDButtonClicked(); // Function DreadHungerUI.DH_ScoreboardWidget.OnCopyMatchIDButtonClicked // (Final|Native|Private) // @ game+0xffe000
	void OnCloseButtonWidgetClicked(); // Function DreadHungerUI.DH_ScoreboardWidget.OnCloseButtonWidgetClicked // (Final|Native|Private) // @ game+0xffdf50
	void AddSelectedIndex(int32_t InSelectedIndex); // Function DreadHungerUI.DH_ScoreboardWidget.AddSelectedIndex // (Final|Native|Private) // @ game+0xffdd90
};

// WidgetBlueprintGeneratedClass WBP_PlayerReportCardList.WBP_PlayerReportCardList_C
// Size: 0x280 (Inherited: 0x280)
struct UWBP_PlayerReportCardList_C : UDH_ScoreboardPlayerReportListWidget {
};

// WidgetBlueprintGeneratedClass WBP_PlayerReportCard.WBP_PlayerReportCard_C
// Size: 0x308 (Inherited: 0x308)
struct UWBP_PlayerReportCard_C : UDH_ScoreboardPlayerReportCardWidget {
};

// WidgetBlueprintGeneratedClass WBP_PlayerStat.WBP_PlayerStat_C
// Size: 0x2a8 (Inherited: 0x2a8)
struct UWBP_PlayerStat_C : UDH_ScoreboardPlayerStatWidget {
};

// WidgetBlueprintGeneratedClass WBP_ScoreboardGameReport.WBP_ScoreboardGameReport_C
// Size: 0x290 (Inherited: 0x288)
struct UWBP_ScoreboardGameReport_C : UDH_ScoreboardGameReportWidget {
	struct UWBP_ScoreboardTimeline_C* Timeline; // 0x288(0x08)
};

// WidgetBlueprintGeneratedClass WBP_ScoreboardPlayerListItemTooltip.WBP_ScoreboardPlayerListItemTooltip_C
// Size: 0x268 (Inherited: 0x268)
struct UWBP_ScoreboardPlayerListItemTooltip_C : UDH_ScoreboardPlayerListItemTooltipWidget {
};

// WidgetBlueprintGeneratedClass WBP_ScoreboardPlayerListItemView.WBP_ScoreboardPlayerListItemView_C
// Size: 0x2f0 (Inherited: 0x2f0)
struct UWBP_ScoreboardPlayerListItemView_C : UDH_ScoreboardPlayerListItemViewWidget {
};

// WidgetBlueprintGeneratedClass WBP_ScoreboardPlayerListItem.WBP_ScoreboardPlayerListItem_C
// Size: 0x2b0 (Inherited: 0x2b0)
struct UWBP_ScoreboardPlayerListItem_C : UDH_ScoreboardPlayerListItemWidget {
};

// WidgetBlueprintGeneratedClass WBP_ScoreboardPlayerList.WBP_ScoreboardPlayerList_C
// Size: 0x280 (Inherited: 0x280)
struct UWBP_ScoreboardPlayerList_C : UDH_ScoreboardPlayerListWidget {
};

// WidgetBlueprintGeneratedClass WBP_ScoreboardTimeline.WBP_ScoreboardTimeline_C
// Size: 0xbd0 (Inherited: 0xbd0)
struct UWBP_ScoreboardTimeline_C : UDH_ScoreboardTimelineWidget {
};

// WidgetBlueprintGeneratedClass WBP_Scoreboard.WBP_Scoreboard_C
// Size: 0x378 (Inherited: 0x370)
struct UWBP_Scoreboard_C : UDH_ScoreboardWidget {
	struct UWBP_PlayerReportCardList_C* ReportCards; // 0x370(0x08)
};

struct ADH_GameMode : public ADH_GameModeBase
{
	// StructSize: 1264 SuperStructSize: 896
	float ShipEscapeTime;		// Offset: 0x380  Size: 4
	float ShipSinkTime;		// Offset: 0x384  Size: 4
	float ExplorersKilledTime;		// Offset: 0x388  Size: 4
	int32_t DaysBeforeBlizzard;		// Offset: 0x38c  Size: 4
	float PregameInstructionsTime;		// Offset: 0x390  Size: 4
	struct USoundBase* GameStartedSound;		// Offset: 0x398  Size: 8
	struct USoundBase* ShipEscapingSound;		// Offset: 0x3a0  Size: 8
	struct USoundBase* ShipSankSound;		// Offset: 0x3a8  Size: 8
	struct ADH_RoleDealer* RoleDealer;		// Offset: 0x3b0  Size: 8
	class ADH_RoleDealer* RoleDealerClass;		// Offset: 0x3b8  Size: 8
	class APawn* LobbyPawnClass;		// Offset: 0x3c0  Size: 8
	class APawn* PrisonerPawnClass;		// Offset: 0x3c8  Size: 8
	float RespawnTime;		// Offset: 0x3d0  Size: 4
	struct UDH_DropTable* RespawnDropTable;		// Offset: 0x3d8  Size: 8
	class ADH_Inventory* ThrallStartingItem;		// Offset: 0x3e0  Size: 8
	struct ADH_GameState* DHGameState;		// Offset: 0x3e8  Size: 8
	bool bShowPregameInstructions;		// Offset: 0x404  Size: 1
	float StartWithoutAllPlayersTime;		// Offset: 0x408  Size: 4
	struct UDH_ScoreboardDataAsset* ScoreboardDataAsset;		// Offset: 0x410  Size: 8
	struct TArray<struct UDH_PlayerRoleData*> RemainingPFHRoles;		// Offset: 0x450  Size: 16
	struct TArray<struct ADH_CannibalCharacter*> ActiveCannibals;		// Offset: 0x4c8  Size: 16
	struct TArray<struct ADH_CannibalCharacter*> InactiveCannibals;		// Offset: 0x4d8  Size: 16
	void ShipHasArrived();		// RVA: 0000000000EB79C0 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Public|BlueprintCallable)
	void SendThrallMessage(FText Message, struct ADH_PlayerController* Sender);		// RVA: 0000000000EB7810 ParamSize: 32 ParamNum: 2 Flags: (Final|Native|Public|HasOutParms|BlueprintCallable)
	void RemoveCoalPickup(struct ADH_InventoryPickup* CoalToRemove);		// RVA: 0000000000EB7780 ParamSize: 8 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable)
	void OnPokerRoundEnded(struct ADH_RoleDealer* InRoleDealer);		// RVA: 0000000000EB7590 ParamSize: 8 ParamNum: 1 Flags: (Final|Native|Private)
	void GiveNextCodeToPlayer(struct ADH_PlayerState* PlayerState);		// RVA: 0000000000EB6BD0 ParamSize: 8 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable)
	bool ExportMatchStats(bool bMatchGivesExperience);		// RVA: 0000000000EB6B30 ParamSize: 2 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	void AddCoalPickup(struct ADH_InventoryPickup* CoalToAdd);		// RVA: 0000000000EB68A0 ParamSize: 8 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable)
};

struct UDH_GameInstance : public UGameInstance
{
	// StructSize: 1416 SuperStructSize: 424
	struct UMaterialParameterCollection* WeatherParameters;		// Offset: 0x2e8  Size: 8
	struct UMaterialParameterCollection* TODParameters;		// Offset: 0x2f0  Size: 8
	struct UMaterialParameterCollection* CharacterMaterialParameters;		// Offset: 0x2f8  Size: 8
	float TimelineUpdateInterval;		// Offset: 0x300  Size: 4
	struct TMap<FString, struct FLinearColor> BloodColors;		// Offset: 0x308  Size: 80
	struct UDH_InventoryListDataAsset* InventoryList;		// Offset: 0x358  Size: 8
	struct UDH_CosmeticsListDataAsset* CosmeticsList;		// Offset: 0x360  Size: 8
	struct TMap<enum class FESpecialEventType, struct FSpecialEvent> SpecialEvents;		// Offset: 0x368  Size: 80
	struct TArray<struct UDH_PlayerRoleData*> PlayerRoleList;		// Offset: 0x3b8  Size: 16
	struct UDH_PlayerRanks* PlayerRankList;		// Offset: 0x3c8  Size: 8
	struct TArray<struct UDH_MapData*> MissionList;		// Offset: 0x3d0  Size: 16
	struct UDH_TutorialChapterList* TutorialChapterList;		// Offset: 0x3e0  Size: 8
	struct UDH_CustomGameSettings* CustomGameSettingsList;		// Offset: 0x3e8  Size: 8
	struct UDH_CraftingData* CraftingData;		// Offset: 0x3f0  Size: 8
	struct UDH_RolePerkLevelCurve* ExperienceToRankCurve;		// Offset: 0x3f8  Size: 8
	struct UDH_ScoreboardDataAsset* ScoreboardData;		// Offset: 0x400  Size: 8
	class UDamageType* FallingDamageType;		// Offset: 0x408  Size: 8
	class UDamageType* DrowningDamageType;		// Offset: 0x410  Size: 8
	class UDamageType* SuicideDamageType;		// Offset: 0x418  Size: 8
	class UDamageType* ColdDamageType;		// Offset: 0x420  Size: 8
	class UDamageType* StarvationDamageType;		// Offset: 0x428  Size: 8
	class UDamageType* PoisonDamageType;		// Offset: 0x430  Size: 8
	class UDamageType* NitroDamageType;		// Offset: 0x438  Size: 8
	struct TArray<class UDH_TotemSpell*> ThrallSpells;		// Offset: 0x440  Size: 16
	struct TArray<struct UDH_PlayerTalisman*> Talismans;		// Offset: 0x450  Size: 16
	struct UDH_PlayerSession* PlayerSession;		// Offset: 0x4c8  Size: 8
	struct UDH_HintsSaveGame* HintsSaveGameInstance;		// Offset: 0x4d0  Size: 8
	struct UDH_PlayerCareerSaveGame* PlayerCareerSaveGameInstance;		// Offset: 0x4d8  Size: 8
	struct UDH_PlayerCareerCloudSaveData* PlayerCareerCloudSaveDataInstance;		// Offset: 0x4e0  Size: 8
	struct UDH_VoipSettingsSaveGame* VoipSettingsSaveGameInstance;		// Offset: 0x4e8  Size: 8
	struct UDH_OnlineSettingsSaveGame* OnlineSettingsSaveGameInstance;		// Offset: 0x4f0  Size: 8
	struct UDH_HintsJsonSaveData* HintsJsonSaveDataInstance;		// Offset: 0x4f8  Size: 8
	struct UDH_PlayerSettingsJsonSaveData* PlayerSettingsJsonSaveDataInstance;		// Offset: 0x500  Size: 8
	struct UDH_VoipSettingsJsonSaveData* VoipSettingsJsonSaveDataInstance;		// Offset: 0x508  Size: 8
	struct UDH_OnlineSettingsJsonSaveData* OnlineSettingsJsonSaveDataInstance;		// Offset: 0x510  Size: 8
	struct UDH_MessageBus* MessageBus;		// Offset: 0x518  Size: 8
	struct UDH_OnlineVoice* OnlineVoice;		// Offset: 0x520  Size: 8
	struct UDH_WidgetsToInstanceStore* WidgetsToInstanceStore;		// Offset: 0x528  Size: 8
	struct UDH_ErrorStore* ErrorStore;		// Offset: 0x530  Size: 8
	struct UDH_Online* Online;		// Offset: 0x538  Size: 8
	struct UDH_LoginHandler* LoginHandler;		// Offset: 0x540  Size: 8
	struct UDH_MatchReplay* CurrentReplayInstance;		// Offset: 0x548  Size: 8
	struct UAudioComponent* EndOfMatchMusicComponent;		// Offset: 0x550  Size: 8
	void OnSetCurrentReplay(struct UDH_MatchReplay* InReplay);		// RVA: 0000000000EB7660 ParamSize: 8 ParamNum: 1 Flags: (Final|Native|Protected)
	bool IsLowGore(struct UObject* WorldContextObject);		// RVA: 0000000000EB6CA0 ParamSize: 9 ParamNum: 2 Flags: (Final|Native|Static|Public|BlueprintCallable|BlueprintPure)
	void ConvertSaveGameDataToJsonSaveData();		// RVA: 0000000000EB6930 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Public)
};

struct ADH_PlayerState : public APlayerState
{
	// StructSize: 1736 SuperStructSize: 800
	struct TArray<struct FPlayerMatchStat> MatchStats;		// Offset: 0x330  Size: 16
	struct UDH_ScoreboardDataAsset* ScoreboardDataAsset;		// Offset: 0x340  Size: 8
	struct TArray<struct FUniqueNetIdRepl> VictimIDs;		// Offset: 0x348  Size: 16
	struct FUniqueNetIdRepl KillerID;		// Offset: 0x358  Size: 40
	struct UDH_DamageType* CauseOfDeath;		// Offset: 0x380  Size: 8
	int32_t MaxConcurrentTotems;		// Offset: 0x388  Size: 4
	struct TMap<enum class FETotemSpellTiers, float> SpellTierLevels;		// Offset: 0x390  Size: 80
	struct ADH_GroundCraftingBlueprint* ActiveCraftingProject;		// Offset: 0x3e8  Size: 8
	FMulticastInlineDelegate OnThrallChangedDelegate;		// Offset: 0x3f8  Size: 16
	FMulticastInlineDelegate OnDeadChangedDelegate;		// Offset: 0x408  Size: 16
	FMulticastInlineDelegate OnDeathCountChangedDelegate;		// Offset: 0x418  Size: 16
	FMulticastInlineDelegate OnSelectedRoleChangedDelegate;		// Offset: 0x428  Size: 16
	struct TArray<struct FTrinket> Trinkets;		// Offset: 0x440  Size: 16
	class ADH_Inventory* QuestNoteClass;		// Offset: 0x458  Size: 8
	float TrinketChanceIncrease;		// Offset: 0x464  Size: 4
	float TrinketChanceInitial;		// Offset: 0x468  Size: 4
	class ADH_Inventory* ArmoryCodeClass;		// Offset: 0x470  Size: 8
	struct ADH_QuestState* QuestState;		// Offset: 0x478  Size: 8
	class ADH_SpellManager* SpellManagerClass;		// Offset: 0x480  Size: 8
	struct ADH_SpellManager* SpellManager;		// Offset: 0x488  Size: 8
	struct TArray<struct FArmoryCode> KnownArmoryCodes;		// Offset: 0x490  Size: 16
	struct USoundBase* ReceivedArmoryCodeSound;		// Offset: 0x4a0  Size: 8
	struct UTexture2D* ReceivedArmoryCodeImage;		// Offset: 0x4a8  Size: 8
	struct FDH_XPProgressData ProgressData;		// Offset: 0x4b0  Size: 12
	struct TMap<enum class FEPlayerTeam, struct USoundMix*> HushedSoundMix;		// Offset: 0x4c0  Size: 80
	struct TMap<enum class FEPlayerTeam, struct UReverbEffect*> HushedReverbEffect;		// Offset: 0x510  Size: 80
	struct TArray<struct FCraftingRecord> CraftedRecipes;		// Offset: 0x560  Size: 16
	bool bIsDead;		// Offset: 0x570  Size: 1
	bool bIsDisconnected;		// Offset: 0x571  Size: 1
	bool bIsThrall;		// Offset: 0x572  Size: 1
	struct TArray<struct ADH_PlayerState*> OtherThralls;		// Offset: 0x578  Size: 16
	float CannibalLevel;		// Offset: 0x588  Size: 4
	struct UDH_PlayerRoleData* SelectedRole;		// Offset: 0x590  Size: 8
	int32_t PrestigeLevel;		// Offset: 0x598  Size: 4
	struct TArray<struct FEquippedPlayerCosmetics> EquippedCosmeticItems;		// Offset: 0x5f0  Size: 16
	struct TArray<struct UDH_PlayerTalisman*> EquippedTalismans;		// Offset: 0x600  Size: 16
	int32_t Auth_Experience;		// Offset: 0x610  Size: 4
	int32_t Auth_Rank;		// Offset: 0x614  Size: 4
	struct TArray<struct ADH_ThrallTotem*> OwnedTotems;		// Offset: 0x620  Size: 16
	int32_t DeathCount;		// Offset: 0x630  Size: 4
	struct APawn* RealPawn;		// Offset: 0x638  Size: 8
	bool bGloballyMuted;		// Offset: 0x648  Size: 1
	struct TArray<uint16_t> PoisonedItemUIDs;		// Offset: 0x650  Size: 16
	void SetPlayerRole(struct UDH_PlayerRoleData* NewStartingRole, bool bBroadcastNotification);		// RVA: 0000000000EF32E0 ParamSize: 9 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable)
	class ADH_Inventory* RollForTrinket(bool bWildlifeTable);		// RVA: 0000000000EF3250 ParamSize: 16 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure)
	void OnRep_SpellManager();		// RVA: 0000000000EF2F10 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_SelectedRole();		// RVA: 00000000008A8490 ParamSize: 0 ParamNum: 0 Flags: (Native|Event|Public|BlueprintEvent)
	void OnRep_QuestState();		// RVA: 0000000000EF2EF0 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_ProgressData();		// RVA: 0000000000EF2ED0 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private|Const)
	void OnRep_PrestigeLevel();		// RVA: 0000000000EF2EB0 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Public)
	void OnRep_PoisonedItemUIDs();		// RVA: 0000000000EF2E90 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private|Const)
	void OnRep_OwnedTotems();		// RVA: 0000000000EF2E70 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_OtherThralls();		// RVA: 0000000000EF2E50 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_KnownArmoryCodes();		// RVA: 0000000000EF2E30 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_IsThrall();		// RVA: 0000000000EF2E10 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_IsDisconnected();		// RVA: 0000000000EF2DF0 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_IsDead();		// RVA: 0000000000EF2DD0 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_GloballyMuted();		// RVA: 0000000000EF2DB0 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_EquippedCosmeticItems();		// RVA: 0000000000EF2D90 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_DeathCount();		// RVA: 0000000000EF2D70 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void OnRep_CannibalLevel();		// RVA: 0000000000EF2D50 ParamSize: 0 ParamNum: 0 Flags: (Final|Native|Private)
	void ModifySpellChargeLevel(float Delta);		// RVA: 0000000000EF2C20 ParamSize: 4 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable)
	void ModifyMatchStat(enum class FEPlayerMatchStatType Stat, int32_t Delta, struct AActor* Target, bool bScoreAfterShipEscaped);		// RVA: 0000000000EF2AC0 ParamSize: 17 ParamNum: 4 Flags: (Final|Native|Public|BlueprintCallable)
	bool IsThrall();		// RVA: 0000000000EF2AA0 ParamSize: 1 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	bool IsRecipeExhausted(struct UDH_CraftingRecipe* Recipe);		// RVA: 0000000000EF2A00 ParamSize: 9 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure)
	bool IsItemPoisoned(int32_t ItemUID);		// RVA: 0000000000EF2960 ParamSize: 5 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	bool IsDead();		// RVA: 0000000000EF2930 ParamSize: 1 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	bool IsCannibal();		// RVA: 0000000000EF2900 ParamSize: 1 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	float GetSpellCooldown(class UDH_TotemSpell* SpellType);		// RVA: 0000000000EF2860 ParamSize: 12 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	enum class FETotemSpellTiers GetSpellChargeTier();		// RVA: 0000000000EF2830 ParamSize: 1 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	float GetSpellChargeLevel();		// RVA: 0000000000EF2800 ParamSize: 4 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	enum class FEPlayerTeam GetPlayerTeam();		// RVA: 0000000000EF2700 ParamSize: 1 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	struct UDH_PlayerRoleData* GetPlayerRoleData();		// RVA: 0000000000EF26E0 ParamSize: 8 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	enum class FEPlayerTeamRole GetPlayerRole();		// RVA: 0000000000EF26B0 ParamSize: 1 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	struct TArray<struct ADH_ThrallTotem*> GetOwnedTotemsOfType(class ADH_ThrallTotem* Type);		// RVA: 0000000000EF25D0 ParamSize: 24 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure)
	struct TArray<struct ADH_ThrallTotem*> GetOwnedTotems();		// RVA: 0000000000EF2510 ParamSize: 16 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	struct FEquippedPlayerCosmetics GetEquippedCosmeticItemsForRole(enum class FEPlayerTeamRole InRole);		// RVA: 0000000000EF21B0 ParamSize: 32 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	int32_t GetDeathCount();		// RVA: 0000000000EF2190 ParamSize: 4 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	struct ADH_HumanCharacter* GetControlledDoppelganger();		// RVA: 0000000000EF2160 ParamSize: 8 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	float GetCannibalLevel();		// RVA: 0000000000EF2140 ParamSize: 4 ParamNum: 1 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
	struct TArray<struct UDH_TotemSpell*> GetActiveSpellsOfType(class UDH_TotemSpell* Type);		// RVA: 0000000000EF1F90 ParamSize: 24 ParamNum: 2 Flags: (Final|Native|Public|BlueprintCallable|BlueprintPure|Const)
};

struct UDH_ScoreboardDataAsset : public UDataAsset
{
	// StructSize: 256 SuperStructSize: 48
	struct FLinearColor LowestGradeColor;		// Offset: 0x30  Size: 16
	struct FLinearColor HighestGradeColor;		// Offset: 0x40  Size: 16
	struct TMap<enum class FEStatScoringValue, float> ScorePointValues;		// Offset: 0x50  Size: 80
	struct TArray<class UDH_PlayerMatchStat*> ScorableStats;		// Offset: 0xa0  Size: 16
	struct TMap<enum class FEPlayerPerformanceGrade, struct FPlayerScoreGrade> PerformanceGrades;		// Offset: 0xb0  Size: 80
};
