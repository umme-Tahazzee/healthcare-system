import { DoctorVerificationStatus } from "../../../generated/prisma/enums";

export interface IApplyAsDoctorPayload {
	user: {
		name: string;
		email: string;
	};
	doctor: {
		address?: string;
		specialization: string;
		qualifications: string;
		experienceYear: number;
		licenseNumber: string;
		bio?: string;
		consultationFee?: number;
        contactNumber?:number;
	};
}

export interface IDoctorVerifyEmailPayload {
	email: string;
	otp: string;
}

export interface IApprovedDoctorPayload {
     doctorId: string,
     verificationStatus : DoctorVerificationStatus
     rejectionReason?: string
	 isDeleted ?: boolean
}
