import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppoimentService } from "./appoinment.service";

const bookAppoiment = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const result = await AppoimentService.bookAppoiment();

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "User profile fetched successfully",
			data: result,
		});
	},
);

const bookAppoimentCallBack = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		console.log(req.query, "req-query");
        
        const result = await AppoimentService.bookAppoinmentCallback();

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "User booked successfully",
			data: result,
		});
	},
);




export const AppoimentController = {
	bookAppoiment,
    bookAppoimentCallBack
};
