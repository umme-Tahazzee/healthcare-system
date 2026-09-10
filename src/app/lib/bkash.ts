import config from "../config";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
	try {
		const IdTokenKey = "bkash:idToken";
		const RefreshTokenKey = "bkash:refreshToken";

		let bkashIdToken = await redisClient.get(IdTokenKey);
		const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey)
		const bkashRefreshToken = await redisClient.get(RefreshTokenKey);
		const bkashRefreshTokenTTL = await redisClient.ttl(RefreshTokenKey)

		// console.log({
		// 	 bkashIdToken,
		// 	 bkashIdTokenTTL,
		// 	 bkashRefreshToken,
		// 	 bkashRefreshTokenTTL
		// });
		

		if ((bkashIdTokenTTL <= 600 || !bkashIdToken)
			&& bkashRefreshToken 
			&& bkashRefreshTokenTTL >= 600 ) {

			try {
				const RrefreshTokenResponse = await fetch(
					`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
							username: config.bkash_username,
							password: config.bkash_password,
						},
						body: JSON.stringify({
							app_key: config.bkash_app_key,
							app_secret: config.bkash_app_secret,
							refresh_token : bkashRefreshToken
						}),
						
					});
				

				const bkashRefreshTokenResult = await RrefreshTokenResponse.json()
				bkashIdToken = bkashRefreshTokenResult.id_token;


			} catch (error: any) {
				 throw new Error(error.message)
			}
		}

		if (bkashIdTokenTTL > 600) {
			return bkashIdToken;
		}

		

		const response = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					username: config.bkash_username,
					password: config.bkash_password,
				},
				body: JSON.stringify({
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);
		if (!response) {
			throw new Error("Bkash access Token run fail");
		}
		const result = await response.json();
		//bkash id token set
		await redisClient.set(IdTokenKey, result.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60,
			},
		});
		//bkash refresh Token

		await redisClient.set(RefreshTokenKey, result.refresh_token, {
			expiration: {
				type: "EX",
				value: 60 * 60 * 24 * 28,
			},
		});

		bkashIdToken = result.id_token;
		return bkashIdToken;
	} catch (error: any) {
		throw new Error(error.message);
	}
};
