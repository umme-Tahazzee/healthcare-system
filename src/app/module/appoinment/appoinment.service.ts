
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const bookAppoiment = async () => {
	const bkashIdToken = await getBkashIdToken();
	if (!bkashIdToken) {
		throw new Error("No Bkash Access Token Found");
	}

	const bkashCreatePaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "Application/json",
				Accept:  "Application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				// agreementID: "TokenizedMerchant01L3IKB6H1565072174986",
				mode: "0011",
				payerReference: "01723888888",
				callbackURL: `${config.bkash_callback_url}/appoinment/book-appoinment/payment/callback/`,
				// merchantAssociationInfo: "MI05MID54RF09123456One",
				amount: "1200",
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: "Inv01247",
			}),
		},
	);

	const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();
	

	return bkashCreatePaymentResult;
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
				"Content-Type":  "Application/json",
				Accept:  "Application/json",
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