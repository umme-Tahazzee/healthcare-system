import crypto from 'crypto'
import {
	AppoinmentStatus,
	PaymentStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";



const bookAppoiment = async (payload: any, user: RequestUser) => {
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
			const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

			if (!bkashCreatePaymentResponse.ok) {
				const errorBody = await bkashCreatePaymentResponse.text();
				throw new Error(`Bkash payment creation failed: ${errorBody}`);
			}

			const payment = await tx.payment.create({
				data: {
					marchentInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
					appointmentId: appointment.id,
					amount: "1200",
					gatewayResponse: bkashCreatePaymentResult,
					bkashPaymentId: bkashCreatePaymentResult.paymentID,
					payerReference: user.email,
				},
			});

			return { appointment, payment };
		} catch (error) {
			await prisma.appoinment.update({
				where: { id: appointment.id },
				data: { status: AppoinmentStatus.PENDING },
			});

			throw error;
		}
	});

	return transectionResult;
};

const payAppoinment = async (payload: any, user: RequestUser) => {
	const appointmentId = payload.appoinmentId;
	const existingAppoinment = await prisma.appoinment.findUnique({
		where: {
			id: appointmentId,
		},
	});

	if (!existingAppoinment) {
		throw new Error("Appointment doest not exists");
	}

	if (existingAppoinment.status === "CONFRIMED") {
		throw new Error("Appoinment Already Paid and confrim");
	}
	if (
		existingAppoinment.status === "CANCELLED" ||
		existingAppoinment.status === "ONGOING" ||
		existingAppoinment.status === "COMPLETED"
	) {
		throw new Error(
			`Appoinment is already ${existingAppoinment.status}`,
		);
	}

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
				callbackURL: `${config.bkash_callback_url}/appoinment/book-appoinment/payment/callback/`,
				amount: "1200",
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: existingAppoinment.id,
			}),
		},
	);

	console.log(bkashCreatePaymentResponse, "bkashCreatePaymentResponse");

	if (!bkashCreatePaymentResponse.ok) {
		const errorBody = await bkashCreatePaymentResponse.text();
		throw new Error(`Bkash payment creation failed: ${errorBody}`);
	}

	const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();
	await prisma.payment.update({
		where: {
			bkashPaymentId: bkashCreatePaymentResult.paymentID,
		},
		data: {
			marchentInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
			gatewayResponse: bkashCreatePaymentResult,
			bkashPaymentId: bkashCreatePaymentResult.paymentID,
		},
	});

	return {
		paymentUrl: bkashCreatePaymentResult.bkashURL,
	};
};

const bookAppoinmentCallback = async (query: Record<string, any>) => {
	const transectionResult = await prisma.$transaction(async (tx) => {
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
			await tx.appoinment.update({
				where: {
					id: excutePaymentResult.merchantInvoiceNumber,
				},
				data: {
					status: AppoinmentStatus.CONFRIMED,
				},
			});

			await tx.payment.update({
				where: {
					appointmentId: excutePaymentResult.merchantInvoiceNumber,
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.PAID,
					bkashTrxId: excutePaymentResult.trxID,
					paidAt: excutePaymentResult.paymentExecuteTime,
					gatewayResponse: excutePaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appoinments?status=success`,
			};
		} else if (status === "failure") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.FAILED,
					gatewayResponse: excutePaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appoinments?status=failure`,
			};
		} else if (status === "cancel") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.CANCELLED,
					gatewayResponse: excutePaymentResult,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appoinments?status=cancel`,
			};
		} else {
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appoinments?error-payment-failed`,
			};
		}
	});

	return transectionResult;
};

const parseBkashDate = (dateStr?: string): Date => {
	if (!dateStr) return new Date();

	// bKash sometimes sends "YYYY-MM-DDTHH:mm:ss:SSS GMT+0600" (colon before ms)
	const normalized = dateStr.replace(
		/(\d{2}:\d{2}:\d{2}):(\d{3})/,
		"$1.$2"
	);

	const parsed = new Date(normalized);
	return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const cancelAppointment = async (payload: any) => {
	const transectionResult = await prisma.$transaction(async (tx) => {
		const appoinmentId = payload.appoinmentId;

		const existingAppoinment = await tx.appoinment.findUnique({
			where: { id: appoinmentId },
			include: { payment: true },
		});

		if (!existingAppoinment) {
			throw new Error("Appoinment doesnot exists");
		}

		if (
			existingAppoinment.status === "ONGOING" ||
			existingAppoinment.status === "COMPLETED"
		) {
			throw new Error("Appoinment ongoing or completed");
		}

		if (existingAppoinment.status === "CANCELLED") {
			throw new Error("Appoinment Already cancel");
		}

		if (existingAppoinment.payment?.status === "REFUNDED") {
			throw new Error("Payment already refunded");
		}

		if (!existingAppoinment.payment?.bkashTrxId) {
			throw new Error("No bKash transaction ID found for this payment");
		}

		const bkashIdToken = await getBkashIdToken();
		

		if (!bkashIdToken) {
			throw new Error("No Bkash Access Token Found");
		}

		const refundPayload = {
			paymentID: existingAppoinment.payment?.bkashPaymentId,
			trxID: existingAppoinment.payment?.bkashTrxId,
			amount: existingAppoinment.payment?.amount?.toString(),
			sku: "Appointment cancellation",
			reason: "User patient cancel the appoinment",
		};

		const bkashRefundPaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify(refundPayload),
			},
		);

		const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();
		console.log("bKash refund response:", bkashRefundPaymentResult);
		console.log("completedTime raw:", bkashRefundPaymentResult.completedTime);

		if (
			!bkashRefundPaymentResponse.ok ||
			bkashRefundPaymentResult.statusCode !== "0000"
		) {
			throw new Error(
				`Refund failed: ${
					bkashRefundPaymentResult.statusMessage ||
					bkashRefundPaymentResult.errorMessage ||
					"Unknown bKash error"
				}`,
			);
		}

		const updatedAppoinment = await tx.appoinment.update({
			where: { id: existingAppoinment.id },
			data: { status: "CANCELLED" },
		});

		const updatedPayment = await tx.payment.update({
			where: { appointmentId: existingAppoinment.id },
			data: {
				status: "REFUNDED",
				refundTrxId: bkashRefundPaymentResult.refundTrxId,
				refundAt: parseBkashDate(bkashRefundPaymentResult.completedTime),
				refundAmount:
					bkashRefundPaymentResult.refundAmount ??
					existingAppoinment.payment?.amount,
				refundReason: "User patient cancel the appoinment",
			},
		});

		return {
			appoinment: updatedAppoinment,
			payment: updatedPayment,
		};
	});

	return transectionResult;
};
export const AppoimentService = {
	bookAppoiment,
	bookAppoinmentCallback,
	payAppoinment,
	cancelAppointment,
};
