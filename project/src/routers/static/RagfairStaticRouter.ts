import { inject, injectable } from "tsyringe";

import { RagfairCallbacks } from "@spt-aki/callbacks/RagfairCallbacks";
import { RouteAction, StaticRouter } from "@spt-aki/di/Router";

@injectable()
export class RagfairStaticRouter extends StaticRouter
{
    constructor(@inject("RagfairCallbacks") protected ragfairCallbacks: RagfairCallbacks)
    {
        super([
            new RouteAction(
                "/client/ragfair/search",
                (url: string, info: any, sessionID: string, output: string): any =>
                {
                    return this.ragfairCallbacks.search(url, info, sessionID);
                },
            ),
            new RouteAction(
                "/client/ragfair/find",
                (url: string, info: any, sessionID: string, output: string): any =>
                {
                    return this.ragfairCallbacks.search(url, info, sessionID);
                },
            ),
            new RouteAction(
                "/client/ragfair/itemMarketPrice",
                (url: string, info: any, sessionID: string, output: string): any =>
                {
                    return this.ragfairCallbacks.getMarketPrice(url, info, sessionID);
                },
            ),
            new RouteAction(
                "/client/ragfair/offerfees",
                (url: string, info: any, sessionID: string, output: string): any =>
                {
                    return this.ragfairCallbacks.storePlayerOfferTaxAmount(url, info, sessionID);
                },
            ),
            new RouteAction(
                "/client/reports/ragfair/send",
                (url: string, info: any, sessionID: string, output: string): any =>
                {
                    return this.ragfairCallbacks.sendReport(url, info, sessionID);
                },
            ),
            new RouteAction(
                "/client/items/prices",
                (url: string, info: any, sessionID: string, output: string): any =>
                {
                    return this.ragfairCallbacks.getFleaPrices(url, info, sessionID);
                },
            ),
        ]);
    }
}
