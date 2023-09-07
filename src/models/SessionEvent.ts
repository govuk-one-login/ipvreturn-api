import { IsString, IsNotEmpty, IsEmail, IsBoolean, IsNumber, IsArray } from "class-validator";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "./enums/HttpCodesEnum";

/**
 * Object to represent data contained in SessionEvent messages sent by this lambda
 */
export class SessionEvent {
	constructor(data: Partial<SessionEvent>) {
		this.userEmail = data.userEmail!;
		this.userId = data.userId!;
		this.clientSessionId = data.clientSessionId!;
		this.clientName = data.clientName!;
		this.redirectUri = data.redirectUri!;
		this.nameParts = data.nameParts!;
		this.ipvStartedOn = data.ipvStartedOn!;
		this.journeyWentAsyncOn = data.journeyWentAsyncOn!;
		this.readyToResumeOn = data.readyToResumeOn!;
		this.notified = data.notified === undefined ? false : data.notified;
	}

	static parseRequest(data: string): SessionEvent {
		try {
			const obj = JSON.parse(data);
			return new SessionEvent(obj);
		} catch (error: any) {
			console.log("Cannot parse SessionEvent data", SessionEvent.name, "parseBody", { data });
			throw new AppError(HttpCodesEnum.BAD_REQUEST, "Cannot parse SessionEvent data");
		}
	}

	@IsString()
	@IsNotEmpty()
	@IsEmail()
	userEmail!: string;

	@IsString()
	@IsNotEmpty()
	userId!: string;

	@IsString()
	clientSessionId!: string;

	@IsString()
	@IsNotEmpty()
	clientName!: string;

	@IsArray()
	@IsNotEmpty()
	nameParts!: Array<{
		type: string;
		value: string;
	}>;

	@IsString()
	@IsNotEmpty()
	redirectUri!: string;

	@IsNumber()
	@IsNotEmpty()
	ipvStartedOn!: number;

	@IsNumber()
	@IsNotEmpty()
	journeyWentAsyncOn!: number;

	@IsNumber()
	@IsNotEmpty()
	readyToResumeOn!: number;

	@IsBoolean()
	notified!: boolean;

}

/**
 * Object to represent data contained in SessionEvent messages sent by this lambda
 */
export class ExtSessionEvent extends SessionEvent {
	constructor(data: Partial<ExtSessionEvent>) {
		super(data);
        this.documentUploadedOn = data.documentUploadedOn!;
        this.documentType = data.documentType!;		
        this.documentExpiryDate = data.documentExpiryDate!;
		this.postOfficeVisitDetails = data.postOfficeVisitDetails!;
		this.postOfficeInfo = data.postOfficeInfo!;
	}

	static parseRequest(data: string): ExtSessionEvent {
		try {
			const obj = JSON.parse(data);
			return new ExtSessionEvent(obj);
		} catch (error: any) {
			console.log("Cannot parse ExtSessionEvent data", SessionEvent.name, "parseBody", { data });
			throw new AppError(HttpCodesEnum.BAD_REQUEST, "Cannot parse ExtSessionEvent data");
		}
	}
	

	@IsNumber()
	@IsNotEmpty()
	documentUploadedOn!: number;

	@IsString()
	@IsNotEmpty()
	documentType!: string;

	@IsString()
	@IsNotEmpty()
	documentExpiryDate!: string;

	@IsArray()
	@IsNotEmpty()
	postOfficeInfo!: Array<{
		name?: string;
		address: string;
		post_code: string;
		location: [
			{
				latitude: number;
				longitude: number;
			},
		];
	}>;

	@IsArray()
	@IsNotEmpty()
	postOfficeVisitDetails!: Array<{
		post_office_date_of_visit: string;
		post_office_time_of_visit: string;
	}>;
}
