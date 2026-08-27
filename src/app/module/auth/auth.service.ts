// biome-ignore assist/source/organizeImports: <explanation>
import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgetPassword,
	IgoogleLoginPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPassword,
} from "./auth.interface";
import type { TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleFrom";
import crypto from 'crypto'
import httpStatus from "http-status";
import { redisClient } from "../../lib/redis";


const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient : patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, 8);

	const createdUser : any = await prisma.user.create({
		data: {
			name,
			email,
			password: hashedPassword,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: false,
			patient: {
				create: { name, email, contactNumber : patientData?.contactNumber },
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	const { patient, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		patient,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new Error("User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLogin = async (payload: IgoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.log("google id token verfication fail", error);
		throw new Error("Invalid or expire googleId token");
	}

	if (!googleIdTokenPayload) {
		throw new Error("Invalid or expire googleId token");
	}

	if (!googleIdTokenPayload.name) {
		throw new Error("Username not found");
	}

	if (!googleIdTokenPayload.email) {
		throw new Error("Google email not found");
	}

	// google
	const ifPatientExistWithGoogleAuth = await prisma.user.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.PATIENT,
			googleId: googleIdTokenPayload.sub,
		},
	});

	let user = ifPatientExistWithGoogleAuth;

	if (!ifPatientExistWithGoogleAuth) {
		const isPatientExitsWithCredentials = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
				role: Role.PATIENT,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});

		if (isPatientExitsWithCredentials) {
			if (!isPatientExitsWithCredentials.emailVerified) {
				throw new Error("Email is not varified");
			}

			if (isPatientExitsWithCredentials.status === UserStatus.BLOCKED) {
				throw new Error("User Is bloocked");
			}

			if (
				isPatientExitsWithCredentials.isDeleted ||
				isPatientExitsWithCredentials.status === UserStatus.DELETED
			) {
				throw new Error("User Is deleted");
			}

			user = await prisma.user.update({
				where: {
					id: isPatientExitsWithCredentials.id,
				},
				data: {
					googleId: googleIdTokenPayload.sub,
				},
			});
		} else {
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: googleIdTokenPayload.email,
					role: Role.PATIENT,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					patient: {
						create: {
							name: googleIdTokenPayload.name,
							email: googleIdTokenPayload.email,
						},
					},
				},
			});
		}
	}

	if (!user) {
		throw new Error("User is not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("user is Blocked");
	}

	if(user.password === null && user.googleId !== null){
		throw new Error("User already has account register with google ")
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const forgotPassword = async(payload : IForgetPassword) =>{
	const {email} = payload
	const isUserExists = await prisma.user.findUnique({
		where : {
			email 
		}
	})

	
	if(!isUserExists){
		throw new Error("User Doest not exist")
	}
	if(isUserExists.status === "BLOCKED"){
		throw new Error("User is blocked")
	}

	if(isUserExists.isDeleted || isUserExists.status === "DELETED"){
		throw new Error("User is Deleted")
	}

	if( isUserExists.authProvider !== "CREDENTIAL"){
		 throw new Error("User was account with google")
	}

	const otp = crypto.randomInt(100000,1000000).toString()
	const key=`forgot-password-otp:${isUserExists.email}`

	await redisClient.set(key, otp, {
		 expiration:{
			 type : "EX",
			 value : 5 * 60
		 }
	})

}

const resetPassword = async(payload: IResetPassword) =>{
	const {email} = payload
	const isUserExists = await prisma.user.findUnique({
		where : {
			email 
		}
	})

	
	if(!isUserExists){
		throw new Error("User Doest not exist")
	}
	if(isUserExists.status === "BLOCKED"){
		throw new Error("User is blocked")
	}

	if(isUserExists.isDeleted || isUserExists.status === "DELETED"){
		throw new Error("User is Deleted")
	}

	if( isUserExists.authProvider !== "CREDENTIAL"){
		 throw new Error("User has account with google")
	}


}

export const AuthService = {
	registerPatient,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword, 
	resetPassword
};
