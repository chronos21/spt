import { inject, injectable } from "tsyringe";

import { BotWeaponGenerator } from "@spt-aki/generators/BotWeaponGenerator";
import { BotGeneratorHelper } from "@spt-aki/helpers/BotGeneratorHelper";
import { BotHelper } from "@spt-aki/helpers/BotHelper";
import { HandbookHelper } from "@spt-aki/helpers/HandbookHelper";
import { InventoryHelper } from "@spt-aki/helpers/InventoryHelper";
import { ItemHelper } from "@spt-aki/helpers/ItemHelper";
import { WeightedRandomHelper } from "@spt-aki/helpers/WeightedRandomHelper";
import { Inventory as PmcInventory } from "@spt-aki/models/eft/common/tables/IBotBase";
import { IBotType, Inventory, ModsChances } from "@spt-aki/models/eft/common/tables/IBotType";
import { Item } from "@spt-aki/models/eft/common/tables/IItem";
import { ITemplateItem } from "@spt-aki/models/eft/common/tables/ITemplateItem";
import { BaseClasses } from "@spt-aki/models/enums/BaseClasses";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { EquipmentSlots } from "@spt-aki/models/enums/EquipmentSlots";
import { ItemAddedResult } from "@spt-aki/models/enums/ItemAddedResult";
import { LootCacheType } from "@spt-aki/models/spt/bots/IBotLootCache";
import { IItemSpawnLimitSettings } from "@spt-aki/models/spt/bots/IItemSpawnLimitSettings";
import { IBotConfig } from "@spt-aki/models/spt/config/IBotConfig";
import { IPmcConfig } from "@spt-aki/models/spt/config/IPmcConfig";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { BotLootCacheService } from "@spt-aki/services/BotLootCacheService";
import { LocalisationService } from "@spt-aki/services/LocalisationService";
import { HashUtil } from "@spt-aki/utils/HashUtil";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { RandomUtil } from "@spt-aki/utils/RandomUtil";

@injectable()
export class BotLootGenerator
{
    protected botConfig: IBotConfig;
    protected pmcConfig: IPmcConfig;

    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("HashUtil") protected hashUtil: HashUtil,
        @inject("RandomUtil") protected randomUtil: RandomUtil,
        @inject("ItemHelper") protected itemHelper: ItemHelper,
        @inject("JsonUtil") protected jsonUtil: JsonUtil,
        @inject("InventoryHelper") protected inventoryHelper: InventoryHelper,
        @inject("DatabaseServer") protected databaseServer: DatabaseServer,
        @inject("HandbookHelper") protected handbookHelper: HandbookHelper,
        @inject("BotGeneratorHelper") protected botGeneratorHelper: BotGeneratorHelper,
        @inject("BotWeaponGenerator") protected botWeaponGenerator: BotWeaponGenerator,
        @inject("WeightedRandomHelper") protected weightedRandomHelper: WeightedRandomHelper,
        @inject("BotHelper") protected botHelper: BotHelper,
        @inject("BotLootCacheService") protected botLootCacheService: BotLootCacheService,
        @inject("LocalisationService") protected localisationService: LocalisationService,
        @inject("ConfigServer") protected configServer: ConfigServer,
    )
    {
        this.botConfig = this.configServer.getConfig(ConfigTypes.BOT);
        this.pmcConfig = this.configServer.getConfig(ConfigTypes.PMC);
    }

    protected getItemSpawnLimitsForBot(botRole: string): IItemSpawnLimitSettings
    {
        // Init item limits
        const limitsForBotDict: Record<string, number> = {};
        this.initItemLimitArray(botRole, limitsForBotDict);

        return { currentLimits: limitsForBotDict, globalLimits: this.getItemSpawnLimitsForBotType(botRole) };
    }

    /**
     * Add loot to bots containers
     * @param sessionId Session id
     * @param botJsonTemplate Base json db file for the bot having its loot generated
     * @param isPmc Will bot be a pmc
     * @param botRole Role of bot, e.g. asssult
     * @param botInventory Inventory to add loot to
     * @param botLevel Level of bot
     */
    public generateLoot(
        sessionId: string,
        botJsonTemplate: IBotType,
        isPmc: boolean,
        botRole: string,
        botInventory: PmcInventory,
        botLevel: number,
    ): void
    {
        // Limits on item types to be added as loot
        const itemCounts = botJsonTemplate.generation.items;

        const backpackLootCount = Number(
            this.weightedRandomHelper.getWeightedValue<number>(itemCounts.backpackLoot.weights),
        );
        const pocketLootCount = Number(
            this.weightedRandomHelper.getWeightedValue<number>(itemCounts.pocketLoot.weights),
        );
        const vestLootCount = this.weightedRandomHelper.getWeightedValue<number>(itemCounts.vestLoot.weights);
        const specialLootItemCount = Number(
            this.weightedRandomHelper.getWeightedValue<number>(itemCounts.specialItems.weights),
        );
        const healingItemCount = Number(this.weightedRandomHelper.getWeightedValue<number>(itemCounts.healing.weights));
        const drugItemCount = Number(this.weightedRandomHelper.getWeightedValue<number>(itemCounts.drugs.weights));
        const stimItemCount = Number(this.weightedRandomHelper.getWeightedValue<number>(itemCounts.stims.weights));
        const grenadeCount = Number(this.weightedRandomHelper.getWeightedValue<number>(itemCounts.grenades.weights));

        // Forced pmc healing loot
        if (isPmc && this.pmcConfig.forceHealingItemsIntoSecure)
        {
            this.addForcedMedicalItemsToPmcSecure(botInventory, botRole);
        }

        const botItemLimits = this.getItemSpawnLimitsForBot(botRole);

        const containersBotHasAvailable = this.getAvailableContainersBotCanStoreItemsIn(botInventory);

        // Special items
        this.addLootFromPool(
            this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.SPECIAL, botJsonTemplate),
            containersBotHasAvailable,
            specialLootItemCount,
            botInventory,
            botRole,
            botItemLimits,
        );

        // Healing items / Meds
        this.addLootFromPool(
            this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.HEALING_ITEMS, botJsonTemplate),
            containersBotHasAvailable,
            healingItemCount,
            botInventory,
            botRole,
            null,
            0,
            isPmc,
        );

        // Drugs
        this.addLootFromPool(
            this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.DRUG_ITEMS, botJsonTemplate),
            containersBotHasAvailable,
            drugItemCount,
            botInventory,
            botRole,
            null,
            0,
            isPmc,
        );

        // Stims
        this.addLootFromPool(
            this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.STIM_ITEMS, botJsonTemplate),
            containersBotHasAvailable,
            stimItemCount,
            botInventory,
            botRole,
            botItemLimits,
            0,
            isPmc,
        );

        // Grenades
        this.addLootFromPool(
            this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.GRENADE_ITEMS, botJsonTemplate),
            [EquipmentSlots.POCKETS, EquipmentSlots.TACTICAL_VEST], // Can't use containersBotHasEquipped as we dont want grenades added to backpack
            grenadeCount,
            botInventory,
            botRole,
            null,
            0,
            isPmc,
        );

        // Backpack - generate loot if they have one
        if (containersBotHasAvailable.includes(EquipmentSlots.BACKPACK))
        {
            // Add randomly generated weapon to PMC backpacks
            if (isPmc && this.randomUtil.getChance100(this.pmcConfig.looseWeaponInBackpackChancePercent))
            {
                this.addLooseWeaponsToInventorySlot(
                    sessionId,
                    botInventory,
                    EquipmentSlots.BACKPACK,
                    botJsonTemplate.inventory,
                    botJsonTemplate.chances.weaponMods,
                    botRole,
                    isPmc,
                    botLevel,
                );
            }

            this.addLootFromPool(
                this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.BACKPACK, botJsonTemplate),
                [EquipmentSlots.BACKPACK],
                backpackLootCount,
                botInventory,
                botRole,
                botItemLimits,
                this.pmcConfig.maxBackpackLootTotalRub,
                isPmc,
            );
        }

        // TacticalVest - generate loot if they have one
        if (containersBotHasAvailable.includes(EquipmentSlots.TACTICAL_VEST))
        {
            // Vest
            this.addLootFromPool(
                this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.VEST, botJsonTemplate),
                [EquipmentSlots.TACTICAL_VEST],
                vestLootCount,
                botInventory,
                botRole,
                botItemLimits,
                this.pmcConfig.maxVestLootTotalRub,
                isPmc,
            );
        }

        // Pockets
        this.addLootFromPool(
            this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.POCKET, botJsonTemplate),
            [EquipmentSlots.POCKETS],
            pocketLootCount,
            botInventory,
            botRole,
            botItemLimits,
            this.pmcConfig.maxPocketLootTotalRub,
            isPmc,
        );

        // Secure
        this.addLootFromPool(
            this.botLootCacheService.getLootFromCache(botRole, isPmc, LootCacheType.SECURE, botJsonTemplate),
            [EquipmentSlots.SECURED_CONTAINER],
            50,
            botInventory,
            botRole,
            null,
            -1,
            isPmc,
        );
    }

    /**
     * Get an array of the containers a bot has on them (pockets/backpack/vest)
     * @param botInventory Bot to check
     * @returns Array of available slots
     */
    protected getAvailableContainersBotCanStoreItemsIn(botInventory: PmcInventory): EquipmentSlots[]
    {
        const result = [EquipmentSlots.POCKETS];

        if (botInventory.items.find((item) => item.slotId === EquipmentSlots.TACTICAL_VEST))
        {
            result.push(EquipmentSlots.TACTICAL_VEST);
        }

        if (botInventory.items.find((item) => item.slotId === EquipmentSlots.BACKPACK))
        {
            result.push(EquipmentSlots.BACKPACK);
        }

        return result;
    }

    /**
     * Force healing items onto bot to ensure they can heal in-raid
     * @param botInventory Inventory to add items to
     * @param botRole Role of bot (sptBear/sptUsec)
     */
    protected addForcedMedicalItemsToPmcSecure(botInventory: PmcInventory, botRole: string): void
    {
        // Grizzly
        this.addLootFromPool(
            // eslint-disable-next-line @typescript-eslint/naming-convention
            { "590c657e86f77412b013051d": 1 },
            [EquipmentSlots.SECURED_CONTAINER],
            1,
            botInventory,
            botRole,
            null,
            0,
            true,
        );

        // surv12
        this.addLootFromPool(
            // eslint-disable-next-line @typescript-eslint/naming-convention
            { "5d02797c86f774203f38e30a": 1 },
            [EquipmentSlots.SECURED_CONTAINER],
            1,
            botInventory,
            botRole,
            null,
            0,
            true,
        );

        // Morphine
        this.addLootFromPool(
            // eslint-disable-next-line @typescript-eslint/naming-convention
            { "544fb3f34bdc2d03748b456a": 1 },
            [EquipmentSlots.SECURED_CONTAINER],
            2,
            botInventory,
            botRole,
            null,
            0,
            true,
        );

        // AFAK
        this.addLootFromPool(
            // eslint-disable-next-line @typescript-eslint/naming-convention
            { "60098ad7c2240c0fe85c570a": 1 },
            [EquipmentSlots.SECURED_CONTAINER],
            2,
            botInventory,
            botRole,
            null,
            0,
            true,
        );
    }

    /**
     * Get a biased random number
     * @param min Smallest size
     * @param max Biggest size
     * @param nValue Value to bias choice
     * @returns Chosen number
     */
    protected getRandomisedCount(min: number, max: number, nValue: number): number
    {
        const range = max - min;
        return this.randomUtil.getBiasedRandomNumber(min, max, range, nValue);
    }

    /**
     * Take random items from a pool and add to an inventory until totalItemCount or totalValueLimit or space limit is reached
     * @param pool Pool of items to pick from with weight
     * @param equipmentSlots What equipment slot will the loot items be added to
     * @param totalItemCount Max count of items to add
     * @param inventoryToAddItemsTo Bot inventory loot will be added to
     * @param botRole Role of the bot loot is being generated for (assault/pmcbot)
     * @param itemSpawnLimits Item spawn limits the bot must adhere to
     * @param totalValueLimitRub Total value of loot allowed in roubles
     * @param isPmc Is bot being generated for a pmc
     */
    protected addLootFromPool(
        pool: Record<string, number>,
        equipmentSlots: string[],
        totalItemCount: number,
        inventoryToAddItemsTo: PmcInventory,
        botRole: string,
        itemSpawnLimits: IItemSpawnLimitSettings = null,
        totalValueLimitRub = 0,
        isPmc = false,
    ): void
    {
        // Loot pool has items
        const poolSize = Object.keys(pool).length;
        if (poolSize > 0)
        {
            let currentTotalRub = 0;

            let fitItemIntoContainerAttempts = 0;
            for (let i = 0; i < totalItemCount; i++)
            {
                // Pool can become empty if item spawn limits keep removing items
                if (Object.keys(pool).length === 0)
                {
                    return;
                }

                const weightedItemTpl = this.weightedRandomHelper.getWeightedValue<string>(pool);
                const itemResult = this.itemHelper.getItem(weightedItemTpl);
                const itemToAddTemplate = itemResult[1];
                if (!itemResult[0])
                {
                    this.logger.warning(
                        `Unable to process item tpl: ${weightedItemTpl} for slots: ${equipmentSlots} on bot: ${botRole}`,
                    );

                    continue;
                }

                if (itemSpawnLimits)
                {
                    if (this.itemHasReachedSpawnLimit(itemToAddTemplate, botRole, itemSpawnLimits))
                    {
                        // Remove item from pool to prevent it being picked again
                        delete pool[weightedItemTpl];

                        i--;
                        continue;
                    }
                }

                const newRootItemId = this.hashUtil.generate();
                const itemWithChildrenToAdd: Item[] = [{
                    _id: newRootItemId,
                    _tpl: itemToAddTemplate._id,
                    ...this.botGeneratorHelper.generateExtraPropertiesForItem(itemToAddTemplate, botRole),
                }];

                // Is Simple-Wallet
                if (weightedItemTpl === "5783c43d2459774bbe137486")
                {
                    const addCurrency = this.randomUtil.getChance100(25);
                    if (addCurrency)
                    {
                        // Create the currency items we want to add to wallet
                        const itemsToAdd = this.createWalletLoot(newRootItemId);

                        // Get the container grid for the wallet
                        const containerGrid = this.inventoryHelper.getContainerSlotMap(weightedItemTpl);

                        // Check if all the chosen currency items fit into wallet
                        const canAddToContainer = this.inventoryHelper.canPlaceItemsInContainer(
                            this.jsonUtil.clone(containerGrid), // MUST clone grid before passing in as function modifies grid
                            itemsToAdd,
                        );
                        if (canAddToContainer)
                        {
                            // Add each currency to wallet
                            for (const itemToAdd of itemsToAdd)
                            {
                                this.inventoryHelper.placeItemInContainer(
                                    containerGrid,
                                    itemToAdd,
                                    itemWithChildrenToAdd[0]._id,
                                );
                            }

                            itemWithChildrenToAdd.push(...itemsToAdd.flatMap((x) => x));
                        }
                    }
                }

                this.addRequiredChildItemsToParent(itemToAddTemplate, itemWithChildrenToAdd, isPmc);

                // Attempt to add item to container(s)
                const itemAddedResult = this.botGeneratorHelper.addItemWithChildrenToEquipmentSlot(
                    equipmentSlots,
                    newRootItemId,
                    itemToAddTemplate._id,
                    itemWithChildrenToAdd,
                    inventoryToAddItemsTo,
                );

                // Handle when item cannot be added
                if (itemAddedResult !== ItemAddedResult.SUCCESS)
                {
                    if (itemAddedResult === ItemAddedResult.NO_CONTAINERS)
                    {
                        // Bot has no container to put item in, exit
                        this.logger.debug(
                            `Unable to add: ${totalItemCount} items to bot as it lacks a container to include them`,
                        );
                        break;
                    }

                    fitItemIntoContainerAttempts++;
                    if (fitItemIntoContainerAttempts >= 4)
                    {
                        this.logger.debug(
                            `Failed to place item ${i} of ${totalItemCount} items into ${botRole} containers: ${
                                equipmentSlots.join(",")
                            }. Tried ${fitItemIntoContainerAttempts} times, reason: ${
                                ItemAddedResult[itemAddedResult]
                            }, skipping`,
                        );

                        break;
                    }

                    // Try again, failed but still under attempt limit
                    continue;
                }

                // Item added okay, reset counter for next item
                fitItemIntoContainerAttempts = 0;

                // Stop adding items to bots pool if rolling total is over total limit
                if (totalValueLimitRub > 0)
                {
                    currentTotalRub += this.handbookHelper.getTemplatePrice(itemToAddTemplate._id);
                    if (currentTotalRub > totalValueLimitRub)
                    {
                        break;
                    }
                }
            }
        }
    }

    protected createWalletLoot(walletId: string): Item[][]
    {
        const result: Item[][] = [];

        // Choose how many stacks of currency will be added to wallet
        const itemCount = this.randomUtil.getInt(1, this.botConfig.walletLoot.itemCount);
        for (let index = 0; index < itemCount; index++)
        {
            // Choose the size of the currency stack
            const chosenStackCount = Number(
                this.weightedRandomHelper.getWeightedValue<string>(this.botConfig.walletLoot.stackSizeWeight),
            );
            result.push([{
                _id: this.hashUtil.generate(),
                _tpl: "5449016a4bdc2d6f028b456f", // TODO - extend to be more than just roubles
                parentId: walletId,
                upd: { StackObjectsCount: chosenStackCount },
            }]);
        }

        return result;
    }

    /**
     * Some items need child items to function, add them to the itemToAddChildrenTo array
     * @param itemToAddTemplate Db template of item to check
     * @param itemToAddChildrenTo Item to add children to
     * @param isPmc Is the item being generated for a pmc (affects money/ammo stack sizes)
     */
    protected addRequiredChildItemsToParent(
        itemToAddTemplate: ITemplateItem,
        itemToAddChildrenTo: Item[],
        isPmc: boolean,
    ): void
    {
        // Fill ammo box
        if (this.itemHelper.isOfBaseclass(itemToAddTemplate._id, BaseClasses.AMMO_BOX))
        {
            this.itemHelper.addCartridgesToAmmoBox(itemToAddChildrenTo, itemToAddTemplate);
        }
        // Make money a stack
        else if (this.itemHelper.isOfBaseclass(itemToAddTemplate._id, BaseClasses.MONEY))
        {
            this.randomiseMoneyStackSize(isPmc, itemToAddTemplate, itemToAddChildrenTo[0]);
        }
        // Make ammo a stack
        else if (this.itemHelper.isOfBaseclass(itemToAddTemplate._id, BaseClasses.AMMO))
        {
            this.randomiseAmmoStackSize(isPmc, itemToAddTemplate, itemToAddChildrenTo[0]);
        }
        // Must add soft inserts/plates
        else if (this.itemHelper.itemRequiresSoftInserts(itemToAddTemplate._id))
        {
            this.itemHelper.addChildSlotItems(itemToAddChildrenTo, itemToAddTemplate, null, false);
        }
    }

    /**
     * Add generated weapons to inventory as loot
     * @param botInventory inventory to add preset to
     * @param equipmentSlot slot to place the preset in (backpack)
     * @param templateInventory bots template, assault.json
     * @param modChances chances for mods to spawn on weapon
     * @param botRole bots role .e.g. pmcBot
     * @param isPmc are we generating for a pmc
     */
    protected addLooseWeaponsToInventorySlot(
        sessionId: string,
        botInventory: PmcInventory,
        equipmentSlot: string,
        templateInventory: Inventory,
        modChances: ModsChances,
        botRole: string,
        isPmc: boolean,
        botLevel: number,
    ): void
    {
        const chosenWeaponType = this.randomUtil.getArrayValue([
            EquipmentSlots.FIRST_PRIMARY_WEAPON,
            EquipmentSlots.FIRST_PRIMARY_WEAPON,
            EquipmentSlots.FIRST_PRIMARY_WEAPON,
            EquipmentSlots.HOLSTER,
        ]);
        const randomisedWeaponCount = this.randomUtil.getInt(
            this.pmcConfig.looseWeaponInBackpackLootMinMax.min,
            this.pmcConfig.looseWeaponInBackpackLootMinMax.max,
        );
        if (randomisedWeaponCount > 0)
        {
            for (let i = 0; i < randomisedWeaponCount; i++)
            {
                const generatedWeapon = this.botWeaponGenerator.generateRandomWeapon(
                    sessionId,
                    chosenWeaponType,
                    templateInventory,
                    botInventory.equipment,
                    modChances,
                    botRole,
                    isPmc,
                    botLevel,
                );
                const result = this.botGeneratorHelper.addItemWithChildrenToEquipmentSlot(
                    [equipmentSlot],
                    generatedWeapon.weapon[0]._id,
                    generatedWeapon.weapon[0]._tpl,
                    [...generatedWeapon.weapon],
                    botInventory,
                );

                if (result !== ItemAddedResult.SUCCESS)
                {
                    this.logger.debug(
                        `Failed to add additional weapon ${generatedWeapon.weapon[0]._id} to bot backpack, reason: ${
                            ItemAddedResult[result]
                        }`,
                    );
                }
            }
        }
    }

    /**
     * Hydrate item limit array to contain items that have a limit for a specific bot type
     * All values are set to 0
     * @param botRole Role the bot has
     * @param limitCount
     */
    protected initItemLimitArray(botRole: string, limitCount: Record<string, number>): void
    {
        // Init current count of items we want to limit
        const spawnLimits = this.getItemSpawnLimitsForBotType(botRole);
        for (const limit in spawnLimits)
        {
            limitCount[limit] = 0;
        }
    }

    /**
     * Check if an item has reached its bot-specific spawn limit
     * @param itemTemplate Item we check to see if its reached spawn limit
     * @param botRole Bot type
     * @param itemSpawnLimits
     * @returns true if item has reached spawn limit
     */
    protected itemHasReachedSpawnLimit(
        itemTemplate: ITemplateItem,
        botRole: string,
        itemSpawnLimits: IItemSpawnLimitSettings,
    ): boolean
    {
        // PMCs and scavs have different sections of bot config for spawn limits
        if (!!itemSpawnLimits && Object.keys(itemSpawnLimits.globalLimits).length === 0)
        {
            // No items found in spawn limit, drop out
            return false;
        }

        // No spawn limits, skipping
        if (!itemSpawnLimits)
        {
            return false;
        }

        const idToCheckFor = this.getMatchingIdFromSpawnLimits(itemTemplate, itemSpawnLimits.globalLimits);
        if (!idToCheckFor)
        {
            // ParentId or tplid not found in spawnLimits, not a spawn limited item, skip
            return false;
        }

        // Increment item count with this bot type
        itemSpawnLimits.currentLimits[idToCheckFor]++;

        // Check if over limit
        if (itemSpawnLimits.currentLimits[idToCheckFor] > itemSpawnLimits.globalLimits[idToCheckFor])
        {
            // Prevent edge-case of small loot pools + code trying to add limited item over and over infinitely
            if (itemSpawnLimits.currentLimits[idToCheckFor] > itemSpawnLimits[idToCheckFor] * 10)
            {
                this.logger.debug(
                    this.localisationService.getText("bot-item_spawn_limit_reached_skipping_item", {
                        botRole: botRole,
                        itemName: itemTemplate._name,
                        attempts: itemSpawnLimits.currentLimits[idToCheckFor],
                    }),
                );

                return false;
            }

            return true;
        }

        return false;
    }

    /**
     * Randomise the stack size of a money object, uses different values for pmc or scavs
     * @param isPmc Is money on a PMC bot
     * @param itemTemplate item details from db
     * @param moneyItem Money item to randomise
     */
    protected randomiseMoneyStackSize(isPmc: boolean, itemTemplate: ITemplateItem, moneyItem: Item): void
    {
        // PMCs have a different stack max size
        const minStackSize = itemTemplate._props.StackMinRandom;
        const maxStackSize = isPmc
            ? this.pmcConfig.dynamicLoot.moneyStackLimits[itemTemplate._id]
            : itemTemplate._props.StackMaxRandom;
        const randomSize = this.randomUtil.getInt(minStackSize, maxStackSize);

        if (!moneyItem.upd)
        {
            moneyItem.upd = {};
        }

        moneyItem.upd.StackObjectsCount = randomSize;
    }

    /**
     * Randomise the size of an ammo stack
     * @param isPmc Is ammo on a PMC bot
     * @param itemTemplate item details from db
     * @param ammoItem Ammo item to randomise
     */
    protected randomiseAmmoStackSize(isPmc: boolean, itemTemplate: ITemplateItem, ammoItem: Item): void
    {
        const randomSize = itemTemplate._props.StackMaxSize === 1
            ? 1
            : this.randomUtil.getInt(
                itemTemplate._props.StackMinRandom,
                Math.min(itemTemplate._props.StackMaxRandom, 60),
            );

        if (!ammoItem.upd)
        {
            ammoItem.upd = {};
        }

        ammoItem.upd.StackObjectsCount = randomSize;
    }

    /**
     * Get spawn limits for a specific bot type from bot.json config
     * If no limit found for a non pmc bot, fall back to defaults
     * @param botRole what role does the bot have
     * @returns Dictionary of tplIds and limit
     */
    protected getItemSpawnLimitsForBotType(botRole: string): Record<string, number>
    {
        if (this.botHelper.isBotPmc(botRole))
        {
            return this.botConfig.itemSpawnLimits.pmc;
        }

        if (this.botConfig.itemSpawnLimits[botRole.toLowerCase()])
        {
            return this.botConfig.itemSpawnLimits[botRole.toLowerCase()];
        }

        this.logger.warning(
            this.localisationService.getText("bot-unable_to_find_spawn_limits_fallback_to_defaults", botRole),
        );

        return this.botConfig.itemSpawnLimits.default;
    }

    /**
     * Get the parentId or tplId of item inside spawnLimits object if it exists
     * @param itemTemplate item we want to look for in spawn limits
     * @param spawnLimits Limits to check for item
     * @returns id as string, otherwise undefined
     */
    protected getMatchingIdFromSpawnLimits(itemTemplate: ITemplateItem, spawnLimits: Record<string, number>): string
    {
        if (itemTemplate._id in spawnLimits)
        {
            return itemTemplate._id;
        }

        // tplId not found in spawnLimits, check if parentId is
        if (itemTemplate._parent in spawnLimits)
        {
            return itemTemplate._parent;
        }

        // parentId and tplid not found
        return undefined;
    }
}
