import { IsString, IsNotEmpty, IsEmail, IsNumber } from "class-validator";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "./enums/HttpCodesEnum";

/**
 * Object to represent data contained in SessionEvent messages sent by this lambda
 */
export class AuthEvent {
	constructor(data: AuthEvent) {
		this.userEmail = data.userEmail!;
		this.userId = data.userId!;
		this.clientName = data.clientName!;
		this.redirectUri = data.redirectUri!;
		this.ipvStartedOn = data.ipvStartedOn!;
	}

	static parseRequest(data: string): AuthEvent {
		try {
			const obj = JSON.parse(data);
			return new AuthEvent(obj);
			// ignored so as not log PII
			/* eslint-disable @typescript-eslint/no-unused-vars */
		} catch (error: any) {
			console.log("Cannot parse AuthEvent data", AuthEvent.name, "parseBody", { data });
			throw new AppError(HttpCodesEnum.BAD_REQUEST, "Cannot parse AuthEvent data");
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


	@IsString()
	@IsNotEmpty()
	redirectUri!: string;

	@IsNumber()
	@IsNotEmpty()
	ipvStartedOn!: number;

}
