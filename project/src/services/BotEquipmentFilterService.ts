import { inject, injectable } from "tsyringe";

import { BotHelper } from "@spt-aki/helpers/BotHelper";
import { ProfileHelper } from "@spt-aki/helpers/ProfileHelper";
import {
    EquipmentChances, Generation,
    GenerationData,
    IBotType,
    ModsChances
} from "@spt-aki/models/eft/common/tables/IBotType";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { BotGenerationDetails } from "@spt-aki/models/spt/bots/BotGenerationDetails";
import {
    AdjustmentDetails, EquipmentFilterDetails, EquipmentFilters, IBotConfig,
    WeightingAdjustmentDetails
} from "@spt-aki/models/spt/config/IBotConfig";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";

@injectable()
export class BotEquipmentFilterService
{
    protected botConfig: IBotConfig;
    protected botEquipmentConfig: Record<string, EquipmentFilters>;

    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("BotHelper") protected botHelper: BotHelper,
        @inject("ProfileHelper") protected profileHelper: ProfileHelper,
        @inject("ConfigServer") protected configServer: ConfigServer
    )
    {
        this.botConfig = this.configServer.getConfig(ConfigTypes.BOT);
        this.botEquipmentConfig = this.botConfig.equipment;
    }

    /**
     * Filter a bots data to exclude equipment and cartridges defines in the botConfig
     * @param sessionId Players id
     * @param baseBotNode bots json data to filter
     * @param botLevel Level of the bot
     * @param botGenerationDetails details on how to generate a bot
     */
    public filterBotEquipment(sessionId: string, baseBotNode: IBotType, botLevel: number, botGenerationDetails: BotGenerationDetails): void
    {
        const pmcProfile = this.profileHelper.getPmcProfile(sessionId);

        const botRole = (botGenerationDetails.isPmc)
            ? "pmc"
            : botGenerationDetails.role;
        const botEquipmentBlacklist = this.getBotEquipmentBlacklist(botRole, botLevel);
        const botEquipmentWhitelist = this.getBotEquipmentWhitelist(botRole, botLevel);
        const botWeightingAdjustments = this.getBotWeightingAdjustments(botRole, botLevel);
        const botWeightingAdjustmentsByPlayerLevel = this.getBotWeightingAdjustmentsByPlayerLevel(botRole, pmcProfile.Info.Level);

        const botEquipConfig = this.botConfig.equipment[botRole];
        const randomisationDetails = this.botHelper.getBotRandomizationDetails(botLevel, botEquipConfig);
        
        if (botEquipmentBlacklist || botEquipmentWhitelist)
        {
            this.filterEquipment(baseBotNode, botEquipmentBlacklist, botEquipmentWhitelist);
            this.filterCartridges(baseBotNode, botEquipmentBlacklist, botEquipmentWhitelist);
        }
        
        if (botWeightingAdjustments)
        {
            this.adjustWeighting(botWeightingAdjustments?.equipment, baseBotNode.inventory.equipment);
            this.adjustWeighting(botWeightingAdjustments?.ammo, baseBotNode.inventory.Ammo);
            // Dont warn when edited item not found, we're editing usec/bear clothing and they dont have each others clothing
            this.adjustWeighting(botWeightingAdjustments?.clothing, baseBotNode.appearance, false);
        }

        if (botWeightingAdjustmentsByPlayerLevel)
        {
            this.adjustWeighting(botWeightingAdjustmentsByPlayerLevel?.equipment, baseBotNode.inventory.equipment);
            this.adjustWeighting(botWeightingAdjustmentsByPlayerLevel?.ammo, baseBotNode.inventory.Ammo);
        }

        if (randomisationDetails)
        {
            this.adjustChances(randomisationDetails?.equipment, baseBotNode.chances.equipment);
            this.adjustChances(randomisationDetails?.mods, baseBotNode.chances.mods);
            this.adjustGenerationChances(randomisationDetails?.generation, baseBotNode.generation);
        }
    }

    /**
     * Iterate over the changes passed in and apply them to baseValues parameter
     * @param equipmentChanges Changes to apply
     * @param baseValues data to update
     */
    protected adjustChances(equipmentChanges: Record<string, number>, baseValues: EquipmentChances | ModsChances): void
    {
        if (!equipmentChanges)
        {
            return;
        }

        for (const itemKey in equipmentChanges)
        {
            baseValues[itemKey] = equipmentChanges[itemKey];
        }
    }

    /**
     * Iterate over the Generation changes and alter data in baseValues.Generation
     * @param generationChanges Changes to apply
     * @param baseBotGeneration dictionary to update
     */
    protected adjustGenerationChances(generationChanges: Record<string, GenerationData>, baseBotGeneration: Generation): void
    {
        if (!generationChanges)
        {
            return;
        }

        for (const itemKey in generationChanges)
        {
            baseBotGeneration.items[itemKey].weights = generationChanges[itemKey].weights;
            baseBotGeneration.items[itemKey].whitelist = generationChanges[itemKey].whitelist;
        }
    }

    /**
     * Get equipment settings for bot
     * @param botEquipmentRole equipment role to return
     * @returns EquipmentFilters object
     */
    public getBotEquipmentSettings(botEquipmentRole: string): EquipmentFilters
    {
        return this.botEquipmentConfig[botEquipmentRole];
    }

    /**
     * Get weapon sight whitelist for a specific bot type
     * @param botEquipmentRole equipment role of bot to look up
     * @returns Dictionary of weapon type and their whitelisted scope types
     */
    public getBotWeaponSightWhitelist(botEquipmentRole: string): Record<string, string[]>
    {
        const botEquipmentSettings = this.botEquipmentConfig[botEquipmentRole];

        if (!botEquipmentSettings)
        {
            return null;
        }

        return botEquipmentSettings.weaponSightWhitelist;
    }

    /**
     * Get an object that contains equipment and cartridge blacklists for a specified bot type
     * @param botRole Role of the bot we want the blacklist for
     * @param playerLevel Level of the player
     * @returns EquipmentBlacklistDetails object
     */
    public getBotEquipmentBlacklist(botRole: string, playerLevel: number): EquipmentFilterDetails
    {
        const blacklistDetailsForBot = this.botEquipmentConfig[botRole];

        // No equipment blacklist found, skip
        if (!blacklistDetailsForBot || Object.keys(blacklistDetailsForBot).length === 0 || !blacklistDetailsForBot.blacklist)
        {
            return null;
        }

        return blacklistDetailsForBot.blacklist.find(x => playerLevel >= x.levelRange.min && playerLevel <= x.levelRange.max);
    }

    /**
     * Get the whitelist for a specific bot type that's within the players level
     * @param botRole Bot type
     * @param playerLevel Players level
     * @returns EquipmentFilterDetails object
     */
    protected getBotEquipmentWhitelist(botRole: string, playerLevel: number): EquipmentFilterDetails
    {
        const botEquipmentConfig = this.botEquipmentConfig[botRole];

        // No equipment blacklist found, skip
        if (!botEquipmentConfig || Object.keys(botEquipmentConfig).length === 0 || !botEquipmentConfig.whitelist)
        {
            return null;
        }

        return botEquipmentConfig.whitelist.find(x => playerLevel >= x.levelRange.min && playerLevel <= x.levelRange.max);
    }

    /**
     * Retrieve item weighting adjustments from bot.json config based on bot level
     * @param botRole Bot type to get adjustments for
     * @param botLevel Level of bot
     * @returns Weighting adjustments for bot items
     */
    protected getBotWeightingAdjustments(botRole: string, botLevel: number): WeightingAdjustmentDetails
    {
        const botEquipmentConfig = this.botEquipmentConfig[botRole];

        // No config found, skip
        if (!botEquipmentConfig || Object.keys(botEquipmentConfig).length === 0 || !botEquipmentConfig.weightingAdjustmentsByBotLevel)
        {
            return null;
        }

        return botEquipmentConfig.weightingAdjustmentsByBotLevel.find(x => botLevel >= x.levelRange.min && botLevel <= x.levelRange.max);
    }

    /**
     * Retrieve item weighting adjustments from bot.json config based on player level
     * @param botRole Bot type to get adjustments for
     * @param playerlevel Level of bot
     * @returns Weighting adjustments for bot items
     */
    protected getBotWeightingAdjustmentsByPlayerLevel(botRole: string, playerlevel: number): WeightingAdjustmentDetails
    {
        const botEquipmentConfig = this.botEquipmentConfig[botRole];

        // No config found, skip
        if (!botEquipmentConfig || Object.keys(botEquipmentConfig).length === 0 || !botEquipmentConfig.weightingAdjustmentsByPlayerLevel)
        {
            return null;
        }

        return botEquipmentConfig.weightingAdjustmentsByPlayerLevel.find(x => playerlevel >= x.levelRange.min && playerlevel <= x.levelRange.max);
    }

    /**
     * Filter bot equipment based on blacklist and whitelist from config/bot.json
     * Prioritizes whitelist first, if one is found blacklist is ignored
     * @param baseBotNode bot .json file to update
     * @param blacklist equipment blacklist
     * @returns Filtered bot file
     */
    protected filterEquipment(baseBotNode: IBotType, blacklist: EquipmentFilterDetails, whitelist: EquipmentFilterDetails): void
    {
        if (whitelist)
        {
            for (const equipmentSlotKey in baseBotNode.inventory.equipment)
            {
                const botEquipment = baseBotNode.inventory.equipment[equipmentSlotKey];

                // Skip equipment slot if whitelist doesnt exist / is empty
                const whitelistEquipmentForSlot = whitelist.equipment[equipmentSlotKey];
                if (!whitelistEquipmentForSlot || Object.keys(whitelistEquipmentForSlot).length === 0)
                {
                    continue;
                }

                // Filter equipment slot items to just items in whitelist
                baseBotNode.inventory.equipment[equipmentSlotKey] = Object.keys(botEquipment).filter((tpl) => whitelistEquipmentForSlot.includes(tpl)).reduce( (res, key) => (res[key] = botEquipment[key], res), {} );
            }

            return;
        }

        if (blacklist)
        {
            for (const equipmentSlotKey in baseBotNode.inventory.equipment)
            {
                const botEquipment = baseBotNode.inventory.equipment[equipmentSlotKey];

                // Skip equipment slot if blacklist doesnt exist / is empty
                const equipmentSlotBlacklist = blacklist.equipment[equipmentSlotKey];
                if (!equipmentSlotBlacklist || Object.keys(equipmentSlotBlacklist).length === 0)
                {
                    continue;
                }

                // Filter equipment slot items to just items not in blacklist
                baseBotNode.inventory.equipment[equipmentSlotKey] = Object.keys(botEquipment).filter((tpl) => !equipmentSlotBlacklist.includes(tpl)).reduce( (res, key) => (res[key] = botEquipment[key], res), {} );
            }
        }
    }

    /**
     * Filter bot cartridges based on blacklist and whitelist from config/bot.json
     * Prioritizes whitelist first, if one is found blacklist is ignored
     * @param baseBotNode bot .json file to update
     * @param blacklist equipment on this list should be excluded from the bot
     * @param whitelist equipment on this list should be used exclusively
     * @returns Filtered bot file
     */
    protected filterCartridges(baseBotNode: IBotType, blacklist: EquipmentFilterDetails, whitelist: EquipmentFilterDetails): void
    {
        if (whitelist)
        {
            for (const ammoCaliberKey in baseBotNode.inventory.Ammo)
            {
                const botAmmo = baseBotNode.inventory.Ammo[ammoCaliberKey];

                // Skip cartridge slot if whitelist doesnt exist / is empty
                const whiteListedCartridgesForCaliber = whitelist.cartridge[ammoCaliberKey];
                if (!whiteListedCartridgesForCaliber || Object.keys(whiteListedCartridgesForCaliber).length === 0)
                {
                    continue;
                }

                // Filter caliber slot items to just items in whitelist
                baseBotNode.inventory.Ammo[ammoCaliberKey] = Object.keys(botAmmo).filter((tpl) => whitelist.cartridge[ammoCaliberKey].includes(tpl)).reduce( (res, key) => (res[key] = botAmmo[key], res), {} );
            }

            return;
        }

        if (blacklist)
        {
            for (const ammoCaliberKey in baseBotNode.inventory.Ammo)
            {
                const botAmmo = baseBotNode.inventory.Ammo[ammoCaliberKey];

                // Skip cartridge slot if blacklist doesnt exist / is empty
                const cartridgeCaliberBlacklist = blacklist.cartridge[ammoCaliberKey];
                if (!cartridgeCaliberBlacklist || Object.keys(cartridgeCaliberBlacklist).length === 0)
                {
                    continue;
                }

                // Filter cartridge slot items to just items not in blacklist
                baseBotNode.inventory.Ammo[ammoCaliberKey] = Object.keys(botAmmo).filter((tpl) => !cartridgeCaliberBlacklist.includes(tpl)).reduce( (res, key) => (res[key] = botAmmo[key], res), {} );
            }
        }
    }

    /**
     * Add/Edit weighting changes to bot items using values from config/bot.json/equipment
     * @param weightingAdjustments Weighting change to apply to bot
     * @param botItemPool Bot item dictionary to adjust
     */
    protected adjustWeighting(weightingAdjustments: AdjustmentDetails, botItemPool: Record<string, any>, showEditWarnings = true): void
    {
        if (!weightingAdjustments)
        {
            return;
        }

        if (weightingAdjustments.add && Object.keys(weightingAdjustments.add).length > 0)
        {
            for (const poolAdjustmentKey in weightingAdjustments.add)
            {
                const locationToUpdate = botItemPool[poolAdjustmentKey];
                for (const itemToAddKey in weightingAdjustments.add[poolAdjustmentKey])
                {
                    locationToUpdate[itemToAddKey] = weightingAdjustments.add[poolAdjustmentKey][itemToAddKey];
                }
            }
        }

        if (weightingAdjustments.edit && Object.keys(weightingAdjustments.edit).length > 0)
        {
            for (const poolAdjustmentKey in weightingAdjustments.edit)
            {
                const locationToUpdate = botItemPool[poolAdjustmentKey];
                for (const itemToEditKey in weightingAdjustments.edit[poolAdjustmentKey])
                {
                    // Only make change if item exists as we're editing, not adding
                    if (locationToUpdate[itemToEditKey] || locationToUpdate[itemToEditKey] === 0)
                    {
                        locationToUpdate[itemToEditKey] = weightingAdjustments.edit[poolAdjustmentKey][itemToEditKey];
                    }
                    else
                    {
                        if (showEditWarnings)
                        {
                            this.logger.warning(`Tried to edit a non-existent item for slot: ${poolAdjustmentKey} ${itemToEditKey}`);
                        }
                    }
                }
            }
        }
    }
    
}