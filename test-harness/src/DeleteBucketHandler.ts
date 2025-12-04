import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { HttpCodesEnum } from "../../src/utils/HttpCodesEnum";
import { DeleteBucketProcessor } from "./services/DeleteBucketProcessor";
import { Response } from "../../src/utils/Response";

export class DeleteBucketHandler implements LambdaInterface {
  async handler(event: any): Promise<any> {
    try {
      return await DeleteBucketProcessor.getInstance().processRequest(event);
    } catch {
        return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occured")
    }
  }
}

const handlerClass = new DeleteBucketHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
