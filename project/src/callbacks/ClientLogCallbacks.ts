import { ClientLogController } from "@spt-aki/controllers/ClientLogController";
import { ModLoadOrder } from "@spt-aki/loaders/ModLoadOrder";
import { INullResponseData } from "@spt-aki/models/eft/httpResponse/INullResponseData";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { ICoreConfig, IRelease } from "@spt-aki/models/spt/config/ICoreConfig";
import { IClientLogRequest } from "@spt-aki/models/spt/logging/IClientLogRequest";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { LocalisationService } from "@spt-aki/services/LocalisationService";
import { HttpResponseUtil } from "@spt-aki/utils/HttpResponseUtil";
import { inject, injectable } from "tsyringe";

/** Handle client logging related events */
@injectable()
export class ClientLogCallbacks
{
    constructor(
        @inject("HttpResponseUtil") protected httpResponse: HttpResponseUtil,
        @inject("ClientLogController") protected clientLogController: ClientLogController,
        @inject("ConfigServer") protected configServer: ConfigServer,
        @inject("LocalisationService") protected localisationService: LocalisationService,
        @inject("ModLoadOrder") protected modLoadOrder: ModLoadOrder,
    )
    {}

    /**
     * Handle /singleplayer/log
     */
    public clientLog(url: string, info: IClientLogRequest, sessionID: string): INullResponseData
    {
        this.clientLogController.clientLog(info);
        return this.httpResponse.nullResponse();
    }

    /**
     * Handle /singleplayer/release
     */
    public releaseNotes(): string
    {
        const data: IRelease = this.configServer.getConfig<ICoreConfig>(ConfigTypes.CORE).release;
        data.betaDisclaimer = this.localisationService.getText("beta-disclaimer");
        data.releaseSummary = this.localisationService.getText("release-summary");
        data.isBeta = globalThis.G_WATERMARK_ENABLED;
        data.isModdable = globalThis.G_MODS_ENABLED;
        data.isModded = this.modLoadOrder.getLoadOrder().length > 0 ? true : false;

        return this.httpResponse.noBody(data);
    }
}
