import { resolve } from "node:dns";
import { rejects } from "node:assert";
import { prisma } from "../../lib/prisma";
import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import bcrypt from "bcryptjs";
import config from "../../config";
import { Role } from "../../../generated/prisma/enums";

const applyAsDoctor = async (
	payload: any,
	resume: Express.Multer.File | null,
	additionalFiles: Express.Multer.File[],
) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: payload.email,
		},
	});
	if (isUserExists) {
		throw new Error("User Already Exists with this Email");
	}

	const resumeUploadResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ resource_type: "auto" },
				(error, result) => {
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

	const additionalFilesUploadResult = await Promise.all(
		additionalFiles.map((file) => {
			return new Promise<UploadApiResponse>((resolve, reject) => {
				{
					const stream = cloudinary.uploader.upload_stream(
						{ resource_type: "auto" },
						(error, result) => {
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
				}
			});
		}),
	);
	const randomDoctorPassword = Math.random().toString(36).slice(-8)
	const hashedPassword = await bcrypt.hash(randomDoctorPassword, Number(config.bcrypt_salt_rounds))
	const doctorApplication = await prisma.user.create({
		data: {
		...payload.user,
		password : hashedPassword,
		role: Role.DOCTOR,
			doctor: {
				create: {
					...payload.doctor,
					resumeUrl: resumeUploadResult.resume_url,
					resumePublicId: resumeUploadResult.public_id,
					additionalFiles: additionalFilesUploadResult.map((file) => ({
						url: file.secure_url,
						publicId: file.public_id,
					})),
				},
			},
		},
	});

	return doctorApplication
};

export const DoctorServices = {
	applyAsDoctor,
};
