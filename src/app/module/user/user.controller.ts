// biome-ignore assist/source/organizeImports: <explanation>
import { NextFunction, Request, Response } from "express"
import { catchAsync } from "../../utils/catchAsync"
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { UserService } from "./user.service";


const uploadProfileImage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {

	if (!req.file) {
   		throw new Error("No file provider")
   }

   const userId = req.user?.userId 
	const result = await UserService.uploadProfileImage(req.file?.buffer, userId!)
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Image Upload successfully",
		data: result
	});
});

export const UserController = {
    uploadProfileImage
}