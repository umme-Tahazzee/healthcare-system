import config from "../config";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
	try {
		const Idtoken_key = "bkash:id_token";
		const Refresh_token = "bkash:refresh_token";
        let bkashToken =await redisClient.get(Idtoken_key)
        const bkashIdTokenTTL = await redisClient.ttl(Idtoken_key)
        let bkashRefreshToken = await redisClient.get(Refresh_token)
        const bkashRefreshTokenTTL = await redisClient.ttl(Refresh_token)

        //bkash id token remainging time is less than equal 10 minitus
    
        if((bkashIdTokenTTL <= 600 || !bkashToken) 
            && bkashRefreshToken 
            && bkashRefreshTokenTTL>600){
             const RefreshTokenResponse = await fetch(
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
					app_key: config.bkash_api_key,
					app_secret: config.bkash_app_secret,
                    refresh_token : bkashRefreshToken
				}),
			});  

            const bkashRefreshTokenResult = await RefreshTokenResponse.json()
            
            bkashToken = bkashRefreshTokenResult.id_token as string
            
            await redisClient.set(Idtoken_key,bkashToken, {
                  expiration: {
                     type: "EX",
                     value: 60*60
                     
                  }
            } )
            return bkashToken
        }
        
        if(bkashIdTokenTTL > 600){
              return bkashToken
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
					app_key: config.bkash_api_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);

		if (!response) {
			throw new Error("Bkash AccessToken Grant Failed");
		}

		const result = await response.json();

		//bkash id token set
		await redisClient.set(Idtoken_key, result.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60,
			},
		});

		await redisClient.set(Refresh_token, result.refresh_token, {
			expiration: {
				type: "EX",
				value: 60 * 60 * 24 * 28,
			},
		});

        bkashToken = result.id_token
		return bkashToken;

	} catch (error: any) {
		throw new Error(error.message);
	}
};
