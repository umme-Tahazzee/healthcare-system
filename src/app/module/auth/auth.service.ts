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
	IVerifyEmailPayload,
} from "./auth.interface";
import type { TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleFrom";
import crypto from 'crypto'
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import ejs from 'ejs'
import path from "path";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, 8);


	const OTP_EXPIRY_MINUTES = 5 * 60;

	const otpKey = `patient-registration-otp:${email}`
	const otpValue = crypto.randomInt(100000, 1000000).toString()
	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: OTP_EXPIRY_MINUTES
		}
	})


	const patientRegistrationKey = `patient-registration-data:${email}`
	const redisUserPayload = {
		name,
		email,
		password: hashedPassword,
		patient: patientData
	}


	await redisClient.set(patientRegistrationKey, JSON.stringify(redisUserPayload), {
		expiration: {
			type: "EX",
			value: OTP_EXPIRY_MINUTES
		}
	})

	const templatePath = path.join(process.cwd(),
		'src/app/templates/registration-user-otp.ejs')
	const html = await ejs.renderFile(templatePath, {
		name,
		email,
		otpValue,
		expirationMinutes: OTP_EXPIRY_MINUTES / 60
	})
	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Email verfication",
		html

	})


};


const verifyPatientEmail = async (payload: IVerifyEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists?.emailVerified) {
		throw new Error("Email already verified");
	}

	if (isUserExists?.status === UserStatus.BLOCKED) {
		throw new Error("User is Blocked");
	}

	if (isUserExists?.isDeleted || isUserExists?.status === UserStatus.DELETED) {
		throw new Error("User is Deleted");
	}

	const otpKey = `patient-registration-otp:${email}`;


	const storedOtp = await redisClient.get(otpKey);

	console.log("otp", otp);
	console.log("storedOpt", storedOtp);



	if (!storedOtp) {
		throw new Error("OTP expired or invalid");
	}

	if (storedOtp !== otp) {
		throw new Error("OTP does not match");
	}

	await redisClient.del(otpKey);

	const patientRegistrationKey = `patient-registration-data:${email}`;
	const redisPatientData = await redisClient.get(patientRegistrationKey);

	if (!redisPatientData) {
		throw new Error("Patient doesn't exist");
	}

	const patientPayload: IRegisterPatientPayload = JSON.parse(redisPatientData);


	const createdUser = await prisma.user.create({
		data: {
			name: patientPayload.name,
			email: patientPayload.email,
			password: patientPayload.password,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			patient: {
				create: {
					name: patientPayload.name,
					email: patientPayload.email,
					// contactNumber: patientPayload?.patient.contactNumber || " ",
				},
			},
		},
		omit: { password: true },
		include: { patient: true },
	});


	await redisClient.del(patientRegistrationKey);

	const templatePath = path.join(process.cwd(), 'src/app/templates/patient-welcome-email.ejs')
	const html = await ejs.renderFile(templatePath, {
		name: createdUser.name,
		email,

	})

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Welcome To healthcare system",
		html

	})

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

			const templatePath = path.join(process.cwd(), 'src/app/templates/patient-welcome-email.ejs')
			const html = await ejs.renderFile(templatePath, {
				name: user.name,
				email: user.email,

			})

			await transporter.sendMail({
				from: config.email_sender,
				to: user.email,
				subject: "Welcome To healthcare system credential",
				html

			})

		}
	}

	if (!user) {
		throw new Error("User is not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("user is Blocked");
	}

	if (user.password === null && user.googleId !== null) {
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

const forgotPassword = async (payload: IForgetPassword) => {
	const { email } = payload
	const isUserExists = await prisma.user.findUnique({
		where: {
			email
		}
	})


	if (!isUserExists) {
		throw new Error("User Doest not exist")
	}
	if (isUserExists.status === "BLOCKED") {
		throw new Error("User is blocked")
	}

	if (isUserExists.isDeleted || isUserExists.status === "DELETED") {
		throw new Error("User is Deleted")
	}

	if (isUserExists.authProvider !== "CREDENTIAL") {
		throw new Error("User was account with google")
	}

	const otp = crypto.randomInt(100000, 1000000).toString()
	const key = `forgot-password-otp:${isUserExists.email}`
	const OTP_EXPIRY_MINUTES = 5 * 60;

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: OTP_EXPIRY_MINUTES
		}
	})

	const templatePath = path.join(process.cwd(), 'src/app/templates/forgot-password.ejs')
	const html = await ejs.renderFile(templatePath, {
		name: isUserExists.name,
		OTP: otp,
		expirationMinutes: OTP_EXPIRY_MINUTES
	})
	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Forgot password",
		html

	})

}

const resetPassword = async (payload: IResetPassword) => {
	const { email, otp, newPassword } = payload
	console.log(payload);


	const isUserExists = await prisma.user.findUnique({
		where: {
			email
		}
	})


	if (!isUserExists) {
		throw new Error("User Doest not exist")
	}
	if (isUserExists.status === "BLOCKED") {
		throw new Error("User is blocked")
	}

	if (isUserExists.isDeleted || isUserExists.status === "DELETED") {
		throw new Error("User is Deleted")
	}

	if (isUserExists.authProvider !== "CREDENTIAL") {
		throw new Error("User has account with google")
	}

	// const otp = crypto.randomInt(100000,1000000).toString()
	const key = `forgot-password-otp:${isUserExists.email}`

	const redisOtp = await redisClient.get(key)
	// console.log(redisOtp, "redisOTp");

	if (!redisOtp) {
		throw new Error("Invalid otp")
	}

	if (redisOtp !== otp) {
		throw new Error("OTP doesnt match")
	}

	const hashedPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds))
	await prisma.user.update({
		where: {
			email: isUserExists?.email
		},
		data: {
			password: hashedPassword
		}
	})

	const templatePath = path.join(process.cwd(), 'src/app/templates/reset-password-success.ejs')
	const html = await ejs.renderFile(templatePath, {
		name: isUserExists.name,

	})



	await redisClient.del([key])
	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Password is changed",
		html,

	})

}

export const AuthService = {
	registerPatient,
	verifyPatientEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword
};




