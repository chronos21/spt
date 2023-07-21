import { inject, injectable } from "tsyringe";

import { Item } from "../models/eft/common/tables/IItem";
import { Dialogue, Message, MessageContent, MessageItems, MessagePreview } from "../models/eft/profile/IAkiProfile";
import { MessageType } from "../models/enums/MessageType";
import { Traders } from "../models/enums/Traders";
import { ILogger } from "../models/spt/utils/ILogger";
import { DatabaseServer } from "../servers/DatabaseServer";
import { SaveServer } from "../servers/SaveServer";
import { LocalisationService } from "../services/LocalisationService";
import { HashUtil } from "../utils/HashUtil";
import { TimeUtil } from "../utils/TimeUtil";
import { ItemHelper } from "./ItemHelper";
import { NotificationSendHelper } from "./NotificationSendHelper";
import { NotifierHelper } from "./NotifierHelper";

export interface ISendMessageDetails
{
    /** Player id */
    recipientId: string
    /** Who is sending this message */
    sender: MessageType
    /** Optional - if sender is USER, property must be supplied */
    senderId?: string
    trader: Traders
    /** Optinal - Items to send to player */
    items?: Item[]
    /** Optional - How long items will be stored in mail before expiry */
    itemsMaxStorageLifetimeSeconds?: number
}

@injectable()
export class DialogueHelper
{
    protected readonly systemSenderId = "59e7125688a45068a6249071";

    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("HashUtil") protected hashUtil: HashUtil,
        @inject("SaveServer") protected saveServer: SaveServer,
        @inject("DatabaseServer") protected databaseServer: DatabaseServer,
        @inject("NotifierHelper") protected notifierHelper: NotifierHelper,
        @inject("NotificationSendHelper") protected notificationSendHelper: NotificationSendHelper,
        @inject("LocalisationService") protected localisationService: LocalisationService,
        @inject("ItemHelper") protected itemHelper: ItemHelper
    )
    { }

    public sendMessageToPlayer(messageDetails: ISendMessageDetails ): void
    {
        // Get dialog, create if doesn't exist
        const senderDialog = this.getDialog(messageDetails);

        // craft message
        // push message to dialog messages array
    }

    protected getDialog(messageDetails: ISendMessageDetails): Dialogue
    {
        // Does dialog exist
        const dialogsInProfile = this.saveServer.getProfile(messageDetails.recipientId).dialogues;
        const senderDialog = dialogsInProfile[messageDetails.sender];

        const senderId = this.getMessageSenderIdByType(messageDetails);
        if (!senderDialog)
        {
            // Create if doesnt
            dialogsInProfile[messageDetails.sender] = {
                _id: senderId,
                type: messageDetails.sender,
                messages: [],
                pinned: false,
                new: 0,
                attachmentsNew: 0
            };

        }

        return dialogsInProfile[messageDetails.sender];
    }

    protected getMessageSenderIdByType(messageDetails: ISendMessageDetails): string
    {
        if (messageDetails.sender === MessageType.SYSTEM_MESSAGE)
        {
            return this.systemSenderId;
        }

        if (messageDetails.sender === MessageType.NPC_TRADER)
        {
            return messageDetails.trader;
        }

        if (messageDetails.sender === MessageType.USER_MESSAGE)
        {
            return messageDetails.senderId;
        }
    }

    /**
     * Create basic message context template
     * @param templateId optional
     * @param messageType Who sent the message
     * @param maxStoreTime How long message items are stored
     * @returns 
     */
    public createMessageContext(templateId: string, messageType: MessageType, maxStoreTime = null): MessageContent
    {
        const result: MessageContent = {
            templateId: templateId,
            type: messageType
        };

        if (maxStoreTime)
        {
            result.maxStorageTime = maxStoreTime * TimeUtil.oneHourAsSeconds;
        }

        return result;
    }

    /**
     * Add a templated message to the dialogue.
     * @param dialogueID 
     * @param messageContent 
     * @param sessionID 
     * @param rewards 
     */
    public addDialogueMessage(dialogueID: string, messageContent: MessageContent, sessionID: string, rewards: Item[] = [], messageType = MessageType.NPC_TRADER): void
    {
        const dialogueData = this.saveServer.getProfile(sessionID).dialogues;
        const isNewDialogue = !(dialogueID in dialogueData);
        let dialogue: Dialogue = dialogueData[dialogueID];

        if (isNewDialogue)
        {
            dialogue = {
                _id: dialogueID,
                type: messageType,
                messages: [],
                pinned: false,
                new: 0,
                attachmentsNew: 0
            };

            dialogueData[dialogueID] = dialogue;
        }

        dialogue.new += 1;

        // Generate item stash if we have rewards.
        let items: MessageItems = {};

        if (rewards.length > 0)
        {
            const stashId = rewards[0].parentId;
            items = {
                stash: stashId,
                data: []
            };

            rewards = this.itemHelper.replaceIDs(null, rewards);
            for (const reward of rewards)
            {
                if (!("slotId" in reward) || reward.slotId === "hideout")
                {
                    reward.parentId = stashId;
                    reward.slotId = "main";
                }

                const itemTemplate = this.databaseServer.getTables().templates.items[reward._tpl];
                if (!itemTemplate)
                {
                    // Can happen when modded items are insured + mod is removed
                    this.logger.error(this.localisationService.getText("dialog-missing_item_template", {tpl: reward._tpl, type: MessageType[messageContent.type]}));

                    continue;
                }

                items.data.push(reward);

                if ("StackSlots" in itemTemplate._props)
                {
                    const stackSlotItems = this.itemHelper.generateItemsFromStackSlot(itemTemplate, reward._id);
                    for (const itemToAdd of stackSlotItems)
                    {
                        items.data.push(itemToAdd);
                    }
                }
            }

            if (items.data.length === 0)
            {
                delete items.data;
            }

            dialogue.attachmentsNew += 1;
        }

        const message: Message = {
            _id: this.hashUtil.generate(),
            uid: dialogueID,
            type: messageContent.type,
            dt: Math.round(Date.now() / 1000),
            text: messageContent.text ?? "",
            templateId: messageContent.templateId,
            hasRewards: items.data?.length > 0,
            rewardCollected: false,
            items: items,
            maxStorageTime: messageContent.maxStorageTime,
            systemData: messageContent.systemData ? messageContent.systemData : undefined,
            profileChangeEvents: (messageContent.profileChangeEvents?.length === 0) ? messageContent.profileChangeEvents : undefined
        };

        if (!message.templateId)
        {
            delete message.templateId;
        }

        dialogue.messages.push(message);

        // Offer Sold notifications are now separate from the main notification
        if (messageContent.type === MessageType.FLEAMARKET_MESSAGE && messageContent.ragfair)
        {
            const offerSoldMessage = this.notifierHelper.createRagfairOfferSoldNotification(message, messageContent.ragfair);
            this.notificationSendHelper.sendMessage(sessionID, offerSoldMessage);
            message.type = MessageType.MESSAGE_WITH_ITEMS; // Should prevent getting the same notification popup twice
        }

        const notificationMessage = this.notifierHelper.createNewMessageNotification(message);
        this.notificationSendHelper.sendMessage(sessionID, notificationMessage);
    }

    /**
     * Get the preview contents of the last message in a dialogue.
     * @param dialogue 
     * @returns MessagePreview
     */
    public getMessagePreview(dialogue: Dialogue): MessagePreview
    {
        // The last message of the dialogue should be shown on the preview.
        const message = dialogue.messages[dialogue.messages.length - 1];
        const result: MessagePreview = {
            dt: message?.dt,
            type: message?.type,
            templateId: message?.templateId,
            uid: dialogue._id
        };

        if (message?.text)
        {
            result.text = message.text;
        }

        if (message?.systemData)
        {
            result.systemData = message.systemData;
        }

        return result;
    }

    /**
     * Get the item contents for a particular message.
     * @param messageID 
     * @param sessionID 
     * @param itemId Item being moved to inventory
     * @returns 
     */
    public getMessageItemContents(messageID: string, sessionID: string, itemId: string): Item[]
    {
        const dialogueData = this.saveServer.getProfile(sessionID).dialogues;
        for (const dialogueId in dialogueData)
        {
            const message = dialogueData[dialogueId].messages.find(x => x._id === messageID);
            if (!message)
            {
                continue;
            }

            if (message._id === messageID)
            {
                const attachmentsNew = this.saveServer.getProfile(sessionID).dialogues[dialogueId].attachmentsNew;
                if (attachmentsNew > 0)
                {
                    this.saveServer.getProfile(sessionID).dialogues[dialogueId].attachmentsNew = attachmentsNew - 1;
                }

                // Check reward count when item being moved isn't in reward list
                // if count is 0, it means after this move the reward array will be empty and all rewards collected
                const rewardItemCount = message.items.data.filter(x => x._id !== itemId );
                if (rewardItemCount.length === 0)
                {
                    message.rewardCollected = true;
                }

                return message.items.data;
            }
        }

        return [];
    }
}