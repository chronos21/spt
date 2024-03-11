import { IBaseConfig } from "@spt-aki/models/spt/config/IBaseConfig";

export interface ICoreConfig extends IBaseConfig
{
    kind: "aki-core";
    akiVersion: string;
    projectName: string;
    compatibleTarkovVersion: string;
    serverName: string;
    profileSaveIntervalSeconds: number;
    sptFriendNickname: string;
    release: IRelease;
    fixes: IGameFixes;
    features: IServerFeatures;
    /** Commit hash build server was created from */
    commit?: string;
    /** Timestamp of server build */
    buildTime?: string;
}

export interface IRelease
{
    // Enables the cool watermark in-game
    isBeta?: boolean;
    // Whether mods are enabled
    isModdable?: boolean;
    // Are mods loaded on the server?
    isModded: boolean;
    // Disclaimer outlining the intended usage of bleeding edge
    betaDisclaimer?: string;
    // How long before the messagebox times out and closes the game
    betaDisclaimerTimeoutDelay: number;
    // Summary of release changes
    releaseSummary?: string;
}

export interface IGameFixes
{
    /** Shotguns use a different value than normal guns causing huge pellet dispersion  */
    fixShotgunDispersion: boolean;
    /** Remove items added by mods when the mod no longer exists - can fix dead profiles stuck at game load*/
    removeModItemsFromProfile: boolean;
    /** Fix issues that cause the game to not start due to inventory item issues */
    fixProfileBreakingInventoryItemIssues: boolean;
}

export interface IServerFeatures
{
    /* Controls whether or not the server attempts to download mod dependencies not included in the server's executable */
    autoInstallModDependencies: boolean;
    compressProfile: boolean;
    chatbotFeatures: IChatbotFeatures;
}

export interface IChatbotFeatures
{
    sptFriendEnabled: boolean;
    commandoEnabled: boolean;
    commandoFeatures: ICommandoFeatures;
}

export interface ICommandoFeatures
{
    giveCommandEnabled: boolean;
}
