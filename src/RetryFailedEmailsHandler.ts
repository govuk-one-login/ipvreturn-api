import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { ResourcesEnum } from "./models/enums/ResourcesEnum";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { SessionProcessor } from "./services/SessionProcessor";
import { HttpVerbsEnum } from "./utils/HttpVerbsEnum";
import { getParameter } from "./utils/Config";
import { EnvironmentVariables } from "./services/EnvironmentVariables";
import { ServicesEnum } from "./models/enums/ServicesEnum";
import { MessageCodes } from "./models/enums/MessageCodes";
import { AppError } from "./utils/AppError";
import * as AWS from "aws-sdk"; // Import AWS SDK

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE
  ? process.env.POWERTOOLS_METRICS_NAMESPACE
  : "CIC-CRI";
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL
  ? process.env.POWERTOOLS_LOG_LEVEL
  : "DEBUG";

const S3_BUCKET_NAME = "your-s3-bucket-name"; // Replace with your S3 bucket name
const S3_OBJECT_KEYS = [
  "00418fc0d04998d266f9601d136565f97aeffec592f0e0d8224470159c34ad98",
  "013500aa7c55b01f828d72dacaa4ee6b80a7f619f88001e1804f51ab459eaecd",
]; // Replace with your S3 object keys

const logger = new Logger({
  logLevel: POWERTOOLS_LOG_LEVEL,
  serviceName: "RetryFailedEmails",
});
let CLIENT_ID: string;

const metrics = new Metrics({
  namespace: POWERTOOLS_METRICS_NAMESPACE,
  serviceName: "RetryFailedEmails",
});

class Session implements LambdaInterface {
  private readonly environmentVariables = new EnvironmentVariables(
    logger,
    ServicesEnum.GET_SESSION_EVENT_DATA_SERVICE
  );

  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  @logger.injectLambdaContext()
  async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {
    // clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
    logger.setPersistentLogAttributes({});
    logger.addContext(context);

    logger.debug("metrics is", { metrics });

    try {
      const s3 = new AWS.S3(); // Create an S3 client

      for (const objectKey of S3_OBJECT_KEYS) {
        const params = {
          Bucket: S3_BUCKET_NAME,
          Key: objectKey,
        };

        // Use the getObject method to get the content of the S3 object
        const s3Response = await s3.getObject(params).promise();

        // The content of the .csv file will be in s3Response.Body
        const csvContent = s3Response.Body.toString("utf-8");

        // Now you can process the CSV content as needed
        console.log("CSV Content:", csvContent);
      }

      // Add your processing logic for the CSV content here

      return {
        statusCode: HttpCodesEnum.OK,
        body: "CSV files processed successfully",
      };
    } catch (error) {
      // Handle errors here
      console.error("Error:", error);

      return {
        statusCode: HttpCodesEnum.INTERNAL_SERVER_ERROR,
        body: "Internal Server Error",
      };
    }
  }
}

const handlerClass = new Session();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
