import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppoimentService } from "./appoinment.service";

const bookAppoiment = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const payload = req.body;
		const user = req.user!;

		const result = await AppoimentService.bookAppoiment(payload, user);

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
		const { redirectUrl } = await AppoimentService.bookAppoinmentCallback(
			req.query,
		);

		res.redirect(redirectUrl);
	},
);

export const AppoimentController = {
	bookAppoiment,
	bookAppoimentCallBack,
};
