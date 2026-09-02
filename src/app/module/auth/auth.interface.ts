import type { Role } from "../../../generated/prisma/browser";

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRegisterPatientPayload {
	name: string;
	email: string;
	password: string;
	patient : {
		 contactNumber ?: string,
		 age : number
	}
}

export interface IVerifyEmailPayload {
	email: string;
	otp : string
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}

export interface IgoogleLoginPayload {
	idToken : string
}

export interface IForgetPassword{
	 email : string
}

export interface IResetPassword{
	 email : string,
	 newPassword : string,
	 otp : string
}