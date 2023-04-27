import { IsString, IsNotEmpty, IsEmail, IsBoolean } from "class-validator";

import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "./enums/HttpCodesEnum";

/**
 * Object to represent data contained in SessionEvent messages sent by this lambda
 */
export class SessionEvent {

	constructor(data: Partial<SessionEvent>) {
		this.eventName = data.eventName!;
		this.email = data.email!;
		this.userId = data.userId!;
		this.clientId = data.clientId!;
		this.redirectUri = data.redirectUri!;
		this.firstName = data.firstName!;
		this.lastName = data.lastName!;
		this.rpName = data.rpName!;
		this.notified = (data.notified === undefined) ? false : data.notified;
	}

	static parseRequest(data: string): SessionEvent {
		try {
			const obj = JSON.parse(data);
			return new SessionEvent(obj);
		} catch (error: any) {
			console.log("Cannot parse SessionEvent data", SessionEvent.name, "parseBody", { data });
			throw new AppError( HttpCodesEnum.BAD_REQUEST, "Cannot parse SessionEvent data");
		}
	}

	@IsString()
	@IsNotEmpty()
	eventName!: string;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    userId!: string;

	@IsString()
	@IsNotEmpty()
	clientId!: string;

	@IsString()
	@IsNotEmpty()
	firstName!: string;

	@IsString()
	@IsNotEmpty()
	lastName!: string;

    @IsString()
    @IsNotEmpty()
    redirectUri!: string;

	@IsString()
	@IsNotEmpty()
	rpName!: string;

	@IsBoolean()
	notified!: boolean;

}
