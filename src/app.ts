// biome-ignore assist/source/organizeImports: <explanation>
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, type Application, type Request, type Response } from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import crypto from "crypto"
import { UsersRoutes } from "./app/module/user/user.route";
import { getBkashIdToken } from "./app/lib/bkash";
import { success } from "zod";
import { AppoinmentRoutes } from "./app/module/appoinment/appoinment.route";
import { DoctorRoutes } from "./app/module/doctor/doctor.route";


const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);


// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UsersRoutes);
app.use("/api/v1/appoinment", AppoinmentRoutes);
app.use("/api/v1/doctor", DoctorRoutes);



app.get('/test', async(req:Request, res:Response, next:NextFunction)=>{
	try {
		const grantTokenResult = await getBkashIdToken()
		console.log(grantTokenResult, 'bkash');
		res.status(httpStatus.OK).json({
			success:true,
			message : "Welcome to PH healthcare system Backend",
			data : null
			 
		})
		
	} catch (error) {
		console.log(error);
		next(error)
		
		
	}
})

// Basic route
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to PH Healthcare System Backend",
	});
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
