// biome-ignore assist/source/organizeImports: <explanation>
import { prisma } from "../../lib/prisma";
import { DoctorVerificationStatus, Role, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import path from "path";
import { transporter } from "../../lib/nodemailer";
import ejs from "ejs";

import { IApplyAsDoctorPayload, IApprovedDoctorPayload, IDoctorVerifyEmailPayload } from "./doctor.interface";
import { RequestUser } from "../../middleware/checkAuth";

const getDoctorOtpKey = (email: string) => `doctor-application:otp:${email.trim().toLowerCase()}`;


const applyAsDoctor = async (
	payload: IApplyAsDoctorPayload,
	resume: Express.Multer.File | null,
	additionalFiles: Express.Multer.File[],
) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			email: payload.user.email,
		},
	});

	if (isUserExists) {
		throw new Error("User Already Exists with this Email");
	}

	if (!resume) {
		throw new Error("Resume is required");
	}

	// Step 2: Cloudinary te upload kora, Promise diye wrap kore await-able banano
	const resumeUploadResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ resource_type: "auto" },
				async (error, result) => {
					if (error) {
						console.log(error);
						return reject(new Error(error.message));
					}

					if (!result) {
						return reject(new Error("No result returned from cloudinary"));
					}

					resolve(result);
				},
			);
			stream.end(resume?.buffer);
		},
	);

	const additionFliesResult = await Promise.all(
		additionalFiles.map((file) => {
			return new Promise<UploadApiResponse>((resolve, reject) => {
				cloudinary.uploader
					.upload_stream({ resource_type: "auto" }, async (error, result) => {
						if (error) {
							console.log(error);
							return reject(new Error(error.message));
						}

						if (!result) {
							return reject(new Error("No result returned from cloudinary"));
						}

						resolve(result);
					})
					.end(file.buffer);
			});
		}),
	);

	const randomDoctorPassword = Math.random().toString(36).slice(-8);
	const saltRounds = Number(config.bcrypt_salt_rounds) || 12;
	const hashpassword = await bcrypt.hash(randomDoctorPassword, saltRounds);

	const { user, doctor } = payload;

	const doctorApplication = await prisma.user.create({
		data: {
			name: user.name,
			email: user.email,
			password: hashpassword,
			role: Role.DOCTOR,
			doctor: {
				create: {
					name: user.name,
					email: user.email,
					specialization: doctor.specialization,
					qualifications: doctor.qualifications,
					experienceYear: doctor.experienceYear,
					licenseNumber: doctor.licenseNumber,
					address: doctor.address,
					bio: doctor.bio,
					consultationFee: doctor.consultationFee,
					resume: resumeUploadResult.secure_url,
					resumePublicId: resumeUploadResult.public_id,
					additionalFiles: additionFliesResult.map((f) => ({
						url: f.secure_url,
						publicId: f.public_id,
					})),
				},
			},
		},
		include: { doctor: true },
	});

	const expirationSeconds = 60 * 60;
	const otpKey = getDoctorOtpKey(payload.user.email);
	const otpValue = crypto.randomInt(100000, 1000000).toString()


	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-user-otp.ejs",
	);

	const templateData = {
		name: payload.user.name,
		email: payload.user.email,
		otp: otpValue,
		expirationMinutes: expirationSeconds / 60,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: payload.user.email,
		subject: "Doctor Application-Email verfication",
		html,
	});

	return doctorApplication;
};

const verifyDoctorEmail = async (payload: IDoctorVerifyEmailPayload) => {
	const otp = payload.otp;

	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: 
		{ 
		    email, 
			role : Role.DOCTOR
		 },
	});
	
	
	if (isUserExists?.emailVerified) {
		throw new Error("Email already verfify");
	}

	if (isUserExists?.status === "BLOCKED") {
		throw new Error("User is Blocked");
	}

	if (isUserExists?.isDeleted || isUserExists?.status === "DELETED") {
		throw new Error("User is Deleted");
	}

	const otpKey = getDoctorOtpKey(email)
	const storedOtp = await redisClient.get(otpKey);

	if (!storedOtp) {
		throw new Error("OTP expired or invalid");
	}

	if (storedOtp !== otp) {
		throw new Error("OTP does not match");
	}

	await redisClient.del(otpKey);

	if (!storedOtp) {
		throw new Error("OTP invalid");
	}

	if (storedOtp !== otp) {
		throw new Error("OTP does not match");
	}

	await redisClient.del(otpKey);

	const verfiedUser = await prisma.user.update({
		where :{
			 id: isUserExists?.id
		},
		data:{
			 emailVerified : true
		},
		omit:{
			password: true
		},
		include:{
			 doctor: true
		}
	})
	await redisClient.del(otpKey);
	return verfiedUser
};

const approvedDoctor = async(payload: IApprovedDoctorPayload, reviewer : RequestUser) =>{
	const {doctorId, verificationStatus, rejectionReason} = payload
	const existingDoctor = await prisma.doctor.findUnique({
		  where : {id: doctorId},
		  include:{user: true}
	})

	if(!existingDoctor){
		 throw new Error("Doctor aplication not found")
	}


	if (existingDoctor.user.isDeleted) {
		throw new Error("User is Deleted");
	}

	if(!existingDoctor.user.emailVerified){
		throw new Error("Doctor Email is not verified. Application cannt be reviewd")
	}

	if(existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING){
		throw new Error(`Doctor verification status is already ${existingDoctor.verificationStatus.toLocaleLowerCase()}`)
	}

	if(verificationStatus === DoctorVerificationStatus.REJECTED && !rejectionReason){
		 throw new Error("Rejecting Reason is required when rejecting a doctor application")
	}

	const updateDoctor = await prisma.doctor.update({
		 where : {id: doctorId},
		 data : {
			verificationStatus,
			rejectionReason:
			verificationStatus === DoctorVerificationStatus.REJECTED ? rejectionReason : null,
			reviewBy : reviewer.userId,
			// reviewedAt: new Date(),

		  }
	})

	const isApproved = verificationStatus === DoctorVerificationStatus.APPROVED
	const templatePath = path.join(
		process.cwd(),
		`src/app/templates/${isApproved ?
			'doctor-application-approved.ejs':
			'doctor-application-rejected.ejs'
		}`
	)

	const templateData = {
		 name: updateDoctor.name,
		 reason : updateDoctor.rejectionReason
	}
	const html = await ejs.renderFile(templatePath, templateData)

   await transporter.sendMail({
	 from : config.email_sender,
	 to: updateDoctor.email,
	 subject : isApproved ?
	            "Your Doctor Application Has been approved"
				: "Your doctor application has been Rejected",
				html
   })

   return updateDoctor


}




export const DoctorServices = {
	applyAsDoctor,
	verifyDoctorEmail,
	approvedDoctor,
	
};
