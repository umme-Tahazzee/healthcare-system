import cron from "node-cron";

export const deleteUnverifiedDoctor = async () => {
	cron.schedule("*/2 * * * * *", () => {
		console.log("doctor deleted");
	});
};