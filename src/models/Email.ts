import { IsString, IsNotEmpty, IsEmail } from "class-validator";
import { randomUUID } from "crypto";

import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "./enums/HttpCodesEnum";

/**
 * Object to represent data contained in email messages sent by this lambda
 */
export class Email {

	constructor(data: Partial<Email>) {
		this.userId = data.userId!;
		this.emailAddress = data.emailAddress!;
		this.firstName = data.firstName!;
		this.lastName = data.lastName!;
		this.messageType = data.messageType!;
		this.referenceId = randomUUID();
	}

	static parseRequest(data: any): Email {
		try {
			const obj = JSON.parse(data);
			return new Email(obj);
		} catch (error: any) {
			console.log("Cannot parse Email data", Email.name, "parseBody", { data });
			throw new AppError( HttpCodesEnum.BAD_REQUEST, "Cannot parse Email data");
		}
	}

	@IsString()
	@IsNotEmpty()
	userId!: string;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    emailAddress!: string;

    @IsString()
    @IsNotEmpty()
    firstName!: string;

	@IsString()
	@IsNotEmpty()
	lastName!: string;

    @IsString()
    @IsNotEmpty()
    referenceId!: string;

	@IsString()
    @IsNotEmpty()
    messageType!: string;	

}

/**
 * Object to represent data contained in email messages sent by this lambda
 */
export class DynamicEmail extends Email {

	constructor(data: Partial<DynamicEmail>) {
		super(data);
		this.documentType = data.documentType!;
		this.poAddress = data.poAddress!;
		this.poVisitDate = data.poVisitDate!;
		this.poVisitTime = data.poVisitTime!;
		this.documentExpiryDate = data.documentExpiryDate!;
	}

	static parseRequest(data: any): Email {
		try {
			const obj = JSON.parse(data);
			return new DynamicEmail(obj);
		} catch (error: any) {
			console.log("Cannot parse NewEmail data", Email.name, "parseBody", { data });
			throw new AppError( HttpCodesEnum.BAD_REQUEST, "Cannot parse NewEmail data");
		}
	}

	@IsString()
	@IsNotEmpty()
	documentType!: string;

    @IsString()
    @IsNotEmpty()
    poAddress!: string;

    @IsString()
    @IsNotEmpty()
    poVisitDate!: string;

	@IsString()
	@IsNotEmpty()
	poVisitTime!: string;

    @IsString()
    @IsNotEmpty()
    documentExpiryDate!: string;

}

export class FallbackEmail {

	constructor(data: Partial<FallbackEmail>) {
		this.userId = data.userId!;
		this.emailAddress = data.emailAddress!;
		this.messageType = data.messageType!;
		this.referenceId = randomUUID();
	}

	static parseRequest(data: any): FallbackEmail {
		try {
			const obj = JSON.parse(data);
			return new FallbackEmail(obj);
		} catch (error: any) {
			console.log("Cannot parse Email data", FallbackEmail.name, "parseBody", { data });
			throw new AppError( HttpCodesEnum.BAD_REQUEST, "Cannot parse Email data");
		}
	}

	@IsString()
	@IsNotEmpty()
	userId!: string;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    emailAddress!: string;

    @IsString()
    @IsNotEmpty()
    referenceId!: string;

	@IsString()
    @IsNotEmpty()
    messageType!: string;	

}
