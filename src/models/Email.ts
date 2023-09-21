import { IsString, IsNotEmpty, IsOptional, IsEmail } from "class-validator";
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
export class NewEmail extends Email {

	constructor(data: Partial<NewEmail>) {
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
			return new NewEmail(obj);
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
