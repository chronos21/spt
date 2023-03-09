import { IEmptyRequestData } from "../../eft/common/IEmptyRequestData";
import { IFriendRequestData } from "../../eft/dialog/IFriendRequestData";
import { IGetAllAttachmentsRequestData } from "../../eft/dialog/IGetAllAttachmentsRequestData";
import { IGetAllAttachmentsResponse } from "../../eft/dialog/IGetAllAttachmentsResponse";
import { IGetChatServerListRequestData } from "../../eft/dialog/IGetChatServerListRequestData";
import { IGetFriendListDataResponse } from "../../eft/dialog/IGetFriendListDataResponse";
import { IGetMailDialogInfoRequestData } from "../../eft/dialog/IGetMailDialogInfoRequestData";
import { IGetMailDialogListRequestData } from "../../eft/dialog/IGetMailDialogListRequestData";
import { IGetMailDialogViewRequestData } from "../../eft/dialog/IGetMailDialogViewRequestData";
import { IGetMailDialogViewResponseData } from "../../eft/dialog/IGetMailDialogViewResponseData";
import { IPinDialogRequestData } from "../../eft/dialog/IPinDialogRequestData";
import { IRemoveDialogRequestData } from "../../eft/dialog/IRemoveDialogRequestData";
import { ISendMessageRequest } from "../../eft/dialog/ISendMessageRequest";
import { ISetDialogReadRequestData } from "../../eft/dialog/ISetDialogReadRequestData";
import { IGetBodyResponseData } from "../../eft/httpResponse/IGetBodyResponseData";
import { INullResponseData } from "../../eft/httpResponse/INullResponseData";
import { DialogueInfo } from "../../eft/profile/IAkiProfile";

export interface IDialogueCallbacks
{
    getFriendList(url: string, info: IEmptyRequestData, sessionID: string): IGetBodyResponseData<IGetFriendListDataResponse>;
    getChatServerList(url: string, info: IGetChatServerListRequestData, sessionID: string): IGetBodyResponseData<any[]>;
    getMailDialogList(url: string, info: IGetMailDialogListRequestData, sessionID: string): IGetBodyResponseData<DialogueInfo[]>;
    getMailDialogView(url: string, info: IGetMailDialogViewRequestData, sessionID: string): IGetBodyResponseData<IGetMailDialogViewResponseData>;
    getMailDialogInfo(url: string, info: IGetMailDialogInfoRequestData, sessionID: string): IGetBodyResponseData<any>;
    removeDialog(url: string, info: IRemoveDialogRequestData, sessionID: string): IGetBodyResponseData<any[]>;
    pinDialog(url: string, info: IPinDialogRequestData, sessionID: string): IGetBodyResponseData<any[]>;
    unpinDialog(url: string, info: IPinDialogRequestData, sessionID: string): IGetBodyResponseData<any[]>;
    setRead(url: string, info: ISetDialogReadRequestData, sessionID: string): IGetBodyResponseData<any[]>;
    getAllAttachments(url: string, info: IGetAllAttachmentsRequestData, sessionID: string): IGetBodyResponseData<IGetAllAttachmentsResponse>;
    listOutbox(url: string, info: IEmptyRequestData, sessionID: string): IGetBodyResponseData<any[]>;
    listInbox(url: string, info: IEmptyRequestData, sessionID: string): IGetBodyResponseData<any[]>;
    sendFriendRequest(url: string, request: IFriendRequestData, sessionID: string): INullResponseData;
    sendMessage(url: string, request: ISendMessageRequest, sessionID: string): IGetBodyResponseData<number>;
    update(): boolean;
}
