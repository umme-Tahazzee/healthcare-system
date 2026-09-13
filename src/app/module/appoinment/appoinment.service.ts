


import { AppoinmentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";

const bookAppoiment = async (payload: any,
	 user: RequestUser) => {
		
		
	const transectionResult = await prisma.$transaction(async (tx) => {
		const appointment = await prisma.appoinment.create({
			data: {
				status: AppoinmentStatus.PENDING,
			},
		});

		try {
			const bkashIdToken = await getBkashIdToken();

			if (!bkashIdToken) {
				throw new Error("No Bkash Access Token Found");
			}

			const bkashCreatePaymentResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/create`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						Authorization: bkashIdToken,
						"X-App-Key": config.bkash_app_key,
					},
					body: JSON.stringify({
						mode: "0011",
						payerReference: user.email,
						callbackURL: `${config.bkash_callback_url}/appoinment/book-appoinment/payment/callback/`,
						amount: "1200",
						currency: "BDT",
						intent: "sale",
						merchantInvoiceNumber: appointment.id,
					}),
				},
			);

			if (!bkashCreatePaymentResponse.ok) {
				const errorBody = await bkashCreatePaymentResponse.text();
				throw new Error(`Bkash payment creation failed: ${errorBody}`);
			}

			const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();
			const payment = await tx.payment.create({
				data :{
					 marchentInvoiceNumber : bkashCreatePaymentResult.merchantInvoiceNumber,
					 appointmentId : appointment.id,
					 amount : "1200",
					 gatewayResponse :bkashCreatePaymentResult,
					 bkashPaymentId : bkashCreatePaymentResult.paymentID,
					 payerReference: user.email,
					 

				 
				}
			})

			return { appointment, payment }

		} catch (error) {
			await prisma.appoinment.update({
				where: { id: appointment.id },
				data: { status: AppoinmentStatus.PENDING },
			});

			throw error;
		}
	});

	return transectionResult
};

const bookAppoinmentCallback = async (query: Record<string, any>) => {
	const paymentId = query.paymentID;
	if (!paymentId) {
		throw new Error("payment id missing");
	}
	const status = query.status;
	if (!status) {
		throw new Error("Payment status is missing");
	}

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new Error("No Bkash Access Token Found");
	}

	const executedPaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/execute`,
		{
			method: "POST",
			headers: {
				"Content-Type": "Application/json",
				Accept: "Application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				paymentID: paymentId,
			}),
		},
	);

	const excutePaymentResult = await executedPaymentResponse.json();

	if (status === "success") {
		return {
			excutePaymentResult,
			redirectUrl: `${config.frontend_url}/dashboard/my-appoinments?status=success`,
		};
	}
	if (status === "failure") {
		return {
			excutePaymentResult,
			redirectUrl: `${config.frontend_url}/dashboard/my-appoinments?status=failure`,
		};
	}

	if (status === "cancel") {
		return {
			excutePaymentResult,
			redirectUrl: `${config.frontend_url}/dashboard/my-appoinments?status=cancel`,
		};
	}

	return {
		excutePaymentResult,
		redirectUrl: `${config.frontend_url}/dashboard/my-appoinments`,
	};
};

export const AppoimentService = {
	bookAppoiment,
	bookAppoinmentCallback,
};
