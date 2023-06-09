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
