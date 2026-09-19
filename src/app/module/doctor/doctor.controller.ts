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



		console.log({ resume, additionalFiles, data });

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

export const DoctorController = {
	applyAsDoctor,
};
