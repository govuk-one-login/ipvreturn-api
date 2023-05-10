import { Constants } from "../utils/Constants";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";

export class IPREventTypeToAttributeMapper {

    private static readonly eventAttributeMap = new Map<string, string>([
    	[Constants.AUTH_IPV_AUTHORISATION_REQUESTED, "ipvStartedOn"],
    	[Constants.F2F_YOTI_START, "journeyWentAsyncOn"],
    	[Constants.IPV_F2F_CRI_VC_CONSUMED, "readyToResumeOn"],
    	[Constants.AUTH_DELETE_ACCOUNT, "accountDeletedOn"],
    ]);

    map(eventType: string): string | undefined {
    	return IPREventTypeToAttributeMapper.eventAttributeMap.get(eventType);
    }
}
