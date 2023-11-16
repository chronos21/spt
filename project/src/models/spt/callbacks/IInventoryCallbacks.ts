import { IPmcData } from "@spt-aki/models/eft/common/IPmcData";
import { IInventoryBindRequestData } from "@spt-aki/models/eft/inventory/IInventoryBindRequestData";
import { IInventoryCreateMarkerRequestData } from "@spt-aki/models/eft/inventory/IInventoryCreateMarkerRequestData";
import { IInventoryDeleteMarkerRequestData } from "@spt-aki/models/eft/inventory/IInventoryDeleteMarkerRequestData";
import { IInventoryEditMarkerRequestData } from "@spt-aki/models/eft/inventory/IInventoryEditMarkerRequestData";
import { IInventoryExamineRequestData } from "@spt-aki/models/eft/inventory/IInventoryExamineRequestData";
import { IInventoryFoldRequestData } from "@spt-aki/models/eft/inventory/IInventoryFoldRequestData";
import { IInventoryMergeRequestData } from "@spt-aki/models/eft/inventory/IInventoryMergeRequestData";
import { IInventoryMoveRequestData } from "@spt-aki/models/eft/inventory/IInventoryMoveRequestData";
import { IInventoryReadEncyclopediaRequestData } from "@spt-aki/models/eft/inventory/IInventoryReadEncyclopediaRequestData";
import { IInventoryRemoveRequestData } from "@spt-aki/models/eft/inventory/IInventoryRemoveRequestData";
import { IInventorySortRequestData } from "@spt-aki/models/eft/inventory/IInventorySortRequestData";
import { IInventorySplitRequestData } from "@spt-aki/models/eft/inventory/IInventorySplitRequestData";
import { IInventorySwapRequestData } from "@spt-aki/models/eft/inventory/IInventorySwapRequestData";
import { IInventoryTagRequestData } from "@spt-aki/models/eft/inventory/IInventoryTagRequestData";
import { IInventoryToggleRequestData } from "@spt-aki/models/eft/inventory/IInventoryToggleRequestData";
import { IInventoryTransferRequestData } from "@spt-aki/models/eft/inventory/IInventoryTransferRequestData";
import { IItemEventRouterResponse } from "@spt-aki/models/eft/itemEvent/IItemEventRouterResponse";

export interface IInventoryCallbacks
{
    moveItem(pmcData: IPmcData, body: IInventoryMoveRequestData, sessionID: string): IItemEventRouterResponse;
    removeItem(pmcData: IPmcData, body: IInventoryRemoveRequestData, sessionID: string): IItemEventRouterResponse;
    splitItem(pmcData: IPmcData, body: IInventorySplitRequestData, sessionID: string): IItemEventRouterResponse;
    mergeItem(pmcData: IPmcData, body: IInventoryMergeRequestData, sessionID: string): IItemEventRouterResponse;
    transferItem(pmcData: IPmcData, body: IInventoryTransferRequestData, sessionID: string): IItemEventRouterResponse;
    swapItem(pmcData: IPmcData, body: IInventorySwapRequestData, sessionID: string): IItemEventRouterResponse;
    foldItem(pmcData: IPmcData, body: IInventoryFoldRequestData, sessionID: string): IItemEventRouterResponse;
    toggleItem(pmcData: IPmcData, body: IInventoryToggleRequestData, sessionID: string): IItemEventRouterResponse;
    tagItem(pmcData: IPmcData, body: IInventoryTagRequestData, sessionID: string): IItemEventRouterResponse;
    bindItem(pmcData: IPmcData, body: IInventoryBindRequestData, sessionID: string): IItemEventRouterResponse;
    examineItem(pmcData: IPmcData, body: IInventoryExamineRequestData, sessionID: string): IItemEventRouterResponse;
    readEncyclopedia(
        pmcData: IPmcData,
        body: IInventoryReadEncyclopediaRequestData,
        sessionID: string,
    ): IItemEventRouterResponse;
    sortInventory(pmcData: IPmcData, body: IInventorySortRequestData, sessionID: string): IItemEventRouterResponse;
    createMapMarker(
        pmcData: IPmcData,
        body: IInventoryCreateMarkerRequestData,
        sessionID: string,
    ): IItemEventRouterResponse;
    deleteMapMarker(
        pmcData: IPmcData,
        body: IInventoryDeleteMarkerRequestData,
        sessionID: string,
    ): IItemEventRouterResponse;
    editMapMarker(
        pmcData: IPmcData,
        body: IInventoryEditMarkerRequestData,
        sessionID: string,
    ): IItemEventRouterResponse;
}
