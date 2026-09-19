// biome-ignore assist/source/organizeImports: <explanation>
import { prisma } from "../../lib/prisma";
import { Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import bcrypt from "bcryptjs";

const applyAsDoctor = async (
	payload: any,
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

	return doctorApplication;
};

export const DoctorServices = {
	applyAsDoctor,
};
