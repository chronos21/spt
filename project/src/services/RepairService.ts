import { inject, injectable } from "tsyringe";

import { ItemHelper } from "@spt-aki/helpers/ItemHelper";
import { ProfileHelper } from "@spt-aki/helpers/ProfileHelper";
import { RepairHelper } from "@spt-aki/helpers/RepairHelper";
import { TraderHelper } from "@spt-aki/helpers/TraderHelper";
import { WeightedRandomHelper } from "@spt-aki/helpers/WeightedRandomHelper";
import { IArmorType } from "@spt-aki/models/eft/common/IGlobals";
import { IPmcData } from "@spt-aki/models/eft/common/IPmcData";
import { Item } from "@spt-aki/models/eft/common/tables/IItem";
import { ITemplateItem } from "@spt-aki/models/eft/common/tables/ITemplateItem";
import { IItemEventRouterResponse } from "@spt-aki/models/eft/itemEvent/IItemEventRouterResponse";
import { RepairKitsInfo } from "@spt-aki/models/eft/repair/IRepairActionDataRequest";
import { RepairItem } from "@spt-aki/models/eft/repair/ITraderRepairActionDataRequest";
import { IProcessBuyTradeRequestData } from "@spt-aki/models/eft/trade/IProcessBuyTradeRequestData";
import { BaseClasses } from "@spt-aki/models/enums/BaseClasses";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { SkillTypes } from "@spt-aki/models/enums/SkillTypes";
import { BonusSettings, IRepairConfig } from "@spt-aki/models/spt/config/IRepairConfig";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { LocalisationService } from "@spt-aki/services/LocalisationService";
import { PaymentService } from "@spt-aki/services/PaymentService";
import { RandomUtil } from "@spt-aki/utils/RandomUtil";

@injectable()
export class RepairService {
    protected repairConfig: IRepairConfig;
    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("DatabaseServer") protected databaseServer: DatabaseServer,
        @inject("ProfileHelper") protected profileHelper: ProfileHelper,
        @inject("RandomUtil") protected randomUtil: RandomUtil,
        @inject("ItemHelper") protected itemHelper: ItemHelper,
        @inject("TraderHelper") protected traderHelper: TraderHelper,
        @inject("WeightedRandomHelper") protected weightedRandomHelper: WeightedRandomHelper,
        @inject("PaymentService") protected paymentService: PaymentService,
        @inject("RepairHelper") protected repairHelper: RepairHelper,
        @inject("LocalisationService") protected localisationService: LocalisationService,
        @inject("ConfigServer") protected configServer: ConfigServer
    ) {
        this.repairConfig = this.configServer.getConfig(ConfigTypes.REPAIR);
    }

    /**
     * Use trader to repair an items durability
     * @param sessionID Session id
     * @param pmcData profile to find item to repair in
     * @param repairItemDetails details of the item to repair
     * @param traderId Trader being used to repair item
     * @returns RepairDetails object
     */
    public repairItemByTrader(
        sessionID: string,
        pmcData: IPmcData,
        repairItemDetails: RepairItem,
        traderId: string
    ): RepairDetails {
        const itemToRepair = pmcData.Inventory.items.find((x) => x._id === repairItemDetails._id);
        if (itemToRepair === undefined) {
            throw new Error(`Item ${repairItemDetails._id} not found in profile inventory, unable to repair`);
        }

        const priceCoef = this.traderHelper.getLoyaltyLevel(traderId, pmcData).repair_price_coef;
        const traderRepairDetails = this.traderHelper.getTrader(traderId, sessionID).repair;
        const repairQualityMultiplier = traderRepairDetails.quality;
        const repairRate = priceCoef <= 0 ? 1 : priceCoef / 100 + 1;

        const itemToRepairDetails = this.databaseServer.getTables().templates.items[itemToRepair._tpl];
        const repairItemIsArmor = !!itemToRepairDetails._props.ArmorMaterial;

        this.repairHelper.updateItemDurability(
            itemToRepair,
            itemToRepairDetails,
            repairItemIsArmor,
            repairItemDetails.count,
            false,
            repairQualityMultiplier,
            repairQualityMultiplier !== 0 && this.repairConfig.applyRandomizeDurabilityLoss
        );

        // get repair price
        const itemRepairCost = this.databaseServer.getTables().templates.items[itemToRepair._tpl]._props.RepairCost;
        const repairCost = Math.round(
            itemRepairCost * repairItemDetails.count * repairRate * this.repairConfig.priceMultiplier
        );

        this.logger.debug(`item base repair cost: ${itemRepairCost}`, true);
        this.logger.debug(`price multipler: ${this.repairConfig.priceMultiplier}`, true);
        this.logger.debug(`repair cost: ${repairCost}`, true);

        return {
            repairCost: repairCost,
            repairedItem: itemToRepair,
            repairedItemIsArmor: repairItemIsArmor,
            repairAmount: repairItemDetails.count,
            repairedByKit: false,
        };
    }

    /**
     *
     * @param sessionID Session id
     * @param pmcData profile to take money from
     * @param repairedItemId Repaired item id
     * @param repairCost Cost to repair item in roubles
     * @param traderId Id of the trader who repaired the item / who is paid
     * @param output
     */
    public payForRepair(
        sessionID: string,
        pmcData: IPmcData,
        repairedItemId: string,
        repairCost: number,
        traderId: string,
        output: IItemEventRouterResponse
    ): void {
        const options: IProcessBuyTradeRequestData = {
            scheme_items: [
                {
                    id: repairedItemId,
                    count: Math.round(repairCost),
                },
            ],
            tid: traderId,
            Action: "",
            type: "",
            item_id: "",
            count: 0,
            scheme_id: 0,
        };

        this.paymentService.payMoney(pmcData, options, sessionID, output);
    }

    /**
     * Add skill points to profile after repairing an item
     * @param sessionId Session id
     * @param repairDetails details of item repaired, cost/item
     * @param pmcData Profile to add points to
     */
    public addRepairSkillPoints(sessionId: string, repairDetails: RepairDetails, pmcData: IPmcData): void {
        if (
            repairDetails.repairedByKit &&
            this.itemHelper.isOfBaseclass(repairDetails.repairedItem._tpl, BaseClasses.WEAPON)
        ) {
            const skillPoints = this.getWeaponRepairSkillPoints(repairDetails);

            this.profileHelper.addSkillPointsToPlayer(pmcData, SkillTypes.WEAPON_TREATMENT, skillPoints, true);
        }

        // Handle kit repairs of armor
        if (
            repairDetails.repairedByKit &&
            this.itemHelper.isOfBaseclasses(repairDetails.repairedItem._tpl, [BaseClasses.ARMOR, BaseClasses.VEST])
        ) {
            const itemDetails = this.itemHelper.getItem(repairDetails.repairedItem._tpl);
            if (!itemDetails[0]) {
                // No item found
                this.logger.error(
                    this.localisationService.getText(
                        "repair-unable_to_find_item_in_db",
                        repairDetails.repairedItem._tpl
                    )
                );

                return;
            }

            const isHeavyArmor = itemDetails[1]._props.ArmorType === "Heavy";
            const vestSkillToLevel = isHeavyArmor ? SkillTypes.HEAVY_VESTS : SkillTypes.LIGHT_VESTS;
            const pointsToAddToVestSkill =
                repairDetails.repairPoints * this.repairConfig.armorKitSkillPointGainPerRepairPointMultiplier;

            this.profileHelper.addSkillPointsToPlayer(pmcData, vestSkillToLevel, pointsToAddToVestSkill);
        }

        // Handle giving INT to player - differs if using kit/trader and weapon vs armor
        let intellectGainedFromRepair: number;
        if (repairDetails.repairedByKit) {
            const intRepairMultiplier = this.itemHelper.isOfBaseclass(
                repairDetails.repairedItem._tpl,
                BaseClasses.WEAPON
            )
                ? this.repairConfig.repairKitIntellectGainMultiplier.weapon
                : this.repairConfig.repairKitIntellectGainMultiplier.armor;

            // limit gain to a max value defined in config.maxIntellectGainPerRepair
            intellectGainedFromRepair = Math.min(
                repairDetails.repairPoints * intRepairMultiplier,
                this.repairConfig.maxIntellectGainPerRepair.kit
            );
        } else {
            // Trader repair - Not as accurate as kit, needs data from live
            intellectGainedFromRepair = Math.min(
                repairDetails.repairAmount / 10,
                this.repairConfig.maxIntellectGainPerRepair.trader
            );
        }

        this.profileHelper.addSkillPointsToPlayer(pmcData, SkillTypes.INTELLECT, intellectGainedFromRepair);
    }

    /**
     * Return an appromixation of the amount of skill points live would return for the given repairDetails
     * @param repairDetails the repair details to calculate skill points for
     * @returns the number of skill points to reward the user
     */
    protected getWeaponRepairSkillPoints(repairDetails: RepairDetails): number {
        // This formula and associated configs is calculated based on 30 repairs done on live
        // The points always came out 2-aligned, which is why there's a divide/multiply by 2 with ceil calls
        const gainMult = this.repairConfig.weaponTreatment.pointGainMultiplier;

        // First we get a baseline based on our repair amount, and gain multiplier with a bit of rounding
        const step1 = Math.ceil(repairDetails.repairAmount / 2) * gainMult;

        // Then we have to get the next even number
        const step2 = Math.ceil(step1 / 2) * 2;

        // Then multiply by 2 again to hopefully get to what live would give us
        let skillPoints = step2 * 2;

        // You can both crit fail and succeed at the same time, for fun (Balances out to 0 with default settings)
        // Add a random chance to crit-fail
        if (Math.random() <= this.repairConfig.weaponTreatment.critFailureChance) {
            skillPoints -= this.repairConfig.weaponTreatment.critFailureAmount;
        }

        // Add a random chance to crit-succeed
        if (Math.random() <= this.repairConfig.weaponTreatment.critSuccessChance) {
            skillPoints += this.repairConfig.weaponTreatment.critSuccessAmount;
        }

        return skillPoints;
    }

    /**
     *
     * @param sessionId Session id
     * @param pmcData Profile to update repaired item in
     * @param repairKits Array of Repair kits to use
     * @param itemToRepairId Item id to repair
     * @param output IItemEventRouterResponse
     * @returns Details of repair, item/price
     */
    public repairItemByKit(
        sessionId: string,
        pmcData: IPmcData,
        repairKits: RepairKitsInfo[],
        itemToRepairId: string,
        output: IItemEventRouterResponse
    ): RepairDetails {
        // Find item to repair in inventory
        const itemToRepair = pmcData.Inventory.items.find((x: { _id: string }) => x._id === itemToRepairId);
        if (itemToRepair === undefined) {
            throw new Error(`Item ${itemToRepairId} not found, unable to repair`);
        }

        const itemsDb = this.databaseServer.getTables().templates.items;
        const itemToRepairDetails = itemsDb[itemToRepair._tpl];
        const repairItemIsArmor = !!itemToRepairDetails._props.ArmorMaterial;
        const repairAmount = repairKits[0].count / this.getKitDivisor(itemToRepairDetails, repairItemIsArmor, pmcData);
        const shouldApplyDurabilityLoss = this.shouldRepairKitApplyDurabilityLoss(
            pmcData,
            this.repairConfig.applyRandomizeDurabilityLoss
        );

        this.repairHelper.updateItemDurability(
            itemToRepair,
            itemToRepairDetails,
            repairItemIsArmor,
            repairAmount,
            true,
            1,
            shouldApplyDurabilityLoss
        );

        // Find and use repair kit defined in body
        for (const repairKit of repairKits) {
            const repairKitInInventory = pmcData.Inventory.items.find((x) => x._id === repairKit._id);
            const repairKitDetails = itemsDb[repairKitInInventory._tpl];
            const repairKitReductionAmount = repairKit.count;

            this.addMaxResourceToKitIfMissing(repairKitDetails, repairKitInInventory);

            // reduce usages on repairkit used
            repairKitInInventory.upd.RepairKit.Resource -= repairKitReductionAmount;

            output.profileChanges[sessionId].items.change.push(repairKitInInventory);
        }

        return {
            repairPoints: repairKits[0].count,
            repairedItem: itemToRepair,
            repairedItemIsArmor: repairItemIsArmor,
            repairAmount: repairAmount,
            repairedByKit: true,
        };
    }

    /**
     * Calculate value repairkit points need to be divided by to get the durability points to be added to an item
     * @param itemToRepairDetails Item to repair details
     * @param isArmor Is the item being repaired armor
     * @param pmcData Player profile
     * @returns Number to divide kit points by
     */
    protected getKitDivisor(itemToRepairDetails: ITemplateItem, isArmor: boolean, pmcData: IPmcData): number {
        const globals = this.databaseServer.getTables().globals;
        const globalRepairSettings = globals.config.RepairSettings;

        const intellectRepairPointsPerLevel = globals.config.SkillsSettings.Intellect.RepairPointsCostReduction;
        const profileIntellectLevel =
            this.profileHelper.getSkillFromProfile(pmcData, SkillTypes.INTELLECT)?.Progress ?? 0;
        const intellectPointReduction = intellectRepairPointsPerLevel * Math.trunc(profileIntellectLevel / 100);

        if (isArmor) {
            const durabilityPointCostArmor = globalRepairSettings.durabilityPointCostArmor;
            const repairArmorBonus = this.getBonusMultiplierValue("RepairArmorBonus", pmcData);
            const armorBonus = 1.0 - (repairArmorBonus - 1.0) - intellectPointReduction;
            const materialType = itemToRepairDetails._props.ArmorMaterial ?? "";
            const armorMaterial = globals.config.ArmorMaterials[materialType] as IArmorType;
            const destructability = 1 + armorMaterial.Destructibility;
            const armorClass = parseInt(`${itemToRepairDetails._props.armorClass}`);
            const armorClassDivisor = globals.config.RepairSettings.armorClassDivisor;
            const armorClassMultiplier = 1.0 + armorClass / armorClassDivisor;

            return durabilityPointCostArmor * armorBonus * destructability * armorClassMultiplier;
        } else {
            const repairWeaponBonus = this.getBonusMultiplierValue("RepairWeaponBonus", pmcData) - 1;
            const repairPointMultiplier = 1.0 - repairWeaponBonus - intellectPointReduction;
            const durabilityPointCostGuns = globals.config.RepairSettings.durabilityPointCostGuns;

            return durabilityPointCostGuns * repairPointMultiplier;
        }
    }

    /**
     * Get the bonus multiplier for a skill from a player profile
     * @param skillBonusName Name of bonus to get multipler of
     * @param pmcData Player profile to look in for skill
     * @returns Multiplier value
     */
    protected getBonusMultiplierValue(skillBonusName: string, pmcData: IPmcData): number {
        const bonusesMatched = pmcData?.Bonuses?.filter((b) => b.type === skillBonusName);
        let value = 1;
        if (bonusesMatched != null) {
            const sumedPercentage = bonusesMatched.map((b) => b.value).reduce((v1, v2) => v1 + v2, 0);
            value = 1 + sumedPercentage / 100;
        }

        return value;
    }

    /**
     * Should a repair kit apply total durability loss on repair
     * @param pmcData Player profile
     * @param applyRandomizeDurabilityLoss Value from repair config
     * @returns True if loss should be applied
     */
    protected shouldRepairKitApplyDurabilityLoss(pmcData: IPmcData, applyRandomizeDurabilityLoss: boolean): boolean {
        let shouldApplyDurabilityLoss = applyRandomizeDurabilityLoss;
        if (shouldApplyDurabilityLoss) {
            // Random loss not disabled via config, perform charisma check
            const hasEliteCharisma = this.profileHelper.hasEliteSkillLevel(SkillTypes.CHARISMA, pmcData);
            if (hasEliteCharisma) {
                // 50/50 chance of loss being ignored at elite level
                shouldApplyDurabilityLoss = this.randomUtil.getChance100(50);
            }
        }

        return shouldApplyDurabilityLoss;
    }

    /**
     * Update repair kits Resource object if it doesn't exist
     * @param repairKitDetails Repair kit details from db
     * @param repairKitInInventory Repair kit to update
     */
    protected addMaxResourceToKitIfMissing(repairKitDetails: ITemplateItem, repairKitInInventory: Item): void {
        const maxRepairAmount = repairKitDetails._props.MaxRepairResource;
        if (!repairKitInInventory.upd) {
            this.logger.debug(`Repair kit: ${repairKitInInventory._id} in inventory lacks upd object, adding`);
            repairKitInInventory.upd = {
                RepairKit: {
                    Resource: maxRepairAmount,
                },
            };
        }
        if (!repairKitInInventory.upd.RepairKit?.Resource) {
            repairKitInInventory.upd.RepairKit = {
                Resource: maxRepairAmount,
            };
        }
    }

    /**
     * Chance to apply buff to an item (Armor/weapon) if repaired by armor kit
     * @param repairDetails Repair details of item
     * @param pmcData Player profile
     */
    public addBuffToItem(repairDetails: RepairDetails, pmcData: IPmcData): void {
        // Buffs are repair kit only
        if (!repairDetails.repairedByKit) {
            return;
        }

        if (this.shouldBuffItem(repairDetails, pmcData)) {
            if (
                this.itemHelper.isOfBaseclasses(repairDetails.repairedItem._tpl, [BaseClasses.ARMOR, BaseClasses.VEST])
            ) {
                const armorConfig = this.repairConfig.repairKit.armor;
                this.addBuff(armorConfig, repairDetails.repairedItem);
            } else if (this.itemHelper.isOfBaseclass(repairDetails.repairedItem._tpl, BaseClasses.WEAPON)) {
                const weaponConfig = this.repairConfig.repairKit.weapon;
                this.addBuff(weaponConfig, repairDetails.repairedItem);
            }
            // TODO: Knife repair kits may be added at some point, a bracket needs to be added here
        }
    }

    /**
     * Add random buff to item
     * @param itemConfig weapon/armor config
     * @param repairDetails Details for item to repair
     */
    public addBuff(itemConfig: BonusSettings, item: Item): void {
        const bonusRarity = this.weightedRandomHelper.getWeightedValue<string>(itemConfig.rarityWeight);
        const bonusType = this.weightedRandomHelper.getWeightedValue<string>(itemConfig.bonusTypeWeight);

        const bonusValues = itemConfig[bonusRarity][bonusType].valuesMinMax;
        const bonusValue = this.randomUtil.getFloat(bonusValues.min, bonusValues.max);

        const bonusThresholdPercents = itemConfig[bonusRarity][bonusType].activeDurabilityPercentMinMax;
        const bonusThresholdPercent = this.randomUtil.getInt(bonusThresholdPercents.min, bonusThresholdPercents.max);

        item.upd.Buff = {
            rarity: bonusRarity,
            buffType: bonusType,
            value: bonusValue,
            thresholdDurability: this.randomUtil.getPercentOfValue(
                bonusThresholdPercent,
                item.upd.Repairable.Durability
            ),
        };
    }

    /**
     * Check if item should be buffed by checking the item type and relevant player skill level
     * @param repairDetails Item that was repaired
     * @param itemTpl tpl of item to be buffed
     * @param pmcData Player profile
     * @returns True if item should have buff applied
     */
    protected shouldBuffItem(repairDetails: RepairDetails, pmcData: IPmcData): boolean {
        const globals = this.databaseServer.getTables().globals;

        const hasTemplate = this.itemHelper.getItem(repairDetails.repairedItem._tpl);
        if (!hasTemplate[0]) return false;
        const template = hasTemplate[1];

        const itemSkillType = this.getItemSkillType(template);
        if (!itemSkillType) {
            return false;
        }

        const commonBuffMinChanceValue =
            globals.config.SkillsSettings[itemSkillType as string].BuffSettings.CommonBuffMinChanceValue;
        const commonBuffChanceLevelBonus =
            globals.config.SkillsSettings[itemSkillType as string].BuffSettings.CommonBuffChanceLevelBonus;
        const receivedDurabilityMaxPercent =
            globals.config.SkillsSettings[itemSkillType as string].BuffSettings.ReceivedDurabilityMaxPercent;

        const skillLevel = Math.trunc(
            (this.profileHelper.getSkillFromProfile(pmcData, itemSkillType)?.Progress ?? 0) / 100
        );

        const durabilityToRestorePercent = repairDetails.repairPoints / template._props.MaxDurability;
        const durabilityMultiplier = this.getDurabilityMultiplier(
            receivedDurabilityMaxPercent,
            durabilityToRestorePercent
        );

        const doBuff = commonBuffMinChanceValue + commonBuffChanceLevelBonus * skillLevel * durabilityMultiplier;

        if (Math.random() <= doBuff) {
            return true;
        }

        return false;
    }

    /**
     * Based on item, what underlying skill does this item use for buff settings
     * @param itemTemplate Item to check for skill
     * @returns Skill name
     */
    protected getItemSkillType(itemTemplate: ITemplateItem): SkillTypes {
        if (this.itemHelper.isOfBaseclass(itemTemplate._id, BaseClasses.ARMOR)) {
            if (itemTemplate._props.ArmorType === "Light") {
                return SkillTypes.LIGHT_VESTS;
            } else if (itemTemplate._props.ArmorType === "Heavy") {
                return SkillTypes.HEAVY_VESTS;
            }
        } else if (this.itemHelper.isOfBaseclass(itemTemplate._id, BaseClasses.WEAPON)) {
            return SkillTypes.WEAPON_TREATMENT;
        } else if (this.itemHelper.isOfBaseclass(itemTemplate._id, BaseClasses.KNIFE)) {
            return SkillTypes.MELEE;
        }

        return undefined;
    }

    /**
     * Ensure multiplier is between 1 and 0.01
     * @param receiveDurabilityMaxPercent Max durabiltiy percent
     * @param receiveDurabilityPercent current durability percent
     * @returns durability multipler value
     */
    protected getDurabilityMultiplier(receiveDurabilityMaxPercent: number, receiveDurabilityPercent: number): number {
        receiveDurabilityMaxPercent = receiveDurabilityMaxPercent > 0 ? receiveDurabilityMaxPercent : 0.01;
        const num = receiveDurabilityPercent / receiveDurabilityMaxPercent;
        if (num > 1) {
            return 1.0;
        }
        if (num < 0.01) {
            return 0.01;
        }

        return num;
    }
}

export class RepairDetails {
    repairCost?: number;
    repairPoints?: number;
    repairedItem: Item;
    repairedItemIsArmor: boolean;
    repairAmount: number;
    repairedByKit: boolean;
}
