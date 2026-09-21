import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";

const applyAsDoctor = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const files = req.files as { [fieldname: string]: Express.Multer.File[] };

		const resume = files?.resume?.[0];
		const additionalFiles = files?.additionalFiles ?? [];
		const data = JSON.parse(req.body.data);

		const result = await DoctorServices.applyAsDoctor(
			data,
			resume,
			additionalFiles,
		);
		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Apply Doctors Successfully",
			data: result,
		});
	},
);

const verifyDoctorEmail = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const payload = req.body
		const result = await DoctorServices.verifyDoctorEmail(payload);
		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Verified Doctor successfully",
			data: result,
		});
	},
);

const approvedDoctor = catchAsync(async (req: Request, res: Response) => {
	const result = await DoctorServices.approvedDoctor(req.body, req.user!);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor application reviewed successfully",
		data: result,
	});
});

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
	const result = await DoctorServices.gellAllDoctors();
	console.log(result);
	
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Retrived all doctors successfully",
		data: result,
	});
});




export const DoctorController = {
	applyAsDoctor,
	verifyDoctorEmail,
	approvedDoctor,
	getAllDoctors
	
};
